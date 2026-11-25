-- 177. CISA's SSVC judgments readable by the public site and /api/feed
--
-- STATUS: APPLIED 18 Nov 2026, 23:22 UTC, as 177_cisa_ssvc_public_read
-- (version 20261118232239). Written 18 November 2026.
--
-- 176 stored CISA's SSVC decision points from Vulnrichment (CC0 1.0) in
-- cisa_ssvc with no public grants: stored first, shown nowhere. From
-- 18 Nov 2026 they show:
--
--   /api/feed   "CISA's ADP assessment of <CVE>: exploitation active
--               (assessed <date>)", marked "not in CISA's KEV catalog" where
--               Vigil's copy of the catalog does not list the CVE. Never a KEV
--               label: KEV columns stay CISA's catalog's alone (164, 176).
--   site        the same line on the vulnerability panel, with Automatable
--               and Technical Impact.
--
-- Both read with the anonymous key, so anon and authenticated get SELECT on
-- cisa_ssvc. The data is CC0, so free public redistribution is allowed
-- (source_licences row cisa-vulnrichment). The cursor stays internal. Nothing
-- here writes; the cisa-vulnrichment Edge Function stays the only writer.
--
-- Measured live 18 Nov 2026, about 23:30 UTC: 49,731 rows (poc 47,950, active
-- 1,781; 176's backfill stored no "none" rows). Active with assessed_at in the
-- last 7 days: 3, all in KEV. Active and not in KEV: 2 (CVE-2022-21894,
-- CVE-2023-24932, assessed 18 Jul 2024).
--
-- The index serves /api/feed's window: active rows by assessed_at.

begin;

grant select on public.cisa_ssvc to anon, authenticated;

create policy cisa_ssvc_read on public.cisa_ssvc
  for select to anon, authenticated using (true);

create index if not exists cisa_ssvc_active_assessed_idx
  on public.cisa_ssvc (assessed_at desc)
  where exploitation = 'active';

commit;
