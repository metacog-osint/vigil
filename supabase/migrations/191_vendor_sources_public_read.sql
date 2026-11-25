-- 191. Vendors' and CERT-FR's own words readable by the site (the vulnerability panel)
--
-- STATUS: applied 19 Nov 2026, about 15:45 UTC, after vigil#10 merged.
--
-- WHY
--
-- 187 and 188 stored Android's and Mozilla's exploitation statements and
-- CERT-FR's alerts closed to the public roles.
-- From 19 Nov 2026 they show on the vulnerability panel only:
-- each source its own line in its own words, with its link and credit, never a
-- KEV label; nothing on /api/feed until about a week of clean daily runs. The
-- three Android CVEs that KEV does not list (CVE-2020-0500, CVE-2022-20415,
-- CVE-2023-21096) are not held in `vulnerabilities`, so the Vulnerabilities page
-- lists vendor-reported exploitation that KEV does not carry.
--
-- WHAT IS OPENED
--
-- vendor_exploit_statements: SELECT for anon and authenticated, every kind but
-- 'unclassified' (a wording no person has read is never shown).
-- certfr_alerts: SELECT on its columns but `raw`, the alert's JSON as served.
-- vendor_documents_read stays closed: it is the job's bookkeeping.
-- Nothing is writable by the public roles.

begin;

grant select on public.vendor_exploit_statements to anon, authenticated;
drop policy if exists vendor_exploit_statements_read on public.vendor_exploit_statements;
create policy vendor_exploit_statements_read on public.vendor_exploit_statements
  for select to anon, authenticated
  using (kind <> 'unclassified');

grant select (reference, title, url, first_published, last_revision, closed_at, cve_ids, vendors,
              risks, summary, first_seen_at, last_seen_at)
  on public.certfr_alerts to anon, authenticated;
drop policy if exists certfr_alerts_read on public.certfr_alerts;
create policy certfr_alerts_read on public.certfr_alerts
  for select to anon, authenticated
  using (true);

commit;
