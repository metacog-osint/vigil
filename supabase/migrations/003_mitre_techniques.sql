-- MITRE ATT&CK Techniques table
-- Run this migration in Supabase SQL Editor

-- Create techniques table
CREATE TABLE IF NOT EXISTS techniques (
  id TEXT PRIMARY KEY,                    -- T1059.001
  name TEXT NOT NULL,
  description TEXT,
  tactics TEXT[] DEFAULT '{}',            -- Initial Access, Execution, etc.
  platforms TEXT[] DEFAULT '{}',          -- Windows, Linux, macOS, etc.
  detection TEXT,
  mitigations TEXT[] DEFAULT '{}',
  data_sources TEXT[] DEFAULT '{}',
  is_subtechnique BOOLEAN DEFAULT FALSE,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for tactic-based queries
CREATE INDEX IF NOT EXISTS idx_techniques_tactics ON techniques USING GIN (tactics);

-- Create index for platform-based queries
CREATE INDEX IF NOT EXISTS idx_techniques_platforms ON techniques USING GIN (platforms);

-- Create junction table for actor-technique mapping
CREATE TABLE IF NOT EXISTS actor_techniques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES threat_actors(id) ON DELETE CASCADE,
  technique_id TEXT REFERENCES techniques(id) ON DELETE CASCADE,
  confidence TEXT DEFAULT 'medium',       -- low, medium, high
  first_seen DATE,
  last_seen DATE,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, technique_id)
);

-- Create indexes for junction table
CREATE INDEX IF NOT EXISTS idx_actor_techniques_actor ON actor_techniques(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_techniques_technique ON actor_techniques(technique_id);

-- Add update timestamp trigger
CREATE OR REPLACE FUNCTION update_techniques_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER techniques_updated
  BEFORE UPDATE ON techniques
  FOR EACH ROW
  EXECUTE FUNCTION update_techniques_timestamp();

-- Update threat_actors table to include technique count
ALTER TABLE threat_actors
ADD COLUMN IF NOT EXISTS technique_count INTEGER DEFAULT 0;

-- Create function to update technique count
CREATE OR REPLACE FUNCTION update_actor_technique_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE threat_actors
    SET technique_count = (
      SELECT COUNT(*) FROM actor_techniques WHERE actor_id = NEW.actor_id
    )
    WHERE id = NEW.actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE threat_actors
    SET technique_count = (
      SELECT COUNT(*) FROM actor_techniques WHERE actor_id = OLD.actor_id
    )
    WHERE id = OLD.actor_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actor_technique_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON actor_techniques
  FOR EACH ROW
  EXECUTE FUNCTION update_actor_technique_count();

-- Sample data: Map common ransomware TTPs
-- This will be populated by the ingestion script and manual analysis

COMMENT ON TABLE techniques IS 'MITRE ATT&CK Enterprise techniques';
COMMENT ON TABLE actor_techniques IS 'Junction table mapping threat actors to their known techniques';
