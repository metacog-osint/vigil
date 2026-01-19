-- CISA ICS-CERT Advisories Table
-- Separate from GHSA advisories due to different schema requirements

CREATE TABLE IF NOT EXISTS ics_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisory_id TEXT UNIQUE NOT NULL,  -- ICSA-XX-XXX-XX format
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'high',  -- ICS advisories are generally high/critical
  cvss_score NUMERIC,

  -- Affected systems
  affected_vendors TEXT[] DEFAULT '{}',
  affected_products TEXT[] DEFAULT '{}',
  cve_ids TEXT[] DEFAULT '{}',

  -- Metadata
  source TEXT DEFAULT 'cisa-ics',
  source_url TEXT,
  published_date DATE,

  -- Additional context
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ics_advisories_advisory_id ON ics_advisories(advisory_id);
CREATE INDEX IF NOT EXISTS idx_ics_advisories_published ON ics_advisories(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_ics_advisories_severity ON ics_advisories(severity);
CREATE INDEX IF NOT EXISTS idx_ics_advisories_cve_ids ON ics_advisories USING GIN(cve_ids);

-- RLS
ALTER TABLE ics_advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to ics_advisories"
  ON ics_advisories FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access to ics_advisories"
  ON ics_advisories FOR ALL
  USING (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE TRIGGER trigger_ics_advisories_updated_at
  BEFORE UPDATE ON ics_advisories
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

COMMENT ON TABLE ics_advisories IS 'CISA ICS-CERT Industrial Control System security advisories';
