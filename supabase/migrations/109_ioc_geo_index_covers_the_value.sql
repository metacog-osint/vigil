-- Migration: the index that finds unlocated indicators carries what it reads
-- Reviewed: September 20, 2026
--
-- Third attempt at this, and the first one measured rather than reasoned about.
-- 106 moved the address parsing out of the scan; 108 stopped counting the table
-- to report that there was nothing to do. Both were real costs. Neither was the
-- one that mattered, and a call with zero rows to place still took 15 seconds.
--
-- EXPLAIN says where it goes:
--
--   Limit (actual time=5313.830..5313.831 rows=0)
--     -> Merge Anti Join (actual time=5313.829..5313.829 rows=0)
--          -> Index Scan using idx_iocs_ip_like on iocs
--               (actual time=0.814..5113.929 rows=56431)
--               Buffers: shared hit=56640
--          -> Index Only Scan using ioc_geo_pkey on ioc_geo
--               (actual time=0.016..179.399 rows=56431)
--
-- The anti-join is 179 ms. The scan that feeds it is 5,114 ms, and the buffer
-- count gives it away: 56,640 buffers for 56,431 rows, one heap fetch each. The
-- index 106 added covers (id), but the query also selects `value`, so every row
-- has to be fetched from the table to read a column the index does not carry.
--
-- INCLUDE (value) makes it an index-only scan. Same plan, no heap.

DROP INDEX IF EXISTS idx_iocs_ip_like;

CREATE INDEX idx_iocs_ip_like
  ON public.iocs (id) INCLUDE (value)
  WHERE type IN ('ip', 'cidr');

COMMENT ON INDEX idx_iocs_ip_like IS
  'Feeds the anti-join in resolve_ioc_geo. INCLUDE (value) keeps it index-only: without it the scan costs one heap fetch per indicator, which is the whole runtime.';

ANALYZE public.iocs;
