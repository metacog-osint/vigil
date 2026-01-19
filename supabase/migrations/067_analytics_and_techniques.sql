-- Migration: Analytics Events and MITRE Techniques Tables
-- Created: January 18, 2026
-- Purpose: Create missing optional tables to prevent 404 errors in console

-- ============================================
-- ANALYTICS EVENTS TABLE
-- Tracks user interactions and page views for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  page_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for tracking (controlled by app logic)
CREATE POLICY "Allow anonymous event tracking"
  ON analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only allow users to read their own events
CREATE POLICY "Users can read own events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================
-- MITRE TECHNIQUES TABLE
-- Stores MITRE ATT&CK techniques for threat mapping
-- ============================================
CREATE TABLE IF NOT EXISTS mitre_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id TEXT UNIQUE NOT NULL,  -- e.g., T1059, T1059.001
  name TEXT NOT NULL,
  tactic TEXT,  -- e.g., execution, persistence, defense-evasion
  description TEXT,
  detection TEXT,
  platforms TEXT[] DEFAULT '{}',
  data_sources TEXT[] DEFAULT '{}',
  is_subtechnique BOOLEAN DEFAULT FALSE,
  parent_technique_id TEXT,
  url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for technique lookups
CREATE INDEX IF NOT EXISTS idx_mitre_techniques_id ON mitre_techniques(technique_id);
CREATE INDEX IF NOT EXISTS idx_mitre_techniques_tactic ON mitre_techniques(tactic);
CREATE INDEX IF NOT EXISTS idx_mitre_techniques_name ON mitre_techniques(name);
CREATE INDEX IF NOT EXISTS idx_mitre_techniques_parent ON mitre_techniques(parent_technique_id);

-- RLS policies - techniques are publicly readable
ALTER TABLE mitre_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Techniques are publicly readable"
  ON mitre_techniques FOR SELECT
  TO anon, authenticated
  USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_mitre_techniques_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mitre_techniques_updated
  BEFORE UPDATE ON mitre_techniques
  FOR EACH ROW
  EXECUTE FUNCTION update_mitre_techniques_timestamp();

-- Add comments
COMMENT ON TABLE analytics_events IS 'Tracks user interactions and page views for analytics';
COMMENT ON TABLE mitre_techniques IS 'MITRE ATT&CK techniques for threat mapping and correlation';
COMMENT ON COLUMN mitre_techniques.technique_id IS 'MITRE technique ID (e.g., T1059, T1059.001)';
COMMENT ON COLUMN mitre_techniques.tactic IS 'MITRE tactic category (execution, persistence, etc.)';
