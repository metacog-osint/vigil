-- Migration: fast, predictable IOC search
-- Drafted: September 20, 2026
--
-- The IOC search page ran `value ilike '%term%' order by last_seen_at desc limit 100`
-- over 568k rows. Two things were wrong with that:
--
--   1. No index could serve the substring match, so every search was a sequential
--      scan. Anonymous users get a 3s statement timeout, so searches simply failed.
--   2. Even with a trigram index, the planner preferred walking the last_seen_at
--      index and filtering - it estimates 5,743 matches for '%bc1q%' where there are
--      354, so it expects to find 100 quickly. It discarded 560,469 rows instead:
--      28.7 seconds measured.
--
-- A GIN trigram index fixes the first. The second is a planner misestimate that no
-- amount of statistics reliably fixes, so the ordering is fenced: candidates are
-- collected first, bounded, and only then sorted by recency. The search returns in
-- well under the anonymous timeout regardless of how common the pattern is.
--
-- The function also answers, in the same round trip, the two questions a user has
-- about an indicator: which tracked group it belongs to, and whether the address is
-- OFAC-designated. SECURITY INVOKER, so row-level security still applies.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_iocs_value_trgm
  ON public.iocs USING gin (value extensions.gin_trgm_ops);

DROP FUNCTION IF EXISTS public.search_iocs(text, text, int);

CREATE FUNCTION public.search_iocs(p_value text, p_type text DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, type text, value text, malware_family text, confidence text,
  first_seen timestamptz, last_seen timestamptz, last_seen_at timestamptz,
  source text, source_url text, tags text[], metadata jsonb,
  reputation_score int, reputation_level text, sighting_count int,
  actor_names text[], sanctioned_by text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  WITH term AS (
    SELECT btrim(coalesce(p_value, '')) AS t
  ),
  -- Bounded candidate set. MATERIALIZED keeps the planner from folding this into
  -- the ORDER BY above it and reaching for the last_seen_at index again.
  hits AS MATERIALIZED (
    SELECT i.*
    FROM iocs i, term
    WHERE term.t <> ''
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
      AND (i.value = term.t OR i.value ILIKE '%' || term.t || '%')
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
           LIMIT 1) AS sanctioned_by
  FROM hits h
  ORDER BY h.last_seen_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;

GRANT EXECUTE ON FUNCTION public.search_iocs(text, text, int) TO anon, authenticated, service_role;
