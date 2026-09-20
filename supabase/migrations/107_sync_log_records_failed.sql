-- Migration: the column the ingestion log was always supposed to have
-- Reviewed: September 20, 2026
--
-- `sync_log` was created twice: once in 001 and again in 005, with 005 adding
-- `records_failed`. Because both use CREATE TABLE IF NOT EXISTS, the live table is
-- the 001 shape and the column never arrived. Every write that named it was
-- rejected by PostgREST with "Could not find the 'records_failed' column".
--
-- Nothing noticed, because until migration 101 nothing wrote per-feed rows and the
-- one row per run did not name the column. Found by running the new scheduler
-- against the live database before deploying it: ten feeds ingested correctly and
-- not one of them could record that it had.

ALTER TABLE sync_log
  ADD COLUMN IF NOT EXISTS records_failed INTEGER DEFAULT 0;

COMMENT ON COLUMN sync_log.records_failed IS
  'Records a run could not write. Defined in migration 005, first actually created here.';
