-- Migration: searching within a country starts from the country
-- Drafted: September 20, 2026
--
-- 111 added a country filter to search_iocs as a predicate on top of the value
-- search, which is the wrong way round for the query people actually want: "what
-- is in Russia" means starting from the 1,845 indicators located there, not
-- scanning 568,510 values and asking each one where it lives.
--
-- It timed out. A broad term gives the trigram index nothing to match, so the scan
-- runs long and the location check runs per row on top of it.
--
-- The function now branches instead: with a country it drives off
-- idx_ioc_geo_country and narrows by value; without one it does what it did
-- before. Branching needs plpgsql - a single SQL statement leaves the planner to
-- guess which side is selective, and it guesses wrong on exactly the case that
-- matters.
--
-- A country on its own is now a valid search. Asking "which indicators sit in RU"
-- without also typing a value is the whole point of having located them.

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
BEGIN
  -- Neither a value nor a country is not a search.
  IF term = '' AND country IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH hits AS MATERIALIZED (
    SELECT i.*
    FROM iocs i
    WHERE
      CASE
        WHEN country IS NOT NULL THEN
          -- Driven from the country: the indicator ids come from ioc_geo's index.
          i.id IN (SELECT g.ioc_id FROM ioc_geo g WHERE g.country_code = country)
          AND (term = '' OR i.value = term OR i.value ILIKE '%' || term || '%')
        ELSE
          (i.value = term OR i.value ILIKE '%' || term || '%')
      END
      AND (type_filter IS NULL OR i.type = type_filter)
    LIMIT 2000
  )
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
  FROM hits h
  ORDER BY h.last_seen_at DESC NULLS LAST
  LIMIT capped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_iocs(text, text, int, text) TO anon, authenticated, service_role;
