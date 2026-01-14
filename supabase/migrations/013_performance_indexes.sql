-- ============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Sprint 6: Polish & Scale
-- ============================================

-- ============================================
-- INCIDENTS TABLE INDEXES
-- ============================================

-- Composite index for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_incidents_discovered_sector
  ON incidents(discovered_date DESC, victim_sector);

CREATE INDEX IF NOT EXISTS idx_incidents_actor_date
  ON incidents(actor_id, discovered_date DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_country_date
  ON incidents(victim_country, discovered_date DESC);

-- Full-text search index for victim names
CREATE INDEX IF NOT EXISTS idx_incidents_victim_search
  ON incidents USING gin(to_tsvector('english', victim_name));

-- Partial index for recent incidents (hot data)
CREATE INDEX IF NOT EXISTS idx_incidents_recent
  ON incidents(discovered_date DESC)
  WHERE discovered_date > NOW() - INTERVAL '90 days';

-- ============================================
-- THREAT ACTORS TABLE INDEXES
-- ============================================

-- Index for trend filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_actors_trend_lastseen
  ON threat_actors(trend_status, last_seen DESC);

-- Full-text search on actor names and aliases
CREATE INDEX IF NOT EXISTS idx_actors_name_search
  ON threat_actors USING gin(to_tsvector('english', name));

-- Array indexes for sector/country targeting
CREATE INDEX IF NOT EXISTS idx_actors_target_sectors
  ON threat_actors USING gin(target_sectors);

CREATE INDEX IF NOT EXISTS idx_actors_attributed_countries
  ON threat_actors USING gin(attributed_countries);

-- Partial index for active/escalating actors
CREATE INDEX IF NOT EXISTS idx_actors_escalating
  ON threat_actors(incident_velocity DESC)
  WHERE trend_status = 'ESCALATING';

-- ============================================
-- VULNERABILITIES TABLE INDEXES
-- ============================================

-- CVE lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_vulns_cve_id
  ON vulnerabilities(cve_id);

-- Composite index for severity + KEV filtering
CREATE INDEX IF NOT EXISTS idx_vulns_cvss_kev
  ON vulnerabilities(cvss_score DESC, is_kev);

-- Date-based filtering
CREATE INDEX IF NOT EXISTS idx_vulns_published
  ON vulnerabilities(published_date DESC);

CREATE INDEX IF NOT EXISTS idx_vulns_kev_date
  ON vulnerabilities(kev_date DESC)
  WHERE is_kev = TRUE;

-- Vendor/product search
CREATE INDEX IF NOT EXISTS idx_vulns_vendor
  ON vulnerabilities(vendor);

CREATE INDEX IF NOT EXISTS idx_vulns_product
  ON vulnerabilities USING gin(to_tsvector('english', product));

-- ============================================
-- IOCs TABLE INDEXES
-- ============================================

-- Value lookup (most critical - used for IOC search)
CREATE INDEX IF NOT EXISTS idx_iocs_value_hash
  ON iocs USING hash(value);

-- Type + date filtering
CREATE INDEX IF NOT EXISTS idx_iocs_type_created
  ON iocs(type, created_at DESC);

-- Malware family search
CREATE INDEX IF NOT EXISTS idx_iocs_malware
  ON iocs(malware_family)
  WHERE malware_family IS NOT NULL;

-- Actor correlation
CREATE INDEX IF NOT EXISTS idx_iocs_actor_type
  ON iocs(actor_id, type);

-- Confidence-based filtering
CREATE INDEX IF NOT EXISTS idx_iocs_confidence
  ON iocs(confidence DESC)
  WHERE confidence >= 75;

-- ============================================
-- ALERTS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_alerts_published
  ON alerts(published_date DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_severity_date
  ON alerts(severity, published_date DESC);

-- ============================================
-- MITRE TECHNIQUES INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_techniques_tactic
  ON mitre_techniques(tactic_id);

CREATE INDEX IF NOT EXISTS idx_techniques_search
  ON mitre_techniques USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================
-- USER DATA INDEXES
-- ============================================

-- Watchlist quick lookup
CREATE INDEX IF NOT EXISTS idx_watchlist_user_type
  ON watchlist_items(user_id, entity_type);

-- Notification preferences
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;

-- ============================================
-- MATERIALIZED VIEW FOR DASHBOARD STATS
-- Refreshed periodically for fast dashboard loads
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM threat_actors WHERE trend_status = 'ESCALATING') as escalating_actors,
  (SELECT COUNT(*) FROM incidents WHERE discovered_date > NOW() - INTERVAL '7 days') as incidents_7d,
  (SELECT COUNT(*) FROM incidents WHERE discovered_date > NOW() - INTERVAL '30 days') as incidents_30d,
  (SELECT COUNT(*) FROM vulnerabilities WHERE is_kev = TRUE) as total_kevs,
  (SELECT COUNT(*) FROM vulnerabilities WHERE kev_date > NOW() - INTERVAL '30 days') as kevs_30d,
  (SELECT COUNT(*) FROM iocs WHERE created_at > NOW() - INTERVAL '7 days') as iocs_7d,
  (SELECT COUNT(*) FROM alerts WHERE published_date > NOW() - INTERVAL '30 days') as alerts_30d,
  NOW() as last_updated;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_unique
  ON dashboard_stats(last_updated);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================

-- Efficient cursor-based pagination for incidents
CREATE OR REPLACE FUNCTION get_incidents_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_sector TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  victim_name TEXT,
  victim_sector TEXT,
  victim_country TEXT,
  discovered_date TIMESTAMPTZ,
  status TEXT,
  actor_id UUID,
  actor_name TEXT,
  next_cursor TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.victim_name,
    i.victim_sector,
    i.victim_country,
    i.discovered_date,
    i.status,
    i.actor_id,
    ta.name as actor_name,
    i.discovered_date as next_cursor
  FROM incidents i
  LEFT JOIN threat_actors ta ON i.actor_id = ta.id
  WHERE (p_cursor IS NULL OR i.discovered_date < p_cursor)
    AND (p_sector IS NULL OR i.victim_sector = p_sector)
    AND (p_actor_id IS NULL OR i.actor_id = p_actor_id)
  ORDER BY i.discovered_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Efficient cursor-based pagination for IOCs
CREATE OR REPLACE FUNCTION get_iocs_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_type TEXT DEFAULT NULL,
  p_min_confidence INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  value TEXT,
  type TEXT,
  confidence INTEGER,
  malware_family TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  actor_name TEXT,
  next_cursor TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ioc.id,
    ioc.value,
    ioc.type,
    ioc.confidence,
    ioc.malware_family,
    ioc.source,
    ioc.created_at,
    ta.name as actor_name,
    ioc.created_at as next_cursor
  FROM iocs ioc
  LEFT JOIN threat_actors ta ON ioc.actor_id = ta.id
  WHERE (p_cursor IS NULL OR ioc.created_at < p_cursor)
    AND (p_type IS NULL OR ioc.type = p_type)
    AND (p_min_confidence IS NULL OR ioc.confidence >= p_min_confidence)
  ORDER BY ioc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

ANALYZE incidents;
ANALYZE threat_actors;
ANALYZE vulnerabilities;
ANALYZE iocs;
ANALYZE alerts;
