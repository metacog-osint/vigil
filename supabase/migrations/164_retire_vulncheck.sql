-- 164. Retire VulnCheck KEV: its terms do not allow a free public site to show it
--
-- STATUS: NOT APPLIED. Written 15 November 2026.
--
-- WHY
--
-- VulnCheck KEV came in through the worker (`workers/src/feeds/vulncheck.js`)
-- and the older `scripts/ingest-vulncheck.mjs`, both on a free Community
-- token. The feed had been paused since September (HTTP 401). Before
-- unpausing it, its terms were read on 15 November 2026:
--
--   Service Terms, revised 20 April 2026 (https://www.vulncheck.com/service-terms)
--     s7   "Customer may not make the Services Data available for free."
--     s7   no use "for the benefit of a third party" outside an integrated product
--     s12  a product using a free offering must "display a prominent attribution
--          notice", in its interface and its outputs
--   Site Terms, revised 11 November 2022 (https://www.vulncheck.com/terms)
--     s3   content for "personal, internal and non-commercial purposes"
--
-- Vigil is free and public: the site, /api/v1 and /api/feed. So VulnCheck's
-- data cannot be on any of them. The owner decided on 15 November 2026 to
-- retire the source and to ask VulnCheck in writing; if they consent, this
-- can be reversed from the backup table below.
--
-- WHAT IT HAD DONE TO THE KEV COLUMNS
--
-- The worker upserted on cve_id into the same rows CISA's KEV feed writes and
-- set `kev_date`, which /api/feed (api/feed.js) reads with no source filter and
-- publishes as "added to CISA's KEV catalog on <date>" under CISA's grade and
-- public-domain licence. Measured 15 November 2026: 201 rows with
-- source = 'vulncheck-kev', every one is_kev = true and so shown in the app as
-- KEV; 101 of them carry a VulnCheck kev_date, the newest 6 April 2026. None
-- fell inside /api/feed's window that day. Rows in CISA's own catalogue are
-- not affected: the cisa-kev job rewrites all of them every six hours, so
-- every row CISA lists carries source = 'cisa-kev'.
--
-- WHAT THIS DOES
--
-- 1. Registers VulnCheck in source_licences with commercial_use = false.
-- 2. Copies each VulnCheck row, as it stands, into vulncheck_retired_rows,
--    which nothing outside the database can read. That is the undo.
-- 3. Strips from those rows every value VulnCheck supplied: the KEV flags and
--    dates, ransomware use, the description and title it supplied, and its
--    metadata keys. Rows are not deleted: correlations, advisories and
--    kev_epss_priority cascade on delete, and vendor, product and any NVD or
--    EPSS values on the row are not VulnCheck's.
-- 4. Removes the feed's row from feed_expectations, so feed health stops
--    counting a retired feed as failing.
--
-- Not touched: seven rows (5 epss, 2 nvd) carry a kev_date with no CISA due
-- date. Their origin was not established, so they are left for a person.
--
-- REVERSING IT
--
--   update public.vulnerabilities v set
--     is_kev = (r.row->>'is_kev')::boolean, ...   -- from r.row, column by column
--   from public.vulncheck_retired_rows r where r.cve_id = v.cve_id;

begin;

-- ---------------------------------------------------------------------------
-- 1. The licence, recorded as data
-- ---------------------------------------------------------------------------
insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('vulncheck', 'VulnCheck KEV',
   'VulnCheck Service Terms (free Community tier)', 'https://www.vulncheck.com/service-terms',
   false, true, '2026-11-15',
   'Retired 15 Nov 2026 (migration 164). Service Terms rev. 20 Apr 2026 s7: Services Data may not '
     || 'be made available for free; s12: free offerings need a prominent attribution notice. '
     || 'Vigil is free and public, so none of it is shown. Written consent requested from VulnCheck.')
on conflict (source_id) do update set
  display_name = excluded.display_name,
  licence = excluded.licence,
  licence_url = excluded.licence_url,
  commercial_use = excluded.commercial_use,
  attribution_required = excluded.attribution_required,
  checked_on = excluded.checked_on,
  notes = excluded.notes,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. The undo: every VulnCheck row as it stood
-- ---------------------------------------------------------------------------
create table if not exists public.vulncheck_retired_rows (
  cve_id     text primary key,
  row        jsonb not null,
  retired_at timestamptz not null default now()
);

comment on table public.vulncheck_retired_rows is
  'Rows of vulnerabilities as VulnCheck left them, copied before migration 164 stripped them. '
  'Internal only: VulnCheck''s terms forbid making this data available for free.';

revoke all on public.vulncheck_retired_rows from anon, authenticated;
grant select on public.vulncheck_retired_rows to service_role;
alter table public.vulncheck_retired_rows enable row level security;

insert into public.vulncheck_retired_rows (cve_id, row)
select v.cve_id, to_jsonb(v)
from public.vulnerabilities v
where v.source = 'vulncheck-kev'
on conflict (cve_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Strip what VulnCheck supplied
-- ---------------------------------------------------------------------------
-- kev_date goes to null first, so sync_kev_columns (migration 102) does not set
-- is_kev back to true on the way through.
update public.vulnerabilities v set
  kev_date                = null,
  kev_date_added          = null,
  kev_due_date            = null,
  is_kev                  = false,
  exploited_in_wild       = false,
  ransomware_campaign_use = false,
  ransomware_use          = null,
  description             = null,
  title                   = null,
  metadata                = coalesce(v.metadata, '{}'::jsonb)
                              - 'title' - 'required_action' - 'xdb' - 'cwes'
                              - 'reported_exploitation' - 'exploit_sources',
  source                  = null
where v.source = 'vulncheck-kev';

-- ---------------------------------------------------------------------------
-- 4. A retired feed is not a failing one
-- ---------------------------------------------------------------------------
delete from public.feed_expectations where feed_id = 'vulncheck';

-- Check: nothing VulnCheck wrote is left flagged.
do $$
declare
  left_over integer;
  backed_up integer;
begin
  select count(*) into left_over from public.vulnerabilities where source = 'vulncheck-kev';
  select count(*) into backed_up from public.vulncheck_retired_rows;
  if left_over > 0 then
    raise exception '164: % vulncheck-kev rows still present', left_over;
  end if;
  raise notice '164: % VulnCheck rows backed up and stripped', backed_up;
end $$;

commit;
