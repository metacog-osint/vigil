-- PAIR Cyber Watchcon - Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- THREAT ACTORS TABLE
-- Ransomware groups, APTs, cybercrime gangs
-- ============================================
CREATE TABLE IF NOT EXISTS threat_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  actor_type TEXT DEFAULT 'ransomware', -- ransomware, apt, cybercrime, hacktivism
  first_seen DATE,
  last_seen DATE,
  target_sectors TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  ttps TEXT[] DEFAULT '{}',  -- MITRE ATT&CK IDs
  description TEXT,
  status TEXT DEFAULT 'active', -- active, inactive, defunct
  source TEXT,  -- ransomwatch, ransomlook, etc.
  source_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INCIDENTS TABLE
-- Ransomware attacks, breaches, claims
-- ============================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  victim_name TEXT,
  victim_sector TEXT,
  victim_country TEXT,
  victim_website TEXT,
  incident_date DATE,
  discovered_date DATE DEFAULT CURRENT_DATE,
  claim_date DATE,
  ransom_amount NUMERIC,
  ransom_currency TEXT DEFAULT 'USD',
  ransom_paid BOOLEAN,
  data_leaked BOOLEAN DEFAULT FALSE,
  data_size TEXT,  -- e.g., "500GB"
  status TEXT DEFAULT 'claimed',  -- claimed, confirmed, leaked, paid, removed
  source TEXT,
  source_url TEXT,
  raw_data JSONB,  -- preserve original for audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IOCs TABLE
-- Indicators of Compromise
-- ============================================
CREATE TABLE IF NOT EXISTS iocs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,  -- hash_md5, hash_sha1, hash_sha256, ip, domain, url, email
  value TEXT NOT NULL,
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  malware_family TEXT,
  confidence TEXT DEFAULT 'medium',  -- low, medium, high
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, value)
);

-- ============================================
-- VULNERABILITIES TABLE
-- CVEs with CISA KEV and EPSS data
-- ============================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
  cve_id TEXT PRIMARY KEY,  -- CVE-YYYY-NNNNN
  cvss_score NUMERIC,
  cvss_vector TEXT,
  epss_score NUMERIC,  -- EPSS probability (0-1)
  epss_percentile NUMERIC,
  kev_date DATE,  -- when added to CISA KEV
  kev_due_date DATE,  -- CISA remediation deadline
  description TEXT,
  affected_products TEXT[],
  affected_vendors TEXT[],
  patch_available BOOLEAN,
  exploited_in_wild BOOLEAN DEFAULT FALSE,
  ransomware_campaign_use BOOLEAN DEFAULT FALSE,
  associated_actors TEXT[] DEFAULT '{}',
  references TEXT[] DEFAULT '{}',
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MALWARE TABLE
-- Malware samples from Abuse.ch etc.
-- ============================================
CREATE TABLE IF NOT EXISTS malware (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sha256 TEXT UNIQUE NOT NULL,
  sha1 TEXT,
  md5 TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  malware_family TEXT,
  signature TEXT,
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT,  -- bazaar, threatfox, etc.
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  yara_rules TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DATA SOURCE SYNC LOG
-- Track ingestion runs
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,  -- ransomwatch, cisa_kev, abuse_ch, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',  -- running, success, error
  records_processed INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- INDEXES
-- ============================================

-- Threat actors
CREATE INDEX IF NOT EXISTS idx_actors_name ON threat_actors(name);
CREATE INDEX IF NOT EXISTS idx_actors_last_seen ON threat_actors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_actors_sectors ON threat_actors USING GIN(target_sectors);
CREATE INDEX IF NOT EXISTS idx_actors_search ON threat_actors
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(array_to_string(aliases, ' '), '')));

-- Incidents
CREATE INDEX IF NOT EXISTS idx_incidents_actor ON incidents(actor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_sector ON incidents(victim_sector);
CREATE INDEX IF NOT EXISTS idx_incidents_discovered ON incidents(discovered_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_country ON incidents(victim_country);

-- IOCs
CREATE INDEX IF NOT EXISTS idx_iocs_type_value ON iocs(type, value);
CREATE INDEX IF NOT EXISTS idx_iocs_actor ON iocs(actor_id);
CREATE INDEX IF NOT EXISTS idx_iocs_last_seen ON iocs(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_iocs_malware ON iocs(malware_family);

-- Vulnerabilities
CREATE INDEX IF NOT EXISTS idx_vulns_cvss ON vulnerabilities(cvss_score DESC);
CREATE INDEX IF NOT EXISTS idx_vulns_kev ON vulnerabilities(kev_date DESC) WHERE kev_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vulns_epss ON vulnerabilities(epss_score DESC);

-- Malware
CREATE INDEX IF NOT EXISTS idx_malware_family ON malware(malware_family);
CREATE INDEX IF NOT EXISTS idx_malware_sha256 ON malware(sha256);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get incidents grouped by sector for last N days
CREATE OR REPLACE FUNCTION incidents_by_sector(cutoff_date TIMESTAMPTZ)
RETURNS TABLE (
  sector TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    victim_sector as sector,
    COUNT(*) as count
  FROM incidents
  WHERE discovered_date >= cutoff_date
    AND victim_sector IS NOT NULL
  GROUP BY victim_sector
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get actor activity stats
CREATE OR REPLACE FUNCTION actor_activity_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  actor_id UUID,
  actor_name TEXT,
  incident_count BIGINT,
  latest_incident DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.id as actor_id,
    ta.name as actor_name,
    COUNT(i.id) as incident_count,
    MAX(i.discovered_date) as latest_incident
  FROM threat_actors ta
  LEFT JOIN incidents i ON ta.id = i.actor_id
    AND i.discovered_date >= CURRENT_DATE - days_back
  GROUP BY ta.id, ta.name
  HAVING COUNT(i.id) > 0
  ORDER BY incident_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (Optional - enable if needed)
-- ============================================

-- For now, allow all authenticated users to read
-- You can add RLS policies for multi-tenant scenarios

-- ALTER TABLE threat_actors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE iocs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actors_updated_at
  BEFORE UPDATE ON threat_actors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_vulns_updated_at
  BEFORE UPDATE ON vulnerabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert some sample threat actors
INSERT INTO threat_actors (name, aliases, actor_type, target_sectors, status, first_seen, last_seen) VALUES
  ('LockBit', ARRAY['LockBit 3.0', 'LockBit Black'], 'ransomware', ARRAY['healthcare', 'finance', 'manufacturing'], 'active', '2019-09-01', CURRENT_DATE),
  ('BlackCat', ARRAY['ALPHV', 'Noberus'], 'ransomware', ARRAY['healthcare', 'retail', 'energy'], 'active', '2021-11-01', CURRENT_DATE),
  ('Cl0p', ARRAY['Clop', 'TA505'], 'ransomware', ARRAY['finance', 'retail', 'technology'], 'active', '2019-02-01', CURRENT_DATE),
  ('Royal', ARRAY['Royal Ransomware'], 'ransomware', ARRAY['healthcare', 'education', 'manufacturing'], 'active', '2022-09-01', CURRENT_DATE),
  ('Play', ARRAY['PlayCrypt'], 'ransomware', ARRAY['technology', 'manufacturing', 'retail'], 'active', '2022-06-01', CURRENT_DATE)
ON CONFLICT (name) DO NOTHING;

-- Insert sample incidents
INSERT INTO incidents (actor_id, victim_name, victim_sector, victim_country, discovered_date, status)
SELECT
  ta.id,
  'Sample Victim ' || gs,
  (ARRAY['healthcare', 'finance', 'technology', 'manufacturing', 'retail'])[1 + (gs % 5)],
  (ARRAY['US', 'UK', 'DE', 'FR', 'CA'])[1 + (gs % 5)],
  CURRENT_DATE - (gs || ' days')::interval,
  'claimed'
FROM threat_actors ta, generate_series(1, 20) gs
WHERE ta.name = 'LockBit'
LIMIT 20;

COMMIT;
