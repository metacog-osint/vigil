-- =====================================================
-- Advanced Correlation System Migration
-- Phase 4: Advanced Analytics
-- =====================================================

-- ============================================================================
-- SECTION 1: ACTOR SIMILARITY SCORING (MATERIALIZED)
-- ============================================================================

-- Pre-compute actor similarity for fast queries
DROP MATERIALIZED VIEW IF EXISTS actor_similarity;
CREATE MATERIALIZED VIEW actor_similarity AS
SELECT
  a1.id AS actor_a_id,
  a1.name AS actor_a_name,
  a2.id AS actor_b_id,
  a2.name AS actor_b_name,
  -- Similarity factors
  (
    -- Same actor type: 20 points
    CASE WHEN a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL THEN 20 ELSE 0 END +
    -- Sector overlap: 5 points per shared sector (max 25)
    LEAST(25, COALESCE(array_length(
      ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)), 1
    ) * 5, 0)) +
    -- Country overlap: 4 points per shared country (max 20)
    LEAST(20, COALESCE(array_length(
      ARRAY(SELECT UNNEST(a1.target_countries) INTERSECT SELECT UNNEST(a2.target_countries)), 1
    ) * 4, 0)) +
    -- TTP overlap: 5 points per shared technique (max 25)
    LEAST(25, COALESCE(array_length(
      ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)), 1
    ) * 5, 0)) +
    -- Both escalating: 10 bonus points
    CASE WHEN a1.trend_status = 'ESCALATING' AND a2.trend_status = 'ESCALATING' THEN 10 ELSE 0 END
  ) AS similarity_score,
  -- Store factors for explanation
  jsonb_build_object(
    'same_type', CASE WHEN a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL THEN true ELSE false END,
    'shared_sectors', ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)),
    'shared_countries', ARRAY(SELECT UNNEST(a1.target_countries) INTERSECT SELECT UNNEST(a2.target_countries)),
    'shared_ttps', ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)),
    'both_escalating', CASE WHEN a1.trend_status = 'ESCALATING' AND a2.trend_status = 'ESCALATING' THEN true ELSE false END
  ) AS factors
FROM threat_actors a1
CROSS JOIN threat_actors a2
WHERE a1.id < a2.id  -- Avoid duplicates and self-comparison
  AND a1.id != a2.id
  -- Only include pairs with some similarity
  AND (
    (a1.actor_type = a2.actor_type AND a1.actor_type IS NOT NULL)
    OR array_length(ARRAY(SELECT UNNEST(a1.target_sectors) INTERSECT SELECT UNNEST(a2.target_sectors)), 1) > 0
    OR array_length(ARRAY(SELECT UNNEST(a1.ttps) INTERSECT SELECT UNNEST(a2.ttps)), 1) > 0
  );

CREATE INDEX IF NOT EXISTS idx_actor_similarity_score ON actor_similarity(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_actor_similarity_a ON actor_similarity(actor_a_id);
CREATE INDEX IF NOT EXISTS idx_actor_similarity_b ON actor_similarity(actor_b_id);

-- ============================================================================
-- SECTION 2: TECHNIQUE CO-OCCURRENCE ANALYSIS
-- ============================================================================

-- Find techniques that appear together
DROP MATERIALIZED VIEW IF EXISTS technique_cooccurrence;
CREATE MATERIALIZED VIEW technique_cooccurrence AS
SELECT
  at1.technique_id AS technique_a_id,
  t1.name AS technique_a_name,
  t1.tactics AS technique_a_tactics,
  at2.technique_id AS technique_b_id,
  t2.name AS technique_b_name,
  t2.tactics AS technique_b_tactics,
  COUNT(DISTINCT at1.actor_id) AS shared_actor_count,
  array_agg(DISTINCT ta.name ORDER BY ta.name) AS actors_using_both
FROM actor_techniques at1
JOIN actor_techniques at2 ON at1.actor_id = at2.actor_id AND at1.technique_id < at2.technique_id
JOIN techniques t1 ON at1.technique_id = t1.id
JOIN techniques t2 ON at2.technique_id = t2.id
JOIN threat_actors ta ON at1.actor_id = ta.id
GROUP BY at1.technique_id, t1.name, t1.tactics, at2.technique_id, t2.name, t2.tactics
HAVING COUNT(DISTINCT at1.actor_id) >= 2
ORDER BY shared_actor_count DESC;

CREATE INDEX IF NOT EXISTS idx_technique_cooccurrence_count ON technique_cooccurrence(shared_actor_count DESC);
CREATE INDEX IF NOT EXISTS idx_technique_cooccurrence_a ON technique_cooccurrence(technique_a_id);
CREATE INDEX IF NOT EXISTS idx_technique_cooccurrence_b ON technique_cooccurrence(technique_b_id);

-- ============================================================================
-- SECTION 3: IOC MULTI-SOURCE CONFIDENCE
-- ============================================================================

-- Track IOC sources for confidence scoring
CREATE TABLE IF NOT EXISTS ioc_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_id UUID REFERENCES iocs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(ioc_id, source)
);

CREATE INDEX IF NOT EXISTS idx_ioc_sources_ioc ON ioc_sources(ioc_id);
CREATE INDEX IF NOT EXISTS idx_ioc_sources_source ON ioc_sources(source);

-- Computed confidence view based on multi-source correlation
DROP VIEW IF EXISTS ioc_confidence;
CREATE VIEW ioc_confidence AS
SELECT
  i.id,
  i.value,
  i.type,
  i.malware_family,
  i.confidence AS original_confidence,
  COUNT(DISTINCT s.source) AS source_count,
  CASE
    WHEN COUNT(DISTINCT s.source) >= 3 THEN 'high'
    WHEN COUNT(DISTINCT s.source) = 2 THEN 'medium'
    ELSE COALESCE(i.confidence, 'low')
  END AS computed_confidence,
  array_agg(DISTINCT s.source ORDER BY s.source) FILTER (WHERE s.source IS NOT NULL) AS sources,
  MIN(s.first_seen) AS first_seen_any_source,
  MAX(s.last_seen) AS last_seen_any_source
FROM iocs i
LEFT JOIN ioc_sources s ON i.id = s.ioc_id
GROUP BY i.id, i.value, i.type, i.malware_family, i.confidence;

-- ============================================================================
-- SECTION 4: SECTOR-TECHNIQUE CORRELATION VIEW
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS sector_technique_correlation;
CREATE MATERIALIZED VIEW sector_technique_correlation AS
WITH actor_sectors AS (
  SELECT
    ta.id AS actor_id,
    ta.name AS actor_name,
    UNNEST(ta.target_sectors) AS sector
  FROM threat_actors ta
  WHERE ta.target_sectors IS NOT NULL AND array_length(ta.target_sectors, 1) > 0
),
actor_techs AS (
  SELECT
    at.actor_id,
    t.id AS technique_id,
    t.name AS technique_name,
    t.tactics
  FROM actor_techniques at
  JOIN techniques t ON at.technique_id = t.id
)
SELECT
  asec.sector,
  at.technique_id,
  at.technique_name,
  at.tactics,
  COUNT(DISTINCT asec.actor_id) AS actor_count,
  array_agg(DISTINCT asec.actor_name ORDER BY asec.actor_name) AS actors
FROM actor_sectors asec
JOIN actor_techs at ON asec.actor_id = at.actor_id
GROUP BY asec.sector, at.technique_id, at.technique_name, at.tactics
HAVING COUNT(DISTINCT asec.actor_id) >= 2
ORDER BY actor_count DESC;

CREATE INDEX IF NOT EXISTS idx_sector_tech_sector ON sector_technique_correlation(sector);
CREATE INDEX IF NOT EXISTS idx_sector_tech_count ON sector_technique_correlation(actor_count DESC);

-- ============================================================================
-- SECTION 5: GEOGRAPHIC TARGETING MATRIX
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS geographic_targeting_matrix;
CREATE MATERIALIZED VIEW geographic_targeting_matrix AS
SELECT
  ta.actor_type,
  ta.name AS actor_name,
  UNNEST(ta.target_sectors) AS target_sector,
  UNNEST(ta.target_countries) AS target_country,
  ta.trend_status,
  ta.incident_velocity,
  COUNT(*) OVER (PARTITION BY UNNEST(ta.target_countries)) AS country_total_actors,
  COUNT(*) OVER (PARTITION BY UNNEST(ta.target_sectors)) AS sector_total_actors
FROM threat_actors ta
WHERE ta.target_sectors IS NOT NULL
  AND ta.target_countries IS NOT NULL
  AND array_length(ta.target_sectors, 1) > 0
  AND array_length(ta.target_countries, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_geo_matrix_country ON geographic_targeting_matrix(target_country);
CREATE INDEX IF NOT EXISTS idx_geo_matrix_sector ON geographic_targeting_matrix(target_sector);
CREATE INDEX IF NOT EXISTS idx_geo_matrix_type ON geographic_targeting_matrix(actor_type);

-- ============================================================================
-- SECTION 6: TEMPORAL ACTIVITY PATTERNS
-- ============================================================================

-- Track actor activity patterns for dormancy detection
CREATE TABLE IF NOT EXISTS actor_activity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES threat_actors(id) ON DELETE CASCADE,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  incidents_7d INTEGER DEFAULT 0,
  incidents_30d INTEGER DEFAULT 0,
  incidents_90d INTEGER DEFAULT 0,
  iocs_count INTEGER DEFAULT 0,
  last_activity_date DATE,
  status TEXT CHECK (status IN ('active', 'dormant', 'reactivated', 'new')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_actor_snapshots_actor ON actor_activity_snapshots(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_snapshots_date ON actor_activity_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_actor_snapshots_status ON actor_activity_snapshots(status);

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Get similar actors using pre-computed view
CREATE OR REPLACE FUNCTION get_similar_actors_precomputed(p_actor_id UUID, p_min_score INTEGER DEFAULT 25, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  actor_id UUID,
  actor_name TEXT,
  similarity_score INTEGER,
  factors JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN asm.actor_a_id = p_actor_id THEN asm.actor_b_id ELSE asm.actor_a_id END,
    CASE WHEN asm.actor_a_id = p_actor_id THEN asm.actor_b_name ELSE asm.actor_a_name END,
    asm.similarity_score::INTEGER,
    asm.factors
  FROM actor_similarity asm
  WHERE (asm.actor_a_id = p_actor_id OR asm.actor_b_id = p_actor_id)
    AND asm.similarity_score >= p_min_score
  ORDER BY asm.similarity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get technique co-occurrence for a given technique
CREATE OR REPLACE FUNCTION get_technique_cooccurrence(p_technique_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  related_technique_id UUID,
  related_technique_name TEXT,
  shared_actor_count BIGINT,
  actors_using_both TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN tc.technique_a_id = p_technique_id THEN tc.technique_b_id ELSE tc.technique_a_id END,
    CASE WHEN tc.technique_a_id = p_technique_id THEN tc.technique_b_name ELSE tc.technique_a_name END,
    tc.shared_actor_count,
    tc.actors_using_both
  FROM technique_cooccurrence tc
  WHERE tc.technique_a_id = p_technique_id OR tc.technique_b_id = p_technique_id
  ORDER BY tc.shared_actor_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Refresh all correlation views
CREATE OR REPLACE FUNCTION refresh_advanced_correlation_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY actor_similarity;
  REFRESH MATERIALIZED VIEW CONCURRENTLY technique_cooccurrence;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sector_technique_correlation;
  REFRESH MATERIALIZED VIEW CONCURRENTLY geographic_targeting_matrix;
END;
$$ LANGUAGE plpgsql;

-- Detect dormant actors that reactivated
CREATE OR REPLACE FUNCTION detect_reactivated_actors()
RETURNS TABLE (
  actor_id UUID,
  actor_name TEXT,
  dormant_days INTEGER,
  new_incidents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_activity AS (
    SELECT
      ta.id,
      ta.name,
      ta.incidents_7d,
      prev.incidents_7d AS prev_incidents_7d,
      prev.snapshot_date AS prev_date
    FROM threat_actors ta
    LEFT JOIN actor_activity_snapshots prev ON ta.id = prev.actor_id
      AND prev.snapshot_date = CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT
    ra.id,
    ra.name,
    7::INTEGER,
    ra.incidents_7d
  FROM recent_activity ra
  WHERE ra.incidents_7d > 0
    AND (ra.prev_incidents_7d = 0 OR ra.prev_incidents_7d IS NULL);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ioc_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_activity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ioc_sources" ON ioc_sources FOR SELECT USING (true);
CREATE POLICY "Service write ioc_sources" ON ioc_sources FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read actor_activity_snapshots" ON actor_activity_snapshots FOR SELECT USING (true);
CREATE POLICY "Service write actor_activity_snapshots" ON actor_activity_snapshots FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- SECTION 9: COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW actor_similarity IS 'Pre-computed actor similarity scores for fast lookups';
COMMENT ON MATERIALIZED VIEW technique_cooccurrence IS 'Techniques that commonly appear together across actors';
COMMENT ON MATERIALIZED VIEW sector_technique_correlation IS 'Techniques commonly used against specific sectors';
COMMENT ON MATERIALIZED VIEW geographic_targeting_matrix IS 'Actor targeting patterns by geography and sector';
COMMENT ON TABLE ioc_sources IS 'Tracks which sources reported each IOC for confidence scoring';
COMMENT ON TABLE actor_activity_snapshots IS 'Historical activity snapshots for dormancy detection';
COMMENT ON VIEW ioc_confidence IS 'Multi-source IOC confidence scoring';
