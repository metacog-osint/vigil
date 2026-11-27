-- 202: test rows in live tables are marked, not deleted
--
-- Four iocs rows with source 'debug-test' hold 192.0.2.1 to 192.0.2.4, the
-- TEST-NET-1 block RFC 5737 reserves for documentation, created on 17 January
-- 2026 while the worker was being built. Two sync_log rows from the same day
-- carry the same source. They are not observations of anything.
--
-- WHAT THIS DOES
--
-- Adds excluded_reason (text, null for a real row) to iocs and sync_log and
-- fills it for those rows. Nothing is deleted, and the iocs change is recorded
-- in entity_changelog by its trigger as any other update is.
--
-- Adding a nullable column with no default is a catalog change only: no table
-- rewrite on iocs (about 1.1 GB).
--
-- WHAT IT DOES NOT DO
--
-- The public read policies are unchanged, so the rows still show where they
-- showed. Hiding them through iocs_public_read would add a column test to every
-- read of a 750,000-row table, including the exact counts that today can use an
-- index-only scan; readers that count or list can filter on excluded_reason
-- instead. No grant changes: both columns are read with their tables.

alter table public.iocs add column if not exists excluded_reason text;
alter table public.sync_log add column if not exists excluded_reason text;

comment on column public.iocs.excluded_reason is
  'Why this row is not an observation (a test row, for example); null for a real row. Marked, never deleted (202).';
comment on column public.sync_log.excluded_reason is
  'Why this run is not a real feed run (a test row, for example); null for a real row (202).';

update public.iocs
   set excluded_reason = 'test row: TEST-NET-1 documentation address (RFC 5737), source debug-test'
 where source = 'debug-test'
   and type = 'ip'
   and value in ('192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4')
   and excluded_reason is null;

update public.sync_log
   set excluded_reason = 'test row: source debug-test'
 where source = 'debug-test'
   and excluded_reason is null;
