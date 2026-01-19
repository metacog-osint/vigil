-- Migration 061: UMD Cyber Events Database
-- Structured cyber attack events with attribution from CISSM/UMD
-- Source: https://cissm.umd.edu/cyber-events-database

CREATE TABLE IF NOT EXISTS cyber_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- UMD unique identifier

  -- Dates
  event_date DATE,
  reported_date DATE,
  year INTEGER,
  month INTEGER,

  -- Actor Information
  actor_name TEXT,
  actor_type TEXT,  -- Criminal, Hacktivist, Nation-State, Terrorist, Hobbyist
  actor_country TEXT,

  -- Target Information
  target_organization TEXT,
  target_industry TEXT,
  target_industry_code TEXT,  -- NAICS code
  target_country TEXT,
  target_state TEXT,
  target_county TEXT,

  -- Event Classification
  event_type TEXT,  -- Disruptive, Exploitive, Mixed
  event_subtype TEXT,
  motive TEXT,  -- Financial, Political-Espionage, Sabotage, Protest, etc.

  -- Impact Metrics
  magnitude TEXT,
  duration TEXT,
  scope TEXT,
  ip_affected BOOLEAN DEFAULT false,
  org_data_affected BOOLEAN DEFAULT false,
  customer_data_affected BOOLEAN DEFAULT false,

  -- Description and Source
  description TEXT,
  source_url TEXT,

  -- Geopolitical Flags (target country membership)
  geopolitical_flags JSONB DEFAULT '{}',

  -- Metadata
  original_method INTEGER,  -- 1 = original scraping, 2+ = GDELT
  source TEXT DEFAULT 'umd-cissm',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cyber_events_slug ON cyber_events(slug);
CREATE INDEX IF NOT EXISTS idx_cyber_events_date ON cyber_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_cyber_events_year ON cyber_events(year);
CREATE INDEX IF NOT EXISTS idx_cyber_events_actor ON cyber_events(actor_name);
CREATE INDEX IF NOT EXISTS idx_cyber_events_actor_type ON cyber_events(actor_type);
CREATE INDEX IF NOT EXISTS idx_cyber_events_target_country ON cyber_events(target_country);
CREATE INDEX IF NOT EXISTS idx_cyber_events_industry ON cyber_events(target_industry);
CREATE INDEX IF NOT EXISTS idx_cyber_events_event_type ON cyber_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cyber_events_motive ON cyber_events(motive);

-- Full-text search on description
CREATE INDEX IF NOT EXISTS idx_cyber_events_description_fts
  ON cyber_events USING gin(to_tsvector('english', COALESCE(description, '')));

-- RLS
ALTER TABLE cyber_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cyber_events"
  ON cyber_events FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access to cyber_events"
  ON cyber_events FOR ALL
  USING (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE TRIGGER trigger_cyber_events_updated_at
  BEFORE UPDATE ON cyber_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for nation-state events
CREATE OR REPLACE VIEW nation_state_events AS
SELECT * FROM cyber_events
WHERE actor_type = 'Nation-State'
ORDER BY event_date DESC;

-- Create view for ransomware/criminal events
CREATE OR REPLACE VIEW criminal_events AS
SELECT * FROM cyber_events
WHERE actor_type = 'Criminal'
ORDER BY event_date DESC;

-- Create materialized view for actor statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS cyber_event_actor_stats AS
SELECT
  actor_name,
  actor_type,
  actor_country,
  COUNT(*) as total_events,
  COUNT(DISTINCT target_country) as countries_targeted,
  COUNT(DISTINCT target_industry) as industries_targeted,
  MIN(event_date) as first_seen,
  MAX(event_date) as last_seen,
  array_agg(DISTINCT motive) FILTER (WHERE motive IS NOT NULL AND motive != 'Undetermined') as motives,
  array_agg(DISTINCT event_type) FILTER (WHERE event_type IS NOT NULL) as event_types
FROM cyber_events
WHERE actor_name IS NOT NULL AND actor_name != 'Undetermined'
GROUP BY actor_name, actor_type, actor_country
ORDER BY total_events DESC;

-- Note: Using composite key since actors can have different types over time
CREATE UNIQUE INDEX IF NOT EXISTS idx_cyber_event_actor_stats_name_type
  ON cyber_event_actor_stats(actor_name, actor_type);

-- Function to refresh actor stats
CREATE OR REPLACE FUNCTION refresh_cyber_event_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cyber_event_actor_stats;
END;
$$ LANGUAGE plpgsql;

-- Industry mapping from NAICS codes
COMMENT ON TABLE cyber_events IS 'UMD CISSM Cyber Events Database - structured cyber attack events with nation-state attribution';
COMMENT ON COLUMN cyber_events.target_industry_code IS 'NAICS industry code (e.g., 61=Educational Services, 52=Finance, 92=Government)';
COMMENT ON COLUMN cyber_events.geopolitical_flags IS 'Target country membership in orgs: nato, eu, g7, g20, five_eyes, oecd, etc.';
