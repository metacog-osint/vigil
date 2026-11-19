-- 189. The site's "Escalating" label follows the surge rule (179), so the site and /api/feed agree
--
-- STATUS: APPLIED 19 Nov 2026, 04:23 UTC, as 189_trend_label_follows_surge (version
-- 20261119042317). Live after: 1 group ESCALATING (pixelleaks), 58 STABLE, 14 DECLINING,
-- 332 INACTIVE.
--
-- WHY
--
-- 179 (19 Nov 2026) made /api/feed's anomaly (VG-WP-1, VG-IND-1) mean that a
-- group's last 7 complete days are unusual against its own 8 weeks before
-- (threat_actors.surge), and left 077's trend_status alone. So the two
-- disagreed: at 03:55 UTC on 19 Nov the feed named one group (pixelleaks)
-- while the site labelled ten "Escalating", among them Qilin at 28 claims
-- against its usual 22 a week, and panzer and braincipher at 4 each. The label
-- is read in about 40 places (badges, filters, alert rules, search, exports),
-- so it is changed where it is computed, not on each page.
--
-- THE RULE
--
--   ESCALATING  threat_actors.surge is true (179's rule, unchanged)
--   DECLINING   077's rule, unchanged: at least 3 the week before and fewer
--               than 0.75 times that this week
--   INACTIVE    no claim in 30 days, unchanged
--   STABLE      everything else, including a week-on-week rise that is not
--               unusual for the group
--   null        a group with no claims at all, unchanged
--
-- incidents_7d, incidents_prev_7d and incident_velocity are unchanged: they
-- remain the plain counts the actor table shows beside the label.
--
-- ORDER
--
-- apply_actor_surges() now runs first, so the label reads this hour's surge,
-- not last hour's. It is the same call 179 made at the end.

begin;

create or replace function public.apply_actor_trends()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  changed integer;
  surges jsonb;
begin
  surges := apply_actor_surges();

  with stats as (
    select a.id, a.surge,
      count(i.id) filter (where i.discovered_date >= current_date - 7) as c7,
      count(i.id) filter (where i.discovered_date >= current_date - 14 and i.discovered_date < current_date - 7) as p7,
      count(i.id) filter (where i.discovered_date >= current_date - 30) as c30,
      count(i.id) as total,
      max(i.discovered_date) as last_inc
    from threat_actors a
    left join incidents i on i.actor_id = a.id and i.data_quality <> 'placeholder'
    group by a.id, a.surge
  ), target as (
    select id, c7, p7, last_inc,
      round(c7::numeric / 7, 2) as velocity,
      case
        when total = 0 then null
        when surge then 'ESCALATING'
        when c30 = 0 then 'INACTIVE'
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
  return jsonb_build_object('actors_updated', changed, 'run_at', now(), 'surges', surges);
end;
$$;

comment on function public.apply_actor_trends() is
  'Hourly. trend_status ESCALATING means threat_actors.surge (179''s rule); DECLINING, INACTIVE and '
  'STABLE as 077. Migration 189.';

revoke execute on function public.apply_actor_trends() from public, anon, authenticated;
grant execute on function public.apply_actor_trends() to service_role;

-- New labels now, not at the next hourly run.
select public.apply_actor_trends();

commit;
