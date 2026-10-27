-- 158. EPSS scores that are current, and that say when they are from
--
-- STATUS: NOT YET APPLIED.
--
-- WHAT WAS BROKEN
--
-- The epss job read the CVE list, took the first 40 rows - the worker's
-- subrequest budget - and refreshed those. The same 40 every day, in whatever
-- order the table returned them. It reported success each time and feed_health
-- called it fresh. Measured 26 October 2026:
--
--   * 6,656 of 29,950 CVEs carry a score; the newest of them was written on
--     20 September, by an earlier bulk import, not by the job.
--   * 764 of 1,867 KEV entries carry a score.
--   * Of the 32 CVEs added to KEV in the last 30 days, none has a score.
--
-- A feed reporting fresh while serving five-week-old numbers is the failure
-- this project exists to avoid, and it blocks the KEV + EPSS priority rule
-- (159): EPSS rises in the days after a CVE reaches KEV, and those are exactly
-- the scores that never arrived.
--
-- WHAT CHANGES
--
-- The fetch moves to the epss-scores Edge Function, where there is room for
-- it, and the worker job becomes one call to it. Each day it takes:
--
--   1. every CVE FIRST scores above 0.1, about 17,500, in pages of 1,000; and
--   2. every KEV CVE Vigil holds, by id in batches of 100, so a KEV entry's
--      low score is current too, not left at whatever it was in September.
--
-- About 38 requests. apply_epss_scores() writes them in bulk, only to CVEs
-- Vigil holds, and never replaces a score with an older one.
--
-- epss_date is the date FIRST scored the CVE. A score is a claim about a day,
-- and a score shown without its date reads as today's. A CVE that fell below
-- 0.1 and is not in KEV keeps its last score and its older date, which says
-- exactly what is known.
--
-- vulnerabilities has one trigger, trg_sync_kev_columns, which keeps the two
-- KEV date columns in step. No changelog trigger fires on these updates.

alter table public.vulnerabilities add column if not exists epss_date date;

comment on column public.vulnerabilities.epss_date is
  'The date FIRST published the EPSS score held in epss_score. A score without '
  'its date reads as current. See migration 158.';

-- Writes a batch of FIRST scores to CVEs Vigil already holds. Rows for CVEs
-- Vigil does not hold are ignored; an older score never replaces a newer one.
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
  ), updated as (
    update vulnerabilities v
    set epss_score = i.epss,
        epss_percentile = i.percentile,
        epss_date = i.date
    from incoming i
    where v.cve_id = i.cve
      and (v.epss_date is null or i.date >= v.epss_date)
      and (v.epss_date is distinct from i.date
           or v.epss_score is distinct from i.epss
           or v.epss_percentile is distinct from i.percentile)
    returning 1
  )
  select count(*) into v_applied from updated;

  return jsonb_build_object('received', v_received, 'applied', v_applied);
end;
$fn$;

comment on function public.apply_epss_scores(jsonb) is
  'Bulk-writes FIRST EPSS scores with their date to CVEs Vigil holds. Never '
  'replaces a newer score with an older one. See migration 158.';

-- The KEV CVEs to score by id. An array, not rows, so the Edge Function gets
-- all of them in one call instead of paging past PostgREST's 1,000-row cap.
create or replace function public.epss_kev_targets()
returns text[]
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(array_agg(cve_id order by cve_id), '{}')
  from vulnerabilities
  where kev_date is not null;
$fn$;

revoke execute on function public.apply_epss_scores(jsonb) from public, anon, authenticated;
grant execute on function public.apply_epss_scores(jsonb) to service_role;

revoke execute on function public.epss_kev_targets() from public, anon, authenticated;
grant execute on function public.epss_kev_targets() to service_role;

update feed_expectations
set note = 'FIRST EPSS scores, through the epss-scores Edge Function: every CVE '
  || 'scored above 0.1 and every KEV CVE, daily, with the date FIRST scored it '
  || '(epss_date). Until migration 158 this refreshed the same 40 CVEs a day '
  || 'while reporting success.'
where feed_id = 'epss';
