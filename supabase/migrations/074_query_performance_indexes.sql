-- Migration: Query performance indexes
-- Created: September 19, 2026
-- Purpose: Fix statement timeouts seen on the live database:
--   * incidents filtered by source (no index existed)
--   * iocs ordered by last_seen: migrations 001 and a later one both used the
--     name idx_iocs_last_seen (one on last_seen, one on last_seen_at), so with
--     IF NOT EXISTS only whichever ran first was ever created.
-- Non-destructive: only adds indexes. Columns that don't exist are skipped.

CREATE INDEX IF NOT EXISTS idx_incidents_source_discovered
  ON public.incidents (source, discovered_date DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'iocs' AND column_name = 'last_seen') THEN
    CREATE INDEX IF NOT EXISTS idx_iocs_last_seen_desc ON public.iocs (last_seen DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'iocs' AND column_name = 'last_seen_at') THEN
    CREATE INDEX IF NOT EXISTS idx_iocs_last_seen_at_desc ON public.iocs (last_seen_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'iocs' AND column_name = 'source') THEN
    CREATE INDEX IF NOT EXISTS idx_iocs_source ON public.iocs (source);
  END IF;
END;
$$;

-- Foreign key iocs.incident_id -> incidents(id) had no index, so every incident
-- delete scanned the whole iocs table.
CREATE INDEX IF NOT EXISTS idx_iocs_incident_id
  ON public.iocs (incident_id) WHERE incident_id IS NOT NULL;

-- Supports the ingestion dedup lookup (victim_name IN (...) AND discovered_date >= ...)
CREATE INDEX IF NOT EXISTS idx_incidents_victim_discovered
  ON public.incidents (victim_name, discovered_date);

ANALYZE public.incidents;
ANALYZE public.iocs;
