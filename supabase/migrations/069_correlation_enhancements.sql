-- =====================================================
-- Correlation System Enhancement Migration
-- Phase 3: New Correlations (Fill Data Gaps)
-- =====================================================

-- ============================================================================
-- SECTION 1: INCIDENT-TO-INCIDENT CORRELATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS incident_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_a_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  incident_b_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  correlation_type TEXT NOT NULL CHECK (correlation_type IN (
    'same_actor', 'same_sector', 'same_campaign', 'ttp_overlap', 'ioc_shared', 'temporal_proximity', 'geographic_proximity'
  )),
  correlation_score FLOAT NOT NULL CHECK (correlation_score >= 0 AND correlation_score <= 100),
  factors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(incident_a_id, incident_b_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_correlations_a ON incident_correlations(incident_a_id);
CREATE INDEX IF NOT EXISTS idx_incident_correlations_b ON incident_correlations(incident_b_id);
CREATE INDEX IF NOT EXISTS idx_incident_correlations_score ON incident_correlations(correlation_score DESC);
CREATE INDEX IF NOT EXISTS idx_incident_correlations_type ON incident_correlations(correlation_type);

-- ============================================================================
-- SECTION 2: MALWARE FAMILY RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS malware_family_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_family TEXT NOT NULL,
  child_family TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'variant_of', 'successor_to', 'rebrand_of', 'shares_code_with', 'evolved_from', 'fork_of'
  )),
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  source TEXT,
  source_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_family, child_family)
);

CREATE INDEX IF NOT EXISTS idx_malware_relationships_parent ON malware_family_relationships(parent_family);
CREATE INDEX IF NOT EXISTS idx_malware_relationships_child ON malware_family_relationships(child_family);

-- Seed with known malware relationships
INSERT INTO malware_family_relationships (parent_family, child_family, relationship_type, confidence, source) VALUES
  ('Conti', 'BlackCat', 'successor_to', 'high', 'industry_report'),
  ('Conti', 'Royal', 'successor_to', 'high', 'industry_report'),
  ('Conti', 'BlackBasta', 'successor_to', 'high', 'industry_report'),
  ('REvil', 'BlackMatter', 'rebrand_of', 'high', 'industry_report'),
  ('DarkSide', 'BlackMatter', 'rebrand_of', 'high', 'industry_report'),
  ('Dharma', 'Crysis', 'variant_of', 'high', 'malpedia'),
  ('Ryuk', 'Conti', 'evolved_from', 'high', 'industry_report'),
  ('TrickBot', 'BazarLoader', 'successor_to', 'high', 'industry_report'),
  ('Emotet', 'Heodo', 'variant_of', 'medium', 'malpedia'),
  ('Maze', 'Egregor', 'successor_to', 'high', 'industry_report'),
  ('Maze', 'Sekhmet', 'variant_of', 'medium', 'industry_report'),
  ('GandCrab', 'REvil', 'successor_to', 'high', 'industry_report'),
  ('NetWalker', 'Mailto', 'variant_of', 'medium', 'malpedia'),
  ('LockBit', 'LockBit 2.0', 'evolved_from', 'high', 'official'),
  ('LockBit 2.0', 'LockBit 3.0', 'evolved_from', 'high', 'official'),
  ('Hive', 'Hunters International', 'rebrand_of', 'high', 'industry_report'),
  ('BlackCat', 'ALPHV', 'variant_of', 'high', 'official'),
  ('Cuba', 'CubaRansomware', 'variant_of', 'high', 'malpedia'),
  ('Ragnar Locker', 'RagnarLocker', 'variant_of', 'high', 'malpedia'),
  ('Zeppelin', 'Buran', 'variant_of', 'high', 'malpedia')
ON CONFLICT (parent_family, child_family) DO NOTHING;

-- ============================================================================
-- SECTION 3: IOC INFRASTRUCTURE CLUSTERING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ioc_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_type TEXT NOT NULL CHECK (cluster_type IN (
    'same_ip', 'same_asn', 'same_registrar', 'same_cert', 'same_nameserver', 'same_subnet'
  )),
  cluster_key TEXT NOT NULL,
  ioc_values TEXT[] NOT NULL,
  ioc_count INTEGER NOT NULL,
  actors TEXT[] DEFAULT '{}',
  malware_families TEXT[] DEFAULT '{}',
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_type, cluster_key)
);

CREATE INDEX IF NOT EXISTS idx_ioc_clusters_type ON ioc_clusters(cluster_type);
CREATE INDEX IF NOT EXISTS idx_ioc_clusters_values ON ioc_clusters USING GIN(ioc_values);
CREATE INDEX IF NOT EXISTS idx_ioc_clusters_actors ON ioc_clusters USING GIN(actors);

-- ============================================================================
-- SECTION 4: CAMPAIGNS TABLE ENHANCEMENTS
-- Note: campaigns table already exists from migration 056
-- Adding additional columns for correlation tracking
-- ============================================================================

-- Add missing columns to campaigns table if they don't exist
DO $$
BEGIN
  -- actor_id for direct actor reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'actor_id') THEN
    ALTER TABLE campaigns ADD COLUMN actor_id UUID REFERENCES threat_actors(id);
  END IF;

  -- actor_name for denormalized lookup
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'actor_name') THEN
    ALTER TABLE campaigns ADD COLUMN actor_name TEXT;
  END IF;

  -- status for tracking campaign lifecycle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'status') THEN
    ALTER TABLE campaigns ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'concluded', 'suspected', 'dormant'));
  END IF;

  -- start_date and end_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'start_date') THEN
    ALTER TABLE campaigns ADD COLUMN start_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'end_date') THEN
    ALTER TABLE campaigns ADD COLUMN end_date DATE;
  END IF;

  -- techniques array
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'techniques') THEN
    ALTER TABLE campaigns ADD COLUMN techniques TEXT[] DEFAULT '{}';
  END IF;

  -- malware_families array
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'malware_families') THEN
    ALTER TABLE campaigns ADD COLUMN malware_families TEXT[] DEFAULT '{}';
  END IF;

  -- vulnerabilities array
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'vulnerabilities') THEN
    ALTER TABLE campaigns ADD COLUMN vulnerabilities TEXT[] DEFAULT '{}';
  END IF;

  -- incident_count for quick stats
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'incident_count') THEN
    ALTER TABLE campaigns ADD COLUMN incident_count INTEGER DEFAULT 0;
  END IF;

  -- confidence level
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'confidence') THEN
    ALTER TABLE campaigns ADD COLUMN confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low'));
  END IF;

  -- tags array
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'tags') THEN
    ALTER TABLE campaigns ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Create indexes on new columns (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'actor_id') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_actor ON campaigns(actor_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'actor_name') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_actor_name ON campaigns(actor_name);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'start_date') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
  END IF;
END $$;

-- Campaign-to-incident mapping
CREATE TABLE IF NOT EXISTS campaign_incidents (
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  notes TEXT,
  PRIMARY KEY (campaign_id, incident_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_incidents_campaign ON campaign_incidents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_incidents_incident ON campaign_incidents(incident_id);

-- ============================================================================
-- SECTION 5: DETECTED PATTERNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'actor_sector', 'actor_technique', 'temporal_cluster', 'geographic', 'campaign', 'anomaly', 'sector_technique'
  )),
  pattern_key TEXT NOT NULL,
  data JSONB NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  first_detected TIMESTAMPTZ DEFAULT NOW(),
  last_detected TIMESTAMPTZ DEFAULT NOW(),
  detection_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_positive', 'acknowledged')),
  analyst_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_detected_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_status ON detected_patterns(status);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_confidence ON detected_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_last ON detected_patterns(last_detected DESC);

-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================================================

-- Get related incidents for a given incident
CREATE OR REPLACE FUNCTION get_related_incidents(p_incident_id UUID, p_min_score FLOAT DEFAULT 30, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  incident_id UUID,
  correlation_type TEXT,
  correlation_score FLOAT,
  factors JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN ic.incident_a_id = p_incident_id THEN ic.incident_b_id ELSE ic.incident_a_id END,
    ic.correlation_type,
    ic.correlation_score,
    ic.factors
  FROM incident_correlations ic
  WHERE (ic.incident_a_id = p_incident_id OR ic.incident_b_id = p_incident_id)
    AND ic.correlation_score >= p_min_score
  ORDER BY ic.correlation_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get malware lineage tree
CREATE OR REPLACE FUNCTION get_malware_lineage(p_family TEXT)
RETURNS TABLE (
  family_name TEXT,
  relationship TEXT,
  direction TEXT,
  confidence TEXT,
  source TEXT
) AS $$
BEGIN
  -- Ancestors (what this malware evolved from)
  RETURN QUERY
  SELECT
    mfr.parent_family,
    mfr.relationship_type,
    'ancestor'::TEXT,
    mfr.confidence,
    mfr.source
  FROM malware_family_relationships mfr
  WHERE mfr.child_family ILIKE p_family

  UNION ALL

  -- Descendants (what evolved from this malware)
  SELECT
    mfr.child_family,
    mfr.relationship_type,
    'descendant'::TEXT,
    mfr.confidence,
    mfr.source
  FROM malware_family_relationships mfr
  WHERE mfr.parent_family ILIKE p_family;
END;
$$ LANGUAGE plpgsql;

-- Get IOC cluster for a given IOC value
CREATE OR REPLACE FUNCTION get_ioc_cluster(p_ioc_value TEXT)
RETURNS TABLE (
  cluster_id UUID,
  cluster_type TEXT,
  cluster_key TEXT,
  related_iocs TEXT[],
  related_actors TEXT[],
  related_malware TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.cluster_type,
    ic.cluster_key,
    ic.ioc_values,
    ic.actors,
    ic.malware_families
  FROM ioc_clusters ic
  WHERE p_ioc_value = ANY(ic.ioc_values);
END;
$$ LANGUAGE plpgsql;

-- Update campaign incident count
CREATE OR REPLACE FUNCTION update_campaign_incident_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE campaigns SET incident_count = incident_count + 1 WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE campaigns SET incident_count = incident_count - 1 WHERE id = OLD.campaign_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_incident_count
AFTER INSERT OR DELETE ON campaign_incidents
FOR EACH ROW EXECUTE FUNCTION update_campaign_incident_count();

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE incident_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE malware_family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ioc_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_patterns ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read incident_correlations" ON incident_correlations FOR SELECT USING (true);
CREATE POLICY "Public read malware_family_relationships" ON malware_family_relationships FOR SELECT USING (true);
CREATE POLICY "Public read ioc_clusters" ON ioc_clusters FOR SELECT USING (true);
CREATE POLICY "Public read campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Public read campaign_incidents" ON campaign_incidents FOR SELECT USING (true);
CREATE POLICY "Public read detected_patterns" ON detected_patterns FOR SELECT USING (true);

-- Service role write policies
CREATE POLICY "Service write incident_correlations" ON incident_correlations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write malware_family_relationships" ON malware_family_relationships FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write ioc_clusters" ON ioc_clusters FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write campaigns" ON campaigns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write campaign_incidents" ON campaign_incidents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write detected_patterns" ON detected_patterns FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- SECTION 8: COMMENTS
-- ============================================================================

COMMENT ON TABLE incident_correlations IS 'Stores computed correlations between incidents';
COMMENT ON TABLE malware_family_relationships IS 'Tracks evolutionary and variant relationships between malware families';
COMMENT ON TABLE ioc_clusters IS 'Groups IOCs by shared infrastructure characteristics';
COMMENT ON TABLE campaigns IS 'Identified threat campaigns with associated metadata';
COMMENT ON TABLE campaign_incidents IS 'Links incidents to campaigns';
COMMENT ON TABLE detected_patterns IS 'Persisted pattern detection results for analyst review';
