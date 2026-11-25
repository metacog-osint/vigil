-- 188. CERT-FR's alerts, kept as CERT-FR's notices
--
-- STATUS: APPLIED 19 Nov 2026, 04:22 UTC, as 188_certfr_alerts (version
-- 20261119042256). Loaded by the function itself at 04:33 UTC: all 401 alerts.
--
-- WHY
--
-- The licence check of 19 Nov 2026 passed CERT-FR (Licence Ouverte 2.0, the
-- French government's open licence: free reuse, commercial included, with the
-- source and date credited). Its alerts ("alertes") are its "act now" notices:
-- most concern a vulnerability being exploited, some an incident or a campaign
-- with no CVE. The handoff of 19 Nov 2026 asked for them as CISA-style notices,
-- not as exploitation claims, so they are stored as CERT-FR published them and
-- no exploitation label is derived from them.
--
-- WHAT THERE IS
--
-- 401 alerts from CERTA-2000-ALE-003 to CERTFR-2026-ALE-012, read 19 Nov 2026
-- from cert.cyber.gouv.fr (www.cert.ssi.gouv.fr redirects there). 269 name at
-- least one CVE, 502 CVEs in all; 218 of those are in KEV and Vigil holds no
-- row at all for 284. The title, summary and risks are in French and are kept
-- in French; any translation shown later is labelled as one.
--
-- WHAT IS STORED
--
-- certfr_alerts: one row per alert, with its CVEs as an array, the vendors it
-- names, its first publication and latest revision, the date CERT-FR closed it
-- (null while open), the summary as plain text and the alert's JSON as served.
-- The daily job re-reads an alert whenever CERT-FR's list shows a newer
-- revision. Nothing is deleted.
--
-- WHO SEES IT
--
-- Nobody outside the service role yet (as 176 and
-- 187). Never a KEV label.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('certfr-alerts',
   'CERT-FR alerts (alertes de sécurité, ANSSI)',
   'Licence Ouverte 2.0 (Etalab)',
   'https://cert.cyber.gouv.fr/mentions-legales/',
   true, true, '2026-11-19',
   'The site''s legal notice places its content under the Licence Ouverte 2.0: reuse, commercial '
   'included, crediting CERT-FR and the date of last update. Alerts are CERT-FR''s notices, kept in '
   'French. 188.')
on conflict (source_id) do nothing;

create table public.certfr_alerts (
  reference text primary key check (reference ~ '^CERT(FR|A)-[0-9]{4}-ALE-[0-9]{3,}$'),
  title text not null,
  url text not null,
  first_published date,
  last_revision date,
  closed_at date,
  cve_ids text[] not null default '{}',
  vendors text[] not null default '{}',
  risks text[] not null default '{}',
  summary text,
  raw jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.certfr_alerts is
  'CERT-FR''s alerts as it published them (Licence Ouverte 2.0), in French. CERT-FR''s notices, '
  'never a KEV label or Vigil''s claim of exploitation. 188.';
comment on column public.certfr_alerts.closed_at is 'The date CERT-FR closed the alert; null while it is open.';
comment on column public.certfr_alerts.raw is 'The alert''s JSON as cert.cyber.gouv.fr served it.';

create index certfr_alerts_cve_idx on public.certfr_alerts using gin (cve_ids);
create index certfr_alerts_published_idx on public.certfr_alerts (first_published desc);

revoke all on public.certfr_alerts from anon, authenticated;
grant select, insert, update on public.certfr_alerts to service_role;
alter table public.certfr_alerts enable row level security;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('certfr-alerts', 1440, false,
   'CERT-FR''s alerts into certfr_alerts (188). Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
