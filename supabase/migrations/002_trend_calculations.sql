-- Migration 002: Trend Calculations and Actor Aliasing
-- Adds trend status, incident velocity, and alias deduplication

-- ============================================
-- ADD TREND COLUMNS TO THREAT_ACTORS
-- ============================================

ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS trend_status TEXT DEFAULT 'STABLE';
ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS incident_velocity NUMERIC DEFAULT 0;
ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS incidents_7d INTEGER DEFAULT 0;
ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS incidents_prev_7d INTEGER DEFAULT 0;
ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE threat_actors ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;

-- ============================================
-- ACTOR ALIAS MAPPING TABLE
-- For deduplicating known aliases
-- ============================================

CREATE TABLE IF NOT EXISTS actor_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias TEXT NOT NULL UNIQUE,
  canonical_actor_id UUID REFERENCES threat_actors(id) ON DELETE CASCADE,
  source TEXT,  -- manual, ransomwatch, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed known aliases
INSERT INTO actor_aliases (alias, canonical_actor_id, source)
SELECT alias, ta.id, 'manual'
FROM (VALUES
  ('ALPHV', 'BlackCat'),
  ('Noberus', 'BlackCat'),
  ('LockBit 3.0', 'LockBit'),
  ('LockBit Black', 'LockBit'),
  ('LockBit Green', 'LockBit'),
  ('Clop', 'Cl0p'),
  ('TA505', 'Cl0p'),
  ('PlayCrypt', 'Play'),
  ('Hive', 'Hive'),
  ('Royal Ransomware', 'Royal'),
  ('BlackBasta', 'Black Basta'),
  ('Vice Society', 'Vice Society'),
  ('BianLian', 'BianLian'),
  ('Medusa', 'Medusa'),
  ('Akira', 'Akira'),
  ('Rhysida', 'Rhysida'),
  ('NoEscape', 'NoEscape'),
  ('Hunters International', 'Hunters International'),
  ('8Base', '8Base'),
  ('Qilin', 'Qilin'),
  ('Agenda', 'Qilin'),
  ('RansomHub', 'RansomHub'),
  ('INC Ransom', 'INC Ransom')
) AS aliases(alias, canonical_name)
JOIN threat_actors ta ON ta.name = aliases.canonical_name
ON CONFLICT (alias) DO NOTHING;

-- ============================================
-- SECTOR KEYWORDS TABLE
-- For inferring victim sectors from names
-- ============================================

CREATE TABLE IF NOT EXISTS sector_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  sector TEXT NOT NULL,
  priority INTEGER DEFAULT 1  -- Higher = more specific
);

-- Seed sector keywords
INSERT INTO sector_keywords (keyword, sector, priority) VALUES
  -- Healthcare
  ('hospital', 'healthcare', 10),
  ('medical', 'healthcare', 9),
  ('health', 'healthcare', 8),
  ('clinic', 'healthcare', 9),
  ('pharma', 'healthcare', 8),
  ('dental', 'healthcare', 8),
  ('surgery', 'healthcare', 8),
  ('therapy', 'healthcare', 7),
  ('care', 'healthcare', 5),

  -- Finance
  ('bank', 'finance', 10),
  ('credit union', 'finance', 10),
  ('insurance', 'finance', 9),
  ('financial', 'finance', 9),
  ('investment', 'finance', 8),
  ('capital', 'finance', 6),
  ('wealth', 'finance', 7),
  ('mortgage', 'finance', 8),

  -- Education
  ('university', 'education', 10),
  ('college', 'education', 10),
  ('school', 'education', 9),
  ('academy', 'education', 8),
  ('institute', 'education', 7),
  ('education', 'education', 9),

  -- Government
  ('city of', 'government', 10),
  ('county', 'government', 10),
  ('municipality', 'government', 10),
  ('state of', 'government', 10),
  ('government', 'government', 10),
  ('federal', 'government', 10),
  ('department of', 'government', 9),

  -- Manufacturing
  ('manufacturing', 'manufacturing', 10),
  ('factory', 'manufacturing', 9),
  ('industrial', 'manufacturing', 8),
  ('steel', 'manufacturing', 8),
  ('automotive', 'manufacturing', 9),
  ('aerospace', 'manufacturing', 9),

  -- Technology
  ('software', 'technology', 10),
  ('tech', 'technology', 8),
  ('digital', 'technology', 7),
  ('cyber', 'technology', 8),
  ('data', 'technology', 6),
  ('cloud', 'technology', 8),
  ('systems', 'technology', 5),
  ('solutions', 'technology', 4),

  -- Retail
  ('retail', 'retail', 10),
  ('store', 'retail', 7),
  ('shop', 'retail', 6),
  ('market', 'retail', 5),
  ('supermarket', 'retail', 9),

  -- Energy
  ('energy', 'energy', 10),
  ('power', 'energy', 7),
  ('utility', 'energy', 9),
  ('electric', 'energy', 8),
  ('gas', 'energy', 7),
  ('oil', 'energy', 8),
  ('petroleum', 'energy', 9),

  -- Legal
  ('law firm', 'legal', 10),
  ('legal', 'legal', 9),
  ('attorney', 'legal', 10),
  ('lawyer', 'legal', 10),
  ('llp', 'legal', 7),

  -- Transportation
  ('logistics', 'transportation', 9),
  ('shipping', 'transportation', 9),
  ('transport', 'transportation', 9),
  ('freight', 'transportation', 9),
  ('trucking', 'transportation', 9),
  ('airline', 'transportation', 10),
  ('aviation', 'transportation', 9)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sector_keywords ON sector_keywords(keyword);

-- ============================================
-- FUNCTION: Calculate Actor Trends
-- Run this periodically (every hour via cron)
-- ============================================

CREATE OR REPLACE FUNCTION calculate_actor_trends()
RETURNS TABLE (
  actor_id UUID,
  actor_name TEXT,
  new_trend_status TEXT,
  new_velocity NUMERIC,
  incidents_7d INTEGER,
  incidents_prev_7d INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH actor_stats AS (
    SELECT
      ta.id,
      ta.name,
      COUNT(i7.id)::INTEGER as cnt_7d,
      COUNT(i14.id)::INTEGER as cnt_prev_7d
    FROM threat_actors ta
    LEFT JOIN incidents i7 ON i7.actor_id = ta.id
      AND i7.discovered_date >= CURRENT_DATE - 7
    LEFT JOIN incidents i14 ON i14.actor_id = ta.id
      AND i14.discovered_date >= CURRENT_DATE - 14
      AND i14.discovered_date < CURRENT_DATE - 7
    GROUP BY ta.id, ta.name
  )
  SELECT
    s.id as actor_id,
    s.name as actor_name,
    CASE
      WHEN s.cnt_7d > GREATEST(s.cnt_prev_7d, 1) * 1.25 THEN 'ESCALATING'
      WHEN s.cnt_7d < s.cnt_prev_7d * 0.75 THEN 'DECLINING'
      ELSE 'STABLE'
    END as new_trend_status,
    ROUND(s.cnt_7d::NUMERIC / 7.0, 2) as new_velocity,
    s.cnt_7d as incidents_7d,
    s.cnt_prev_7d as incidents_prev_7d
  FROM actor_stats s;
END;
$$ LANGUAGE plpgsql;

-- Update function to apply trends
CREATE OR REPLACE FUNCTION apply_actor_trends()
RETURNS void AS $$
BEGIN
  UPDATE threat_actors ta SET
    trend_status = trends.new_trend_status,
    incident_velocity = trends.new_velocity,
    incidents_7d = trends.incidents_7d,
    incidents_prev_7d = trends.incidents_prev_7d,
    updated_at = NOW()
  FROM calculate_actor_trends() trends
  WHERE ta.id = trends.actor_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Infer Sector from Victim Name
-- ============================================

CREATE OR REPLACE FUNCTION infer_sector(victim_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT sector INTO result
  FROM sector_keywords
  WHERE LOWER(victim_name) LIKE '%' || LOWER(keyword) || '%'
  ORDER BY priority DESC
  LIMIT 1;

  RETURN COALESCE(result, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Resolve Actor Alias
-- Returns canonical actor ID for a given name
-- ============================================

CREATE OR REPLACE FUNCTION resolve_actor_alias(actor_name TEXT)
RETURNS UUID AS $$
DECLARE
  canonical_id UUID;
BEGIN
  -- First check if it's already a canonical name
  SELECT id INTO canonical_id
  FROM threat_actors
  WHERE LOWER(name) = LOWER(actor_name);

  IF canonical_id IS NOT NULL THEN
    RETURN canonical_id;
  END IF;

  -- Then check alias table
  SELECT canonical_actor_id INTO canonical_id
  FROM actor_aliases
  WHERE LOWER(alias) = LOWER(actor_name);

  RETURN canonical_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-infer sector on incident insert
-- ============================================

CREATE OR REPLACE FUNCTION auto_infer_incident_sector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.victim_sector IS NULL OR NEW.victim_sector = '' OR NEW.victim_sector = 'unknown' THEN
    NEW.victim_sector := infer_sector(NEW.victim_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_infer_sector ON incidents;
CREATE TRIGGER trigger_infer_sector
  BEFORE INSERT OR UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION auto_infer_incident_sector();

-- ============================================
-- INDEXES FOR TREND QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_incidents_discovered_recent
  ON incidents(discovered_date DESC)
  WHERE discovered_date >= CURRENT_DATE - 30;

CREATE INDEX IF NOT EXISTS idx_actors_trend
  ON threat_actors(trend_status, incident_velocity DESC);

-- ============================================
-- RUN INITIAL TREND CALCULATION
-- ============================================

SELECT apply_actor_trends();

COMMIT;
