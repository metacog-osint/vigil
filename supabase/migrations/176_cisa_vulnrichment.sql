-- 176. CISA's own judgment of exploitation, from Vulnrichment, kept apart from KEV
--
-- STATUS: applied 18 Nov 2026 21:05 UTC (as 176_cisa_vulnrichment). Backfill
-- loaded 21:50 UTC from commit 32a25ee: 49,731 rows (1,781 active, 47,950 poc),
-- cursor at 32a25ee. service_role holds the project's default seven privileges.
--
-- WHY
--
-- VulnCheck was retired on 15 Nov 2026 (164): its terms forbid free
-- redistribution. Tom asked for an independent "known exploited" signal built
-- from primary sources, CISA Vulnrichment first, PoC aggregators kept separate.
--
-- WHAT VULNRICHMENT IS
--
-- github.com/cisagov/vulnrichment, CC0 1.0 (LICENSE checked 18 Nov 2026).
-- CISA's ADP container ("CISA ADP Vulnrichment", shortName CISA-ADP) on CVE
-- records gives three SSVC decision points: Exploitation (none, poc, active),
-- Automatable (yes, no) and Technical Impact (partial, total), with the time
-- CISA assessed them, and a separate kev block when the CVE is in KEV.
-- Example, CVE-2024-3400: Exploitation active, Automatable yes, Technical
-- Impact total, assessed 2024-04-17, KEV dateAdded 2024-04-12.
--
-- So "Exploitation: active" with no kev block is CISA's judgment of active
-- exploitation for a CVE that is not in the catalog. That is the signal.
-- "poc" is CISA's judgment that a proof of concept is public, not a report of
-- exploitation, and is kept as its own value.
--
-- WHAT IS STORED
--
-- cisa_ssvc: one row per CVE, CISA's latest values as read from Vulnrichment.
-- The backfill (18 Nov 2026) loaded only CVEs marked active or poc; the hourly
-- job adds new active or poc CVEs and updates any CVE already held, including
-- a change back to none. No foreign key to vulnerabilities: CISA scores CVEs
-- Vigil does not hold, and those are the ones worth seeing.
--
-- cisa_vulnrichment_cursor: the Vulnrichment commit the hourly job has read
-- up to, so each run reads only the commits after it.
--
-- WHO SEES IT
--
-- Nobody outside the service role yet. Tom chose on 18 Nov 2026 to store it
-- and decide where it shows after seeing how many CVEs it adds beyond KEV.
-- Showing it later is a grant and a page, not a new load.
--
-- GRANTS
--
-- anon and authenticated: none. service_role: select, insert, update (the
-- cisa-vulnrichment Edge Function writes both tables over REST).

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('cisa-vulnrichment',
   'CISA Vulnrichment (SSVC decision points on CVE records)',
   'CC0 1.0 Universal',
   'https://github.com/cisagov/vulnrichment/blob/develop/LICENSE',
   true, false, '2026-11-18',
   'Public-domain dedication, so free public redistribution is allowed. Credited to CISA anyway. '
   'Only the SSVC decision points, their timestamp and the kev block''s dateAdded are taken. 176.')
on conflict (source_id) do nothing;

create table public.cisa_ssvc (
  cve_id text primary key check (cve_id ~ '^CVE-[0-9]{4}-[0-9]{4,}$'),
  exploitation text not null check (exploitation in ('none', 'poc', 'active')),
  automatable text check (automatable in ('yes', 'no')),
  technical_impact text check (technical_impact in ('partial', 'total')),
  ssvc_version text,
  assessed_at timestamptz,
  adp_updated_at timestamptz,
  kev_date_added date,
  source_commit text not null,
  fetched_at timestamptz not null default now()
);

comment on table public.cisa_ssvc is
  'CISA''s SSVC decision points per CVE, from Vulnrichment (CC0). exploitation is CISA''s judgment; '
  'kev_date_added is set only when CISA''s ADP container carries a kev block. 176.';
comment on column public.cisa_ssvc.assessed_at is 'The SSVC block''s own timestamp: when CISA assessed it.';
comment on column public.cisa_ssvc.adp_updated_at is 'providerMetadata.dateUpdated of the CISA ADP container.';
comment on column public.cisa_ssvc.source_commit is 'The Vulnrichment commit the row was read from.';

create index cisa_ssvc_exploitation_idx on public.cisa_ssvc (exploitation);

create table public.cisa_vulnrichment_cursor (
  id text primary key default 'develop' check (id = 'develop'),
  commit_sha text not null,
  committed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.cisa_vulnrichment_cursor is
  'The Vulnrichment develop commit the cisa-vulnrichment job has read up to. 176.';

revoke all on public.cisa_ssvc from anon, authenticated;
revoke all on public.cisa_vulnrichment_cursor from anon, authenticated;
grant select, insert, update on public.cisa_ssvc to service_role;
grant select, insert, update on public.cisa_vulnrichment_cursor to service_role;
alter table public.cisa_ssvc enable row level security;
alter table public.cisa_vulnrichment_cursor enable row level security;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('cisa-vulnrichment', 60, false,
   'CISA''s SSVC exploitation judgments from Vulnrichment into cisa_ssvc (176). '
   'Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
