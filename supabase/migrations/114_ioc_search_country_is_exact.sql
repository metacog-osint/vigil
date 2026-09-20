-- Migration: browsing a country's indicators, exactly and within the timeout
-- Drafted: September 20, 2026
--
-- Supersedes the function 113 installed. Three things were still wrong for large
-- countries, and only the third was where the time actually went:
--
--   1. Ordering by recency inside a country made the planner walk
--      idx_iocs_last_seen_at_desc looking for rows that happened to be in that
--      country - 0.3% of the table for RU. The country's ids are now collected
--      first, in a MATERIALIZED CTE, before anything is ordered.
--
--   2. Resolving 12,367 ids to their last_seen_at needed the heap. A covering
--      index answers it from the index alone.
--
--   3. Even then it did 5,279 heap fetches, because the visibility map was stale
--      after a day of writes. VACUUM (ANALYZE) on iocs fixed that: the same
--      candidate query went from 5.4 seconds to 54 milliseconds with zero heap
--      fetches. That is maintenance, not schema, so it is noted here rather than
--      run by this migration - autovacuum handles it in the ordinary course.
--
-- Measured after, as an anonymous user: US 0.57s, CN 1.0s, RU 0.64s, DE 0.48s,
-- against a 3-second statement timeout. Every country is exact - no sampling, no
-- approximate ordering.

CREATE INDEX IF NOT EXISTS idx_iocs_id_last_seen
  ON public.iocs (id) INCLUDE (last_seen_at);

COMMENT ON INDEX public.idx_iocs_id_last_seen IS
  'Lets a set of indicator ids be ordered by recency without touching the table';

CREATE OR REPLACE FUNCTION public.search_iocs(
  p_value text,
  p_type text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_country text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, type text, value text, malware_family text, confidence text,
  first_seen timestamptz, last_seen timestamptz, last_seen_at timestamptz,
  source text, source_url text, tags text[], metadata jsonb,
  reputation_score int, reputation_level text, sighting_count int,
  actor_names text[], sanctioned_by text, country_code text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  term text := btrim(coalesce(p_value, ''));
  country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  type_filter text := nullif(btrim(coalesce(p_type, '')), '');
  capped int := greatest(1, least(coalesce(p_limit, 100), 500));
  ids uuid[];
BEGIN
  -- Neither a value nor a country is not a search.
  IF term = '' AND country IS NULL THEN
    RETURN;
  END IF;

  IF country IS NOT NULL THEN
    -- The country's indicators are collected before anything is ordered.
    SELECT array_agg(c.id) INTO ids FROM (
      WITH located AS MATERIALIZED (
        SELECT g.ioc_id FROM ioc_geo g WHERE g.country_code = country
      )
      SELECT i.id
      FROM located l
      JOIN iocs i ON i.id = l.ioc_id
      WHERE (term = '' OR i.value = term OR i.value ILIKE '%' || term || '%')
        AND (type_filter IS NULL OR i.type = type_filter)
      ORDER BY i.last_seen_at DESC NULLS LAST
      LIMIT capped
    ) c;
  ELSE
    -- Bounded before ordering, so the planner cannot walk the last_seen_at index
    -- and discard rows looking for matches (migration 090).
    SELECT array_agg(c.id) INTO ids FROM (
      SELECT b.id FROM (
        SELECT i.id, i.last_seen_at
        FROM iocs i
        WHERE (i.value = term OR i.value ILIKE '%' || term || '%')
          AND (type_filter IS NULL OR i.type = type_filter)
        LIMIT 2000
      ) b
      ORDER BY b.last_seen_at DESC NULLS LAST
      LIMIT capped
    ) c;
  END IF;

  IF ids IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT h.id, h.type, h.value, h.malware_family, h.confidence,
         h.first_seen, h.last_seen, h.last_seen_at,
         h.source, h.source_url, h.tags, h.metadata,
         h.reputation_score, h.reputation_level, h.sighting_count,
         (SELECT array_agg(DISTINCT l.actor_name ORDER BY l.actor_name)
            FROM ioc_actor_links l WHERE l.ioc_id = h.id),
         (SELECT s.entity_name FROM sanctioned_addresses s
           WHERE lower(s.address) = lower(h.value) AND s.delisted_at IS NULL
           LIMIT 1),
         (SELECT g.country_code FROM ioc_geo g WHERE g.ioc_id = h.id)
  FROM iocs h
  WHERE h.id = ANY (ids)
  ORDER BY h.last_seen_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_iocs(text, text, int, text) TO anon, authenticated, service_role;
