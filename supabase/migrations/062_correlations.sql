-- Migration 063: Data Correlation Infrastructure
-- Creates tables and views for cross-referencing threat intelligence data

-- ============================================================================
-- SECTION 1: ACTOR-IOC ATTRIBUTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS actor_iocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  ioc_id UUID,
  ioc_value TEXT NOT NULL,
  ioc_type TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  source TEXT NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_name, ioc_value)
);

CREATE INDEX IF NOT EXISTS idx_actor_iocs_actor_name ON actor_iocs(actor_name);
CREATE INDEX IF NOT EXISTS idx_actor_iocs_ioc_value ON actor_iocs(ioc_value);
CREATE INDEX IF NOT EXISTS idx_actor_iocs_ioc_type ON actor_iocs(ioc_type);

-- ============================================================================
-- SECTION 2: ENHANCE EXISTING ACTOR_VULNERABILITIES TABLE
-- ============================================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actor_vulnerabilities' AND column_name = 'actor_name') THEN
    ALTER TABLE actor_vulnerabilities ADD COLUMN actor_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actor_vulnerabilities' AND column_name = 'exploit_type') THEN
    ALTER TABLE actor_vulnerabilities ADD COLUMN exploit_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actor_vulnerabilities' AND column_name = 'first_observed') THEN
    ALTER TABLE actor_vulnerabilities ADD COLUMN first_observed DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actor_vulnerabilities' AND column_name = 'last_observed') THEN
    ALTER TABLE actor_vulnerabilities ADD COLUMN last_observed DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actor_vulnerabilities' AND column_name = 'notes') THEN
    ALTER TABLE actor_vulnerabilities ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: ATTACK CHAINS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  actor_id UUID,
  actor_name TEXT,
  techniques TEXT[] DEFAULT '{}',
  vulnerabilities TEXT[] DEFAULT '{}',
  malware_families TEXT[] DEFAULT '{}',
  ioc_types TEXT[] DEFAULT '{}',
  target_sectors TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  source TEXT,
  source_url TEXT,
  confidence TEXT DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  first_seen DATE,
  last_seen DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attack_chains_actor_name ON attack_chains(actor_name);
CREATE INDEX IF NOT EXISTS idx_attack_chains_techniques ON attack_chains USING gin(techniques);
CREATE INDEX IF NOT EXISTS idx_attack_chains_sectors ON attack_chains USING gin(target_sectors);

-- ============================================================================
-- SECTION 4: MATERIALIZED VIEWS
-- ============================================================================

-- Industry Threat Landscape
DROP MATERIALIZED VIEW IF EXISTS industry_threat_landscape;
CREATE MATERIALIZED VIEW industry_threat_landscape AS
SELECT
  target_industry as industry,
  target_industry_code as industry_code,
  actor_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT actor_name) FILTER (WHERE actor_name != 'Undetermined') as unique_actors,
  array_agg(DISTINCT actor_name ORDER BY actor_name)
    FILTER (WHERE actor_name IS NOT NULL AND actor_name != 'Undetermined') as actors,
  array_agg(DISTINCT motive ORDER BY motive)
    FILTER (WHERE motive IS NOT NULL AND motive != 'Undetermined') as motives,
  MIN(event_date) as first_event,
  MAX(event_date) as last_event,
  COUNT(*) FILTER (WHERE event_date > CURRENT_DATE - INTERVAL '1 year') as events_last_year,
  COUNT(*) FILTER (WHERE event_date > CURRENT_DATE - INTERVAL '90 days') as events_last_90d
FROM cyber_events
WHERE target_industry IS NOT NULL
GROUP BY target_industry, target_industry_code, actor_type
ORDER BY event_count DESC;

CREATE INDEX idx_industry_landscape_pk ON industry_threat_landscape(industry, actor_type);

-- Country Threat Profile
DROP MATERIALIZED VIEW IF EXISTS country_threat_profile;
CREATE MATERIALIZED VIEW country_threat_profile AS
SELECT
  target_country as country,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE actor_type = 'Nation-State') as nation_state_events,
  COUNT(*) FILTER (WHERE actor_type = 'Criminal') as criminal_events,
  COUNT(*) FILTER (WHERE actor_type = 'Hacktivist') as hacktivist_events,
  COUNT(DISTINCT actor_name) FILTER (WHERE actor_name != 'Undetermined') as unique_actors,
  array_agg(DISTINCT actor_country ORDER BY actor_country)
    FILTER (WHERE actor_country IS NOT NULL AND actor_country != 'Undetermined') as attacking_countries,
  array_agg(DISTINCT target_industry ORDER BY target_industry)
    FILTER (WHERE target_industry IS NOT NULL) as targeted_industries,
  MAX(event_date) as last_event,
  COUNT(*) FILTER (WHERE event_date > CURRENT_DATE - INTERVAL '1 year') as events_last_year
FROM cyber_events
WHERE target_country IS NOT NULL
GROUP BY target_country
ORDER BY total_events DESC;

CREATE INDEX idx_country_profile_pk ON country_threat_profile(country);

-- Weekly Activity Trends
DROP MATERIALIZED VIEW IF EXISTS weekly_activity_trends;
CREATE MATERIALIZED VIEW weekly_activity_trends AS
SELECT week, data_type, count,
  LAG(count) OVER (PARTITION BY data_type ORDER BY week) as prev_week
FROM (
  SELECT date_trunc('week', first_seen)::date as week, 'iocs' as data_type, COUNT(*) as count
  FROM iocs WHERE first_seen IS NOT NULL GROUP BY 1
  UNION ALL
  SELECT date_trunc('week', discovered_date)::date as week, 'incidents' as data_type, COUNT(*) as count
  FROM incidents WHERE discovered_date IS NOT NULL GROUP BY 1
  UNION ALL
  SELECT date_trunc('week', event_date)::date as week, 'cyber_events' as data_type, COUNT(*) as count
  FROM cyber_events WHERE event_date IS NOT NULL GROUP BY 1
) subq
WHERE week IS NOT NULL
ORDER BY week DESC, data_type;

CREATE INDEX idx_weekly_trends_pk ON weekly_activity_trends(week, data_type);

-- Actor Activity Summary
DROP MATERIALIZED VIEW IF EXISTS actor_activity_summary;
CREATE MATERIALIZED VIEW actor_activity_summary AS
SELECT
  ce.actor_name,
  ce.actor_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT ce.target_industry) as industries_targeted,
  COUNT(DISTINCT ce.target_country) as countries_targeted,
  array_agg(DISTINCT ce.motive ORDER BY ce.motive)
    FILTER (WHERE ce.motive IS NOT NULL AND ce.motive != 'Undetermined') as motives,
  MIN(ce.event_date) as first_seen,
  MAX(ce.event_date) as last_seen,
  COUNT(*) FILTER (WHERE ce.event_date > CURRENT_DATE - INTERVAL '1 year') as events_last_year
FROM cyber_events ce
WHERE ce.actor_name IS NOT NULL AND ce.actor_name != 'Undetermined'
GROUP BY ce.actor_name, ce.actor_type
ORDER BY event_count DESC;

CREATE INDEX idx_actor_summary_pk ON actor_activity_summary(actor_name, actor_type);

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Get threats for specific industry
CREATE OR REPLACE FUNCTION get_industry_threats(p_industry TEXT)
RETURNS TABLE(
  actor_name TEXT,
  actor_type TEXT,
  event_count BIGINT,
  motives TEXT[],
  last_event DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT ce.actor_name, ce.actor_type, COUNT(*)::BIGINT,
    array_agg(DISTINCT ce.motive) FILTER (WHERE ce.motive != 'Undetermined'),
    MAX(ce.event_date)
  FROM cyber_events ce
  WHERE ce.target_industry ILIKE '%' || p_industry || '%'
    AND ce.actor_name != 'Undetermined'
  GROUP BY ce.actor_name, ce.actor_type
  ORDER BY COUNT(*) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Refresh all correlation views
CREATE OR REPLACE FUNCTION refresh_correlation_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY industry_threat_landscape;
  REFRESH MATERIALIZED VIEW CONCURRENTLY country_threat_profile;
  REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_activity_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY actor_activity_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE actor_iocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read actor_iocs" ON actor_iocs FOR SELECT USING (true);
CREATE POLICY "Service write actor_iocs" ON actor_iocs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read attack_chains" ON attack_chains FOR SELECT USING (true);
CREATE POLICY "Service write attack_chains" ON attack_chains FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- SECTION 7: COMMENTS
-- ============================================================================

COMMENT ON TABLE actor_iocs IS 'IOC attribution to threat actors';
COMMENT ON TABLE attack_chains IS 'Documented attack chains with full TTPs';
COMMENT ON MATERIALIZED VIEW industry_threat_landscape IS 'Threat statistics by industry';
COMMENT ON MATERIALIZED VIEW country_threat_profile IS 'Threat statistics by country';
COMMENT ON MATERIALIZED VIEW weekly_activity_trends IS 'Weekly activity trends';
COMMENT ON MATERIALIZED VIEW actor_activity_summary IS 'Actor activity aggregation';
