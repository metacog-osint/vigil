-- 179. A group's surge, judged against the group's own last eight weeks (VG-WP-1)
--
-- STATUS: APPLIED 19 Nov 2026, 02:16 UTC, as 179_actor_surge_rule (version
-- 20261119021646). Written 19 November 2026. The rule is rule G.
-- First run, live: one group flagged, pixelleaks (25 claims on 5 days in the
-- 7 days to 18 Nov, against 0.63 a week; p = 1.1e-5).
--
-- WHY
-- /api/feed raises a group as an anomaly (VG-WP-1, VG-IND-1) and COP shows it.
-- An anomaly must mean unusual against Vigil's own baseline. Until now it was
-- 077's trend rule, trend_status = 'ESCALATING': at least 3 victims in the
-- window and more than 1.25 times the week before. Measured live on
-- 19 Nov 2026 over 86 evaluation days (26 Aug - 19 Nov), that rule flagged
-- 17.1 groups a day on average (25 at most, never none): 277 episodes across
-- 88 groups, 28% of flag-days posted on a single day, 44% with 5 claims or
-- fewer. On 19 Nov all ten were it, including panzer 4, braincipher 4 and
-- Inception 5, each posted on 17 Nov only. On 15 Nov the top one was n0n's
-- 87, normal for n0n (its eight weeks before: 49, 11, 50, 86, 4, 4, 4, 9).
--
-- Two faults in the window too: 077's "7 days" is discovered_date >=
-- current_date - 7, eight calendar days with today's partial one, against a
-- prior window of seven, which leans every group about 14% toward escalating.
--
-- THE RULE (apply_actor_surges)
--   window    the last 7 complete UTC days, day - 7 .. day - 1
--   baseline  the 8 weeks before, day - 63 .. day - 8, as 8 weekly counts
--   eligible  at least 5 claims, posted on at least 3 different days, so
--             one batch dump is not read as a surge
--   unusual   P(X >= claims) < 0.01 under a negative binomial with the
--             baseline's mean (at least 1 a week) and sample variance (at
--             least the mean; Poisson when it is no more than the mean)
--   counted   every claim except data_quality = 'placeholder', as 077
--
-- Why negative binomial, not Poisson: weekly claim counts are overdispersed.
-- Among the 32 groups averaging 2 or more a week over 12 weeks, the median
-- variance/mean was 4.5 and 24 of 32 were above 2. A Poisson test over-flags
-- (rule E below).
--
-- Backtest, 26 Aug - 19 Nov 2026 (flags a day, mean and max; days with none;
-- episodes; groups):
--   current 077                         17.1 / 25    0   277   88
--   Poisson p<.01, >=5 claims, >=3 days  2.4 /  5    9    58   34   (E)
--   NegBin  p<.01, >=5 claims, >=2 days  1.9 /  6   21    41   33   (H)
--   NegBin  p<.01, >=5 claims, >=3 days  1.0 /  4   40    25   20   (G, this)
--   G with a 12-week baseline            1.0 /  4   38    27   20
-- On 15 Nov, G gives INC Ransom (49 against a usual 6.2 a week) and
-- pixelleaks; on 19 Nov, pixelleaks only. Scripts and the full note are
-- outside the repo, in the session's notes (vigil-surge-rule-backtest.md).
--
-- "Company #NNN" claims (193, all n0n) stay counted: each post names a
-- sector and a country, so they are claims with the victim's name withheld,
-- not placeholders. Leaving them out changes nothing under G.
--
-- A group with no claims in the 8 weeks before has no baseline to be unusual
-- against; it stays an anomaly when it meets the rule (the mean is floored at
-- 1 a week) and surge_new_group says so, so the feed can say so. 6 of G's 20
-- groups were new.
--
-- WHAT CHANGES
-- New columns on threat_actors, written by apply_actor_surges(), which
-- apply_actor_trends() now calls (hourly, from run_data_quality_checks and
-- the two GitHub workflows). trend_status and 077's rule are unchanged: the
-- site's trend label is a week-on-week trend, not an anomaly. Only /api/feed's
-- anomaly reads surge. threat_actors' existing grants and its read-only RLS
-- policy cover the new columns.

begin;

alter table public.threat_actors
  add column if not exists surge boolean not null default false,
  add column if not exists surge_claims_7d integer,
  add column if not exists surge_days_7d integer,
  add column if not exists surge_baseline_mean numeric,
  add column if not exists surge_baseline_var numeric,
  add column if not exists surge_p double precision,
  add column if not exists surge_new_group boolean,
  add column if not exists surge_window_end date;

comment on column public.threat_actors.surge is
  'VG-IND-1 (migration 179): claims in the 7 complete UTC days to surge_window_end are unusual against the group''s own 8 weeks before. Not a warning.';

create index if not exists threat_actors_surge_idx
  on public.threat_actors (surge_claims_7d desc) where surge;

-- P(X >= k) for a count with mean mu and variance var: negative binomial when
-- var > mu, else Poisson. Summed term by term from the recurrence, so no
-- gamma function is needed (Postgres 17 has none).
create or replace function public.count_upper_tail(k integer, mu double precision, var double precision)
returns double precision
language plpgsql immutable strict
set search_path = ''
as $$
declare
  p double precision;
  r double precision;
  term double precision;
  s double precision := 0;
  i integer;
begin
  if k <= 0 then return 1; end if;
  if mu <= 0 then return 0; end if;
  if var <= mu * 1.0001 then
    term := exp(-mu);
    for i in 0 .. k - 1 loop
      s := s + term;
      term := term * mu / (i + 1);
    end loop;
  else
    p := mu / var;
    r := mu * p / (1 - p);
    term := power(p, r);
    for i in 0 .. k - 1 loop
      s := s + term;
      term := term * (i + r) / (i + 1) * (1 - p);
    end loop;
  end if;
  return greatest(0::double precision, 1 - s);
end;
$$;

revoke execute on function public.count_upper_tail(integer, double precision, double precision) from public, anon, authenticated;
grant execute on function public.count_upper_tail(integer, double precision, double precision) to service_role;

create or replace function public.apply_actor_surges(p_day date default current_date)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  changed integer;
  flagged integer;
begin
  with daily as (
    select i.actor_id, i.discovered_date as d, count(*) as n
      from incidents i
     where i.actor_id is not null
       and i.data_quality <> 'placeholder'
       and i.discovered_date between p_day - 63 and p_day - 1
     group by 1, 2
  ), weekly as (
    -- week 0 is the window; weeks 1..8 the baseline
    select actor_id, ((p_day - 1) - d) / 7 as w, sum(n) as n, count(*) as days
      from daily
     group by 1, 2
  ), per as (
    select actor_id,
           coalesce(sum(n) filter (where w = 0), 0)::integer as c7,
           coalesce(sum(days) filter (where w = 0), 0)::integer as d7,
           coalesce(sum(n) filter (where w between 1 and 8), 0)::double precision as s1,
           coalesce(sum(n * n) filter (where w between 1 and 8), 0)::double precision as s2
      from weekly
     group by 1
  ), judged as (
    select actor_id, c7, d7,
           s1 / 8 as mean,
           greatest((s2 - s1 * s1 / 8) / 7, 0) as var,
           s1 = 0 as new_group,
           case when c7 >= 5 and d7 >= 3
                then count_upper_tail(c7, greatest(s1 / 8, 1),
                                      greatest((s2 - s1 * s1 / 8) / 7, greatest(s1 / 8, 1)))
           end as p
      from per
  ), target as (
    select a.id,
           coalesce(j.p < 0.01, false) as surge,
           coalesce(j.c7, 0) as c7,
           coalesce(j.d7, 0) as d7,
           round(coalesce(j.mean, 0)::numeric, 2) as mean,
           round(coalesce(j.var, 0)::numeric, 2) as var,
           j.p,
           j.new_group
      from threat_actors a
      left join judged j on j.actor_id = a.id
  )
  update threat_actors t set
    surge = x.surge,
    surge_claims_7d = x.c7,
    surge_days_7d = x.d7,
    surge_baseline_mean = x.mean,
    surge_baseline_var = x.var,
    surge_p = x.p,
    surge_new_group = x.new_group,
    surge_window_end = p_day - 1
  from target x
  where t.id = x.id
    and (t.surge is distinct from x.surge
         or t.surge_claims_7d is distinct from x.c7
         or t.surge_days_7d is distinct from x.d7
         or t.surge_baseline_mean is distinct from x.mean
         or t.surge_baseline_var is distinct from x.var
         or t.surge_p is distinct from x.p
         or t.surge_new_group is distinct from x.new_group
         or t.surge_window_end is distinct from p_day - 1);
  get diagnostics changed = row_count;
  select count(*) into flagged from threat_actors where surge;
  return jsonb_build_object('actors_updated', changed, 'surging', flagged, 'window_end', p_day - 1);
end;
$$;

revoke execute on function public.apply_actor_surges(date) from public, anon, authenticated;
grant execute on function public.apply_actor_surges(date) to service_role;

-- 077's trend rule, unchanged, now followed by the surge rule.
create or replace function public.apply_actor_trends()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  changed integer;
  surges jsonb;
begin
  with stats as (
    select a.id,
      count(i.id) filter (where i.discovered_date >= current_date - 7) as c7,
      count(i.id) filter (where i.discovered_date >= current_date - 14 and i.discovered_date < current_date - 7) as p7,
      count(i.id) filter (where i.discovered_date >= current_date - 30) as c30,
      count(i.id) as total,
      max(i.discovered_date) as last_inc
    from threat_actors a
    left join incidents i on i.actor_id = a.id and i.data_quality <> 'placeholder'
    group by a.id
  ), target as (
    select id, c7, p7, last_inc,
      round(c7::numeric / 7, 2) as velocity,
      case
        when total = 0 then null
        when c30 = 0 then 'INACTIVE'
        when c7 >= 3 and c7 > greatest(p7, 1) * 1.25 then 'ESCALATING'
        when p7 >= 3 and c7 < p7 * 0.75 then 'DECLINING'
        else 'STABLE'
      end as status
    from stats
  )
  update threat_actors t set
    incidents_7d = x.c7,
    incidents_prev_7d = x.p7,
    incident_velocity = x.velocity,
    trend_status = x.status,
    last_seen = greatest(t.last_seen, x.last_inc)
  from target x
  where t.id = x.id
    and (t.incidents_7d is distinct from x.c7 or t.incidents_prev_7d is distinct from x.p7
         or t.trend_status is distinct from x.status
         or (x.last_inc is not null and (t.last_seen is null or t.last_seen < x.last_inc)));
  get diagnostics changed = row_count;
  surges := apply_actor_surges();
  return jsonb_build_object('actors_updated', changed, 'run_at', now(), 'surges', surges);
end;
$$;

revoke execute on function public.apply_actor_trends() from public, anon, authenticated;
grant execute on function public.apply_actor_trends() to service_role;

-- First values now, so the feed has a surge list as soon as this is applied.
select public.apply_actor_surges();

commit;
