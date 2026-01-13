-- Actor-Vulnerability Correlations
-- Links threat actors to CVEs they are known to exploit
-- Run this migration in Supabase SQL Editor

-- ============================================
-- ACTOR-VULNERABILITY JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS actor_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES threat_actors(id) ON DELETE CASCADE,
  cve_id TEXT NOT NULL REFERENCES vulnerabilities(cve_id) ON DELETE CASCADE,
  confidence TEXT DEFAULT 'medium',       -- low, medium, high
  source TEXT,                            -- where this correlation was sourced
  first_seen DATE,                        -- when actor first used this CVE
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, cve_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_actor_vulns_actor ON actor_vulnerabilities(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_vulns_cve ON actor_vulnerabilities(cve_id);
CREATE INDEX IF NOT EXISTS idx_actor_vulns_confidence ON actor_vulnerabilities(confidence);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_actor_vulnerabilities_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actor_vulnerabilities_updated
  BEFORE UPDATE ON actor_vulnerabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_actor_vulnerabilities_timestamp();

-- ============================================
-- IOC IMPROVEMENTS
-- Ensure malware_family index exists for correlation lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_iocs_malware_family ON iocs(malware_family);
CREATE INDEX IF NOT EXISTS idx_iocs_actor_id ON iocs(actor_id);

-- ============================================
-- HELPER VIEW: IOC-Actor Correlation
-- Resolves IOCs to actors via malware_family when direct link missing
-- ============================================
CREATE OR REPLACE VIEW ioc_actor_correlation AS
SELECT
  i.*,
  COALESCE(i.actor_id, mf.actor_id) as resolved_actor_id,
  CASE
    WHEN i.actor_id IS NOT NULL THEN 'direct'
    WHEN mf.actor_id IS NOT NULL THEN 'malware_family'
    ELSE NULL
  END as correlation_type
FROM iocs i
LEFT JOIN (
  SELECT DISTINCT
    signature as malware_family,
    actor_id
  FROM malware_samples
  WHERE actor_id IS NOT NULL
    AND signature IS NOT NULL
) mf ON LOWER(i.malware_family) = LOWER(mf.malware_family)
WHERE i.malware_family IS NOT NULL OR i.actor_id IS NOT NULL;

-- ============================================
-- VULNERABILITY COUNT ON ACTORS
-- Track how many CVEs each actor exploits
-- ============================================
ALTER TABLE threat_actors
ADD COLUMN IF NOT EXISTS vulnerability_count INTEGER DEFAULT 0;

-- Function to update vulnerability count
CREATE OR REPLACE FUNCTION update_actor_vulnerability_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE threat_actors
    SET vulnerability_count = (
      SELECT COUNT(*) FROM actor_vulnerabilities WHERE actor_id = NEW.actor_id
    )
    WHERE id = NEW.actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE threat_actors
    SET vulnerability_count = (
      SELECT COUNT(*) FROM actor_vulnerabilities WHERE actor_id = OLD.actor_id
    )
    WHERE id = OLD.actor_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actor_vulnerability_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON actor_vulnerabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_actor_vulnerability_count();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE actor_vulnerabilities IS 'Junction table linking threat actors to CVEs they are known to exploit';
COMMENT ON VIEW ioc_actor_correlation IS 'Resolves IOCs to actors via direct link or malware family matching';

-- ============================================
-- SAMPLE CORRELATION DATA
-- Known actor-CVE relationships (will be expanded by seed script)
-- ============================================
-- Note: Run seed-correlations.mjs script to populate with verified data
