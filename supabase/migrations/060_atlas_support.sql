-- Migration 060: MITRE ATLAS Support
-- Adds support for AI/ML adversarial techniques from MITRE ATLAS

-- Add framework column to distinguish ATLAS from ATT&CK techniques
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS framework TEXT DEFAULT 'attack';
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS parent_technique_id TEXT;
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS external_references JSONB DEFAULT '[]';
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for framework filtering
CREATE INDEX IF NOT EXISTS idx_techniques_framework ON techniques(framework);

-- Create ATLAS case studies table
CREATE TABLE IF NOT EXISTS atlas_case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id TEXT UNIQUE NOT NULL,  -- AML.CS0001 format
  name TEXT NOT NULL,
  summary TEXT,
  incident_date DATE,
  techniques_used JSONB DEFAULT '[]',  -- Array of technique references with descriptions
  actor_name TEXT,
  target_sector TEXT,
  target_description TEXT,
  source TEXT DEFAULT 'mitre-atlas',
  source_url TEXT,
  external_references JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for case studies
CREATE INDEX IF NOT EXISTS idx_atlas_case_studies_id ON atlas_case_studies(case_study_id);
CREATE INDEX IF NOT EXISTS idx_atlas_case_studies_actor ON atlas_case_studies(actor_name);
CREATE INDEX IF NOT EXISTS idx_atlas_case_studies_sector ON atlas_case_studies(target_sector);
CREATE INDEX IF NOT EXISTS idx_atlas_case_studies_date ON atlas_case_studies(incident_date DESC);

-- RLS
ALTER TABLE atlas_case_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to atlas_case_studies"
  ON atlas_case_studies FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access to atlas_case_studies"
  ON atlas_case_studies FOR ALL
  USING (auth.role() = 'service_role');

-- Generic updated_at function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE TRIGGER trigger_atlas_case_studies_updated_at
  BEFORE UPDATE ON atlas_case_studies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update comment on techniques table
COMMENT ON TABLE techniques IS 'MITRE ATT&CK Enterprise and ATLAS (AI/ML) techniques';
COMMENT ON TABLE atlas_case_studies IS 'MITRE ATLAS case studies of real-world AI/ML attacks';

-- Create view for ATLAS techniques only
CREATE OR REPLACE VIEW atlas_techniques AS
SELECT * FROM techniques WHERE framework = 'atlas';

-- Create view for ATT&CK techniques only
CREATE OR REPLACE VIEW attack_techniques AS
SELECT * FROM techniques WHERE framework = 'attack';
