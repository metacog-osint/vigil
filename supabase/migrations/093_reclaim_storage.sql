-- Migration: reclaim storage held by data nothing reads
-- Applied: September 20, 2026, with the owner's approval for each item
--
-- The database had grown to 4,161 MB of the 8 GB the plan includes, and three of the
-- four largest objects held nothing anyone could read. No observation was deleted:
-- incidents, indicators, sightings and the changelog are untouched.
--
--   actor_similarity      959 MB -> 5 MB   (migration 092: 99.8% of rows scored below
--                                           the reader's floor and could never be
--                                           returned; the view now stops at the floor)
--   alert_queue           415 MB -> 29 MB  (this migration)
--   archive duplicates    462 MB -> gone   (this migration)
--
-- Result: 2,438 MB, 30% of the included disk.

-- 913,149 alerts sat pending, none ever delivered: the processor stopped when the
-- GitHub workflows were disabled for inactivity in May, and a sample showed ~99%
-- referenced incidents that migration 075 removed as duplicates. Anything still
-- pending after 30 days will never be sent - the digests are daily and weekly - so
-- the queue keeps only the last 30 days. Alerts from the last 30 days are kept.
DELETE FROM public.alert_queue
WHERE status = 'pending' AND created_at < now() - interval '30 days';

-- The undo copy from the duplicate removal, kept since 2026-09-19. The dedupe has
-- been verified against the live incident counts since, so the copy is released.
-- This is the point of no return for that undo.
DROP TABLE IF EXISTS archive.incidents_duplicates_20260919;

-- Deleted rows keep their pages until the table is rewritten; run outside any
-- transaction, as VACUUM cannot run inside one:
--   VACUUM FULL public.alert_queue;
