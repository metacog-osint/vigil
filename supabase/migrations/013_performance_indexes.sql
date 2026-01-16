-- ============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Sprint 6: Polish & Scale
-- Simplified version - only creates indexes for existing tables
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

CREATE INDEX IF NOT EXISTS idx_incidents_recent_date
  ON incidents(discovered_date DESC);

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

-- ============================================
-- IOCs TABLE INDEXES
-- ============================================

-- Value lookup (most critical - used for IOC search)
CREATE INDEX IF NOT EXISTS idx_iocs_value_hash
  ON iocs USING hash(value);

-- Type + date filtering
CREATE INDEX IF NOT EXISTS idx_iocs_type_created
  ON iocs(type, created_at DESC);

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

ANALYZE incidents;
ANALYZE threat_actors;
ANALYZE vulnerabilities;
ANALYZE iocs;
