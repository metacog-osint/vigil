-- 199. Say why circl-sightings has no per-run row floor
--
-- STATUS: APPLIED 25 November 2026 (20261125182937), exactly as written.
--
-- WHY
--
-- 197 gave every feed without a floor a row_floor_note: null means "not
-- watched" (163). 194 was written before 197 and added the circl-sightings
-- feed_expectations row with no note, so it reads as not watched.
--
-- No floor: during the history walk a run reads up to 10 pages; once caught up
-- it re-reads today only, and a run with no new sightings is ordinary.
--
-- Touches one row, only while its note is still null. No new object, so no grants.

update public.feed_expectations
   set row_floor_note = 'Once caught up, a run re-reads today only; 0 sightings is an ordinary run.'
 where feed_id = 'circl-sightings'
   and min_rows_per_run is null
   and row_floor_note is null;
