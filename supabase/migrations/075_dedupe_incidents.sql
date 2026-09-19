-- Migration: Remove duplicate incidents and prevent new ones
-- Applied: September 19, 2026 (live DB: 955,136 rows -> 44,762; 910,574 duplicates removed)
--
-- Why: the Cloudflare worker's ransomlook feed used a plain INSERT every hour, and
-- the feed returns the same recent posts each time, so each victim was stored many
-- times over (worst case 745 copies). Counts, trends and ESCALATING labels were all
-- inflated. The worker now checks for existing incidents before inserting.
--
-- A duplicate is the same (actor_id, victim_name, discovered_date), the same key the
-- ingestion scripts use. The earliest-created row is kept. At the time, no iocs,
-- campaign_incidents or incident_correlations rows referenced incidents.
--
-- How it was run on the live DB: duplicates were first copied to
-- archive.incidents_duplicates_20260919 (not exposed to the API; keep_id = the row
-- kept), then deleted in batches of 3,000 through the service role, because a single
-- DELETE of ~900k rows exceeded API timeouts. Requires idx_iocs_incident_id (074);
-- without it every delete scans the whole iocs table for the foreign key.
--
-- This file is the equivalent single-transaction version, safe to re-run.

SET statement_timeout = '30min';

CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS archive.incidents_duplicates_20260919 AS
SELECT i.*, NULL::uuid AS keep_id FROM public.incidents i WITH NO DATA;

WITH ranked AS (
  SELECT id,
         first_value(id) OVER w AS keep_id,
         row_number() OVER w AS rn
  FROM public.incidents
  WINDOW w AS (PARTITION BY actor_id, victim_name, discovered_date ORDER BY created_at NULLS LAST, id)
), archived AS (
  INSERT INTO archive.incidents_duplicates_20260919
  SELECT i.*, r.keep_id FROM public.incidents i JOIN ranked r ON r.id = i.id WHERE r.rn > 1
  RETURNING id
)
DELETE FROM public.incidents i USING archived a WHERE i.id = a.id;

-- Prevent duplicates from coming back. Ingestion inserts one row at a time or
-- checks first, so a collision just rejects that one duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_actor_victim_date
  ON public.incidents (actor_id, victim_name, discovered_date) NULLS NOT DISTINCT;

ANALYZE public.incidents;
RESET statement_timeout;
