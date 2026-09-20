-- Migration: stop materialising similarity rows nothing can read
-- Drafted: September 20, 2026
--
-- actor_similarity cross-joins every pair of actors that share an actor_type, which
-- is 4.18M rows and 959 MB - a quarter of the database. Its only reader,
-- get_similar_actors_precomputed(), filters to similarity_score >= 25, and 4,167,036
-- of those rows score 20: "both are ransomware groups" and nothing else in common.
-- 99.8% of the table can never be returned.
--
-- The view now keeps only rows that clear the reader's floor. That is 9,983 rows and
-- no behaviour change at all - the same pairs come back, from a table three orders of
-- magnitude smaller.
--
-- Two fixes carried along:
--   * REFRESH MATERIALIZED VIEW CONCURRENTLY (migration 070) needs a unique index and
--     never had one, so the concurrent refresh would have failed on first use.
--   * The view was readable directly through the API. Access goes through the
--     function, so the direct grant is withdrawn.

DROP MATERIALIZED VIEW IF EXISTS public.actor_similarity;

CREATE MATERIALIZED VIEW public.actor_similarity AS
SELECT * FROM (
  SELECT
    a1.id AS actor_a_id,
    a1.name AS actor_a_name,
    a2.id AS actor_b_id,
    a2.name AS actor_b_name,
    (
      CASE WHEN a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL THEN 20 ELSE 0 END +
      LEAST(25, COALESCE(array_length(
        ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)), 1
      ) * 5, 0)) +
      LEAST(20, COALESCE(array_length(
        ARRAY(SELECT UNNEST(a1.target_countries) INTERSECT SELECT UNNEST(a2.target_countries)), 1
      ) * 4, 0)) +
      LEAST(25, COALESCE(array_length(
        ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)), 1
      ) * 5, 0)) +
      CASE WHEN a1.trend_status = 'ESCALATING' AND a2.trend_status = 'ESCALATING' THEN 10 ELSE 0 END
    ) AS similarity_score,
    jsonb_build_object(
      'same_type', CASE WHEN a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL THEN true ELSE false END,
      'shared_sectors', ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)),
      'shared_countries', ARRAY(SELECT UNNEST(a1.target_countries) INTERSECT SELECT UNNEST(a2.target_countries)),
      'shared_ttps', ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)),
      'both_escalating', CASE WHEN a1.trend_status = 'ESCALATING' AND a2.trend_status = 'ESCALATING' THEN true ELSE false END
    ) AS factors
  FROM threat_actors a1
  CROSS JOIN threat_actors a2
  WHERE a1.id < a2.id
    AND (
      (a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL)
      OR array_length(ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)), 1) > 0
      OR array_length(ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)), 1) > 0
    )
) scored
-- The reader's floor: anything below this is stored and never served.
WHERE scored.similarity_score >= 25;

CREATE UNIQUE INDEX IF NOT EXISTS uq_actor_similarity_pair
  ON public.actor_similarity (actor_a_id, actor_b_id);
CREATE INDEX IF NOT EXISTS idx_actor_similarity_score ON public.actor_similarity (similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_actor_similarity_a ON public.actor_similarity (actor_a_id);
CREATE INDEX IF NOT EXISTS idx_actor_similarity_b ON public.actor_similarity (actor_b_id);

REVOKE SELECT ON public.actor_similarity FROM anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.actor_similarity IS
  'Actor pairs scoring at or above the reader floor of 25; read through get_similar_actors_precomputed()';
