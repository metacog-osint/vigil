-- Migration: indicator search carries the location it already knows
-- Drafted: September 20, 2026
--
-- 097 located 56,404 indicators across 150 countries, and nothing shows it. The
-- search function returns the group an indicator belongs to and whether the address
-- is sanctioned, but not where the infrastructure sits - which is the part a reader
-- can act on when deciding whether a C2 in their own country deserves a phone call.
--
-- The location is one lookup on ioc_geo's primary key, so it costs a join per
-- returned row rather than a scan. p_country narrows the search to one country,
-- which is the query the data supports and the page could not ask.
--
-- The return type gains a column, so the old definition has to be dropped first.

DROP FUNCTION IF EXISTS public.search_iocs(text, text, int);

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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  WITH term AS (
    SELECT btrim(coalesce(p_value, '')) AS t,
           nullif(upper(btrim(coalesce(p_country, ''))), '') AS country
  ),
  -- Bounded candidate set. MATERIALIZED keeps the planner from folding this into
  -- the ORDER BY above it and reaching for the last_seen_at index again.
  hits AS MATERIALIZED (
    SELECT i.*
    FROM iocs i, term
    WHERE term.t <> ''
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
      AND (i.value = term.t OR i.value ILIKE '%' || term.t || '%')
      AND (term.country IS NULL
           OR EXISTS (SELECT 1 FROM ioc_geo g
                      WHERE g.ioc_id = i.id AND g.country_code = term.country))
    LIMIT 2000
  )
  SELECT h.id, h.type, h.value, h.malware_family, h.confidence,
         h.first_seen, h.last_seen, h.last_seen_at,
         h.source, h.source_url, h.tags, h.metadata,
         h.reputation_score, h.reputation_level, h.sighting_count,
         (SELECT array_agg(DISTINCT l.actor_name ORDER BY l.actor_name)
            FROM ioc_actor_links l WHERE l.ioc_id = h.id) AS actor_names,
         (SELECT s.entity_name FROM sanctioned_addresses s
           WHERE lower(s.address) = lower(h.value) AND s.delisted_at IS NULL
           LIMIT 1) AS sanctioned_by,
         (SELECT g.country_code FROM ioc_geo g WHERE g.ioc_id = h.id) AS country_code
  FROM hits h
  ORDER BY h.last_seen_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;

GRANT EXECUTE ON FUNCTION public.search_iocs(text, text, int, text) TO anon, authenticated, service_role;
