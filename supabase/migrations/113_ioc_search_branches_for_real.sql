-- Migration: the country branch has to be a branch, not a CASE
-- Drafted: September 20, 2026
--
-- 112 put the two search shapes in one statement behind a CASE and still timed
-- out. A CASE in WHERE is opaque to the planner: it cannot see that one arm is an
-- indexed lookup on 1,845 rows and the other is a trigram match over 568,510, so
-- it plans one shape for both and picks the wrong one for whichever it guesses.
--
-- The candidate ids are now gathered in an IF/ELSE - two separate statements, each
-- planned on its own - and the row detail is fetched once by id. Measured after:
-- a country-only search is well inside the anonymous timeout rather than over it.

DROP FUNCTION IF EXISTS public.search_iocs(text, text, int, text);

CREATE FUNCTION public.search_iocs(
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
    -- Driven from idx_ioc_geo_country: start with what is located there.
    SELECT array_agg(c.id) INTO ids FROM (
      SELECT i.id
      FROM ioc_geo g
      JOIN iocs i ON i.id = g.ioc_id
      WHERE g.country_code = country
        AND (term = '' OR i.value = term OR i.value ILIKE '%' || term || '%')
        AND (type_filter IS NULL OR i.type = type_filter)
      ORDER BY i.last_seen_at DESC NULLS LAST
      LIMIT capped
    ) c;
  ELSE
    -- Driven from the trigram index, bounded before ordering so the planner
    -- cannot walk the last_seen_at index and discard rows (migration 090).
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
