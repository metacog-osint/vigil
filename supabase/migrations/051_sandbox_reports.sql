-- Migration 051: Sandbox Reports and Enhanced IOC Fields
-- Supporting ANY.RUN, Triage, InQuest Labs, and other sandbox integrations

-- ============================================
-- SANDBOX REPORTS TABLE
-- Malware analysis reports from sandbox services
-- ============================================
CREATE TABLE IF NOT EXISTS sandbox_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,  -- ID from the sandbox service
  source TEXT NOT NULL,       -- anyrun, triage, inquest, hybridanalysis, etc.

  -- Sample information
  sample_name TEXT,
  sample_hash TEXT,           -- Primary hash (usually SHA256)
  sample_type TEXT,           -- file type, MIME type, etc.

  -- Analysis results
  verdict TEXT,               -- critical, high, medium, low, clean
  threat_name TEXT,           -- Malware family/name if detected
  score DECIMAL(5,2),         -- Numeric score from sandbox (0-10 or 0-100)

  -- URLs and references
  analysis_url TEXT,          -- Link to full report

  -- Timestamps
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Rich metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(external_id, source)
);

-- ============================================
-- IOC TABLE ENHANCEMENTS
-- Add fields for sandbox correlation and severity
-- ============================================
ALTER TABLE iocs
ADD COLUMN IF NOT EXISTS source_ref TEXT,      -- Reference ID from source (e.g., sandbox task ID)
ADD COLUMN IF NOT EXISTS source_feed TEXT,     -- Specific feed within source (e.g., Pulsedive feed name)
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',  -- critical, high, medium, low
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VULNERABILITIES TABLE ENHANCEMENTS
-- Add fields for VulnCheck compatibility
-- ============================================
ALTER TABLE vulnerabilities
ADD COLUMN IF NOT EXISTS title TEXT,                    -- Short title/name
ADD COLUMN IF NOT EXISTS severity TEXT,                 -- Mapped from CVSS: critical, high, medium, low
ADD COLUMN IF NOT EXISTS cvss_version TEXT,             -- CVSS version (2.0, 3.0, 3.1)
ADD COLUMN IF NOT EXISTS is_kev BOOLEAN DEFAULT false,  -- In any KEV list
ADD COLUMN IF NOT EXISTS kev_date_added DATE,           -- Alias for kev_date
ADD COLUMN IF NOT EXISTS exploit_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ransomware_use BOOLEAN DEFAULT false,  -- Alias for ransomware_campaign_use
ADD COLUMN IF NOT EXISTS vendor TEXT,                   -- Primary vendor
ADD COLUMN IF NOT EXISTS product TEXT;                  -- Primary product

-- ============================================
-- INDEXES
-- ============================================

-- Sandbox reports
CREATE INDEX IF NOT EXISTS idx_sandbox_reports_source ON sandbox_reports(source);
CREATE INDEX IF NOT EXISTS idx_sandbox_reports_hash ON sandbox_reports(sample_hash);
CREATE INDEX IF NOT EXISTS idx_sandbox_reports_verdict ON sandbox_reports(verdict);
CREATE INDEX IF NOT EXISTS idx_sandbox_reports_threat ON sandbox_reports(threat_name) WHERE threat_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sandbox_reports_submitted ON sandbox_reports(submitted_at DESC);

-- IOCs severity
CREATE INDEX IF NOT EXISTS idx_iocs_severity ON iocs(severity);
CREATE INDEX IF NOT EXISTS idx_iocs_source_ref ON iocs(source_ref) WHERE source_ref IS NOT NULL;

-- Vulnerabilities new fields
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_is_kev ON vulnerabilities(is_kev) WHERE is_kev = true;
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_exploit_available ON vulnerabilities(exploit_available) WHERE exploit_available = true;
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_vendor ON vulnerabilities(vendor) WHERE vendor IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for sandbox_reports
CREATE TRIGGER sandbox_reports_updated_at
  BEFORE UPDATE ON sandbox_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for iocs (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'iocs_updated_at'
  ) THEN
    CREATE TRIGGER iocs_updated_at
      BEFORE UPDATE ON iocs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================
-- SYNC existing KEV data to new is_kev field
-- ============================================
UPDATE vulnerabilities
SET is_kev = true, kev_date_added = kev_date
WHERE kev_date IS NOT NULL AND is_kev IS NOT true;

-- Sync ransomware_use from ransomware_campaign_use
UPDATE vulnerabilities
SET ransomware_use = ransomware_campaign_use
WHERE ransomware_campaign_use = true AND (ransomware_use IS NULL OR ransomware_use = false);

-- Map existing CVSS scores to severity for historical data
UPDATE vulnerabilities
SET severity = CASE
  WHEN cvss_score >= 9.0 THEN 'critical'
  WHEN cvss_score >= 7.0 THEN 'high'
  WHEN cvss_score >= 4.0 THEN 'medium'
  WHEN cvss_score IS NOT NULL THEN 'low'
  ELSE NULL
END
WHERE severity IS NULL AND cvss_score IS NOT NULL;
