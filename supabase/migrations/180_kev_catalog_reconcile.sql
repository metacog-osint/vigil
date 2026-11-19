-- 180. KEV means CISA's catalogue as it stands today
--
-- STATUS: APPLIED 19 Nov 2026 02:37 UTC (20261119023743). Written 19 November 2026.
--
-- WHY
--
-- Measured 19 Nov 2026 about 03:00 UTC against CISA's catalogue 2026.11.18
-- (1,786 entries): Vigil marked 1,794 CVEs is_kev. Every catalogue entry was in
-- Vigil; 8 rows were KEV in Vigil and in no CISA list. The app, /api/v1 and the
-- vulnerability panel showed all 8 as CISA KEV.
--
--   VulnCheck leftovers, 5 rows (source 'epss', metadata still carrying
--   VulnCheck's own keys `xdb` and `reported_exploitation`). 164 matched on
--   source = 'vulncheck-kev'; the EPSS job had since rewritten `source`, so
--   these were missed:
--     CVE-2026-23744 (MCPJam Inspector), CVE-2026-3584 (Kali Forms),
--     CVE-2026-4020 (Gravity SMTP), CVE-2026-24477 (AnythingLLM),
--     CVE-2026-27971 (Qwik)
--   Origin not recorded, 2 rows (source 'nvd', kev_date 6 and 7 Apr 2026, no
--   CISA due date, which every CISA entry has). 164 listed these as "left for
--   a person". VulnCheck is the likely origin but nothing on the row proves it:
--     CVE-2026-0740 (Ninja Forms File Uploads), CVE-2026-22679 (Weaver E-cology)
--   Removed by CISA, 1 row (source 'cisa-kev', added 21 Aug 2026, due 24 Aug).
--   CISA's own CVE record now carries no KEV entry and rates Exploitation
--   "none" (SSVC timestamp 21 Aug 2026):
--     CVE-2026-69836 (Microsoft Entra ID)
--
-- The cause of the third kind is general: cisa-kev only ever upserts, and
-- sync_kev_columns (102) only ever sets is_kev true, so an entry CISA removes
-- stays KEV in Vigil for good.
--
-- WHAT THIS DOES
--
-- 1. kev_unlisted_rows: every row cleared here, as it stood. Internal only.
-- 2. The 5 VulnCheck leftovers get 164's treatment: backed up to
--    vulncheck_retired_rows, KEV flags, title and VulnCheck's metadata keys
--    stripped. Descriptions are kept: they are the CNAs' CVE text, which NVD
--    and the CVE List publish too.
-- 3. reconcile_kev_catalog(cve_ids, catalog_version): the cisa-kev job calls it
--    after a complete run with the full list it fetched. Any row flagged KEV
--    that the list does not contain is archived and its KEV columns cleared,
--    and a finding records it for a person to see. Guards: it refuses a list
--    shorter than 1,000 (a truncated fetch must not unflag the catalogue), and
--    if more than 25 rows would go it clears none and opens a warning finding.
-- 4. Runs it once for the 3 rows that are not VulnCheck's, by name.
--
-- REVERSING IT
--
--   update public.vulnerabilities v set
--     kev_date = (r.row->>'kev_date')::date, kev_date_added = (r.row->>'kev_date_added')::date,
--     kev_due_date = (r.row->>'kev_due_date')::date, is_kev = true, exploited_in_wild = true
--   from public.kev_unlisted_rows r where r.cve_id = v.cve_id and r.cve_id = '<CVE>';

begin;

-- ---------------------------------------------------------------------------
-- 1. The undo
-- ---------------------------------------------------------------------------
create table if not exists public.kev_unlisted_rows (
  id              bigint generated always as identity primary key,
  cve_id          text not null,
  row             jsonb not null,
  reason          text not null,
  catalog_version text,
  cleared_at      timestamptz not null default now()
);

comment on table public.kev_unlisted_rows is
  'Rows of vulnerabilities whose KEV columns were cleared because CISA''s catalogue no longer (or never) '
  'listed them, copied as they stood. Written by reconcile_kev_catalog and migration 180. Internal only.';

create index if not exists kev_unlisted_rows_cve on public.kev_unlisted_rows (cve_id);

revoke all on public.kev_unlisted_rows from anon, authenticated;
grant select on public.kev_unlisted_rows to service_role;
alter table public.kev_unlisted_rows enable row level security;

-- ---------------------------------------------------------------------------
-- 2. VulnCheck leftovers that 164 missed
-- ---------------------------------------------------------------------------
insert into public.vulncheck_retired_rows (cve_id, row)
select v.cve_id, to_jsonb(v)
from public.vulnerabilities v
where v.metadata ? 'xdb' or v.metadata ? 'reported_exploitation'
on conflict (cve_id) do nothing;

insert into public.kev_unlisted_rows (cve_id, row, reason, catalog_version)
select v.cve_id, to_jsonb(v), 'vulncheck_leftover', '2026.11.18'
from public.vulnerabilities v
where v.metadata ? 'xdb' or v.metadata ? 'reported_exploitation';

-- kev_date goes to null first so sync_kev_columns does not set is_kev back.
update public.vulnerabilities v set
  kev_date                = null,
  kev_date_added          = null,
  kev_due_date            = null,
  is_kev                  = false,
  exploited_in_wild       = false,
  ransomware_campaign_use = false,
  ransomware_use          = null,
  title                   = null,
  metadata                = coalesce(v.metadata, '{}'::jsonb)
                              - 'title' - 'required_action' - 'xdb' - 'cwes'
                              - 'reported_exploitation' - 'exploit_sources'
where v.metadata ? 'xdb' or v.metadata ? 'reported_exploitation';

-- ---------------------------------------------------------------------------
-- 3. Clearing, shared by the one-off below and the reconcile function
-- ---------------------------------------------------------------------------
create or replace function public.clear_kev_flags(p_cve_ids text[], p_reason text, p_catalog_version text)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  insert into kev_unlisted_rows (cve_id, row, reason, catalog_version)
  select v.cve_id, to_jsonb(v), p_reason, p_catalog_version
  from vulnerabilities v
  where v.cve_id = any(p_cve_ids)
    and (coalesce(v.is_kev, false) or v.kev_date is not null);

  update vulnerabilities v set
    kev_date                = null,
    kev_date_added          = null,
    kev_due_date            = null,
    is_kev                  = false,
    exploited_in_wild       = false,
    ransomware_campaign_use = false,
    ransomware_use          = null
  where v.cve_id = any(p_cve_ids)
    and (coalesce(v.is_kev, false) or v.kev_date is not null);
  get diagnostics n = row_count;

  perform record_finding(
    'kev_unlisted', c, 'info', 'auto_resolved',
    jsonb_build_object('reason', p_reason, 'catalog_version', p_catalog_version,
                       'note', 'Not in CISA''s KEV catalogue; KEV columns cleared, row kept in kev_unlisted_rows.'))
  from unnest(p_cve_ids) as c;

  return n;
end;
$$;

comment on function public.clear_kev_flags(text[], text, text) is
  'Archives rows to kev_unlisted_rows, then clears their KEV columns. Called only by reconcile_kev_catalog '
  '(as its owner) and by migration 180. Migration 180.';

-- Invoker rights, and no caller but the owner: reconcile_kev_catalog runs it as its owner.
revoke execute on function public.clear_kev_flags(text[], text, text) from public, anon, authenticated, service_role;

create or replace function public.reconcile_kev_catalog(p_cve_ids text[], p_catalog_version text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  unlisted text[];
  cleared integer := 0;
begin
  if coalesce(cardinality(p_cve_ids), 0) < 1000 then
    raise exception 'reconcile_kev_catalog: refusing a catalogue of % entries (expected over 1,000)',
      coalesce(cardinality(p_cve_ids), 0);
  end if;

  select coalesce(array_agg(v.cve_id order by v.cve_id), '{}')
    into unlisted
  from vulnerabilities v
  where (coalesce(v.is_kev, false) or v.kev_date is not null)
    and not (v.cve_id = any(p_cve_ids));

  if cardinality(unlisted) > 25 then
    perform record_finding(
      'kev_unlisted_bulk', coalesce(p_catalog_version, 'unknown'), 'warning', 'open',
      jsonb_build_object('count', cardinality(unlisted), 'sample', unlisted[1:25],
                         'note', 'More rows flagged KEV than CISA lists; none cleared. A person decides.'));
    return jsonb_build_object('cleared', 0, 'held', cardinality(unlisted), 'catalog_version', p_catalog_version);
  end if;

  if cardinality(unlisted) > 0 then
    cleared := clear_kev_flags(unlisted, 'not_in_catalog', p_catalog_version);
  end if;

  return jsonb_build_object('cleared', cleared, 'cve_ids', to_jsonb(unlisted),
                            'catalog_version', p_catalog_version);
end;
$$;

comment on function public.reconcile_kev_catalog(text[], text) is
  'Called by the cisa-kev job after a complete run: clears KEV columns on rows CISA''s catalogue does not list. '
  'Refuses a list under 1,000; holds and opens a finding above 25. Migration 180.';

revoke execute on function public.reconcile_kev_catalog(text[], text) from public, anon, authenticated;
grant execute on function public.reconcile_kev_catalog(text[], text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. The three that are not VulnCheck's
-- ---------------------------------------------------------------------------
select public.clear_kev_flags(array['CVE-2026-0740', 'CVE-2026-22679'], 'origin_unrecorded', '2026.11.18');
select public.clear_kev_flags(array['CVE-2026-69836'], 'removed_by_cisa', '2026.11.18');

-- Check: none of the eight is flagged, and no VulnCheck keys remain.
do $$
declare
  still_flagged integer;
  vc_left integer;
begin
  select count(*) into still_flagged from public.vulnerabilities
  where cve_id in ('CVE-2026-23744', 'CVE-2026-3584', 'CVE-2026-4020', 'CVE-2026-24477',
                   'CVE-2026-27971', 'CVE-2026-0740', 'CVE-2026-22679', 'CVE-2026-69836')
    and (coalesce(is_kev, false) or kev_date is not null);
  select count(*) into vc_left from public.vulnerabilities
  where metadata ? 'xdb' or metadata ? 'reported_exploitation';
  if still_flagged > 0 or vc_left > 0 then
    raise exception '180: % of the eight still flagged, % rows still carry VulnCheck keys', still_flagged, vc_left;
  end if;
end $$;

commit;
