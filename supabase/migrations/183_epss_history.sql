-- 183. The daily EPSS series per CVE
--
-- STATUS: APPLIED 19 Nov 2026, 03:55 UTC, as 183_epss_history (version 20261119035529). Builds on 158 (apply_epss_scores).
--
-- WHY
--
-- apply_epss_scores() (158) updates epss_score, epss_percentile and epss_date in
-- place, so only the latest score survives. EPSS rises in the days after a CVE
-- reaches KEV, which is the series that was lost.
--
-- WHAT CHANGES
--
-- epss_history (cve_id, score_date, score, percentile), primary key
-- (cve_id, score_date). apply_epss_scores() writes a row for every score it
-- applies (a new score_date, or a changed score or percentile), and, the first
-- time it replaces a CVE's score, also the score being replaced, so the series
-- starts from what was held. Re-running the same file adds nothing new. Everything
-- else in the function is as in 158.
--
-- SIZE (estimate, unverified): the job scores about 17,500 CVEs above 0.1 plus
-- every KEV CVE (1,786) a day, and nearly all of them move each day, so about
-- 19,000 rows a day. A row is about 45 bytes of data plus 24 of header plus a
-- primary-key entry of about 40: around 110 bytes, about 2 MB a day, about
-- 0.75 GB a year (Supabase Pro includes 8 GB). The first day adds one extra
-- row per scored CVE already held (6,656 at the 26 Oct measure).

begin;

create table public.epss_history (
  cve_id text not null,
  score_date date not null,
  score numeric not null,
  percentile numeric,
  recorded_at timestamptz not null default now(),
  primary key (cve_id, score_date)
);

comment on table public.epss_history is
  'FIRST''s EPSS score and percentile per CVE per day Vigil applied it, appended by apply_epss_scores(). 183.';

revoke all on public.epss_history from anon, authenticated;
grant select, insert, update, delete on public.epss_history to service_role;
alter table public.epss_history enable row level security;

create or replace function public.apply_epss_scores(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_received int := coalesce(jsonb_array_length(p_rows), 0);
  v_applied int := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'apply_epss_scores expects a JSON array' using errcode = '22023';
  end if;

  with incoming as (
    select distinct on (x.cve)
           x.cve, x.epss, x.percentile, x.date
    from jsonb_to_recordset(p_rows) as x(cve text, epss numeric, percentile numeric, date date)
    where x.cve is not null and x.epss is not null and x.date is not null
    order by x.cve, x.date desc
  ), todo as (
    select v.cve_id, i.epss, i.percentile, i.date,
           v.epss_score as old_score, v.epss_percentile as old_percentile, v.epss_date as old_date
    from incoming i
    join vulnerabilities v on v.cve_id = i.cve
    where (v.epss_date is null or i.date >= v.epss_date)
      and (v.epss_date is distinct from i.date
           or v.epss_score is distinct from i.epss
           or v.epss_percentile is distinct from i.percentile)
  ), keep_old as (
    insert into epss_history (cve_id, score_date, score, percentile)
    select cve_id, old_date, old_score, old_percentile
    from todo
    where old_date is not null and old_score is not null and old_date <> date
    on conflict (cve_id, score_date) do nothing
    returning 1
  ), keep_new as (
    insert into epss_history (cve_id, score_date, score, percentile)
    select cve_id, date, epss, percentile from todo
    on conflict (cve_id, score_date) do update
      set score = excluded.score, percentile = excluded.percentile, recorded_at = now()
    returning 1
  ), updated as (
    update vulnerabilities v
    set epss_score = t.epss,
        epss_percentile = t.percentile,
        epss_date = t.date
    from todo t
    where v.cve_id = t.cve_id
    returning 1
  )
  select count(*) into v_applied from updated;

  return jsonb_build_object('received', v_received, 'applied', v_applied);
end;
$fn$;

comment on function public.apply_epss_scores(jsonb) is
  'Bulk-writes FIRST EPSS scores with their date to CVEs Vigil holds. Never '
  'replaces a newer score with an older one. Appends each applied score to '
  'epss_history. See migrations 158 and 183.';

revoke execute on function public.apply_epss_scores(jsonb) from public, anon, authenticated;
grant execute on function public.apply_epss_scores(jsonb) to service_role;

commit;
