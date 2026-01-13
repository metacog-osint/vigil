-- Migration 007: Trend Analysis Tables
-- Enables persistent weekly snapshots and actor trajectory tracking

-- ============================================
-- WEEKLY SUMMARIES TABLE
-- Stores aggregated weekly statistics for trend comparison
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Incident metrics
  incidents_total INTEGER DEFAULT 0,
  incidents_by_sector JSONB DEFAULT '{}',
  incidents_by_country JSONB DEFAULT '{}',

  -- Actor metrics
  actors_active INTEGER DEFAULT 0,
  actors_escalating INTEGER DEFAULT 0,
  actors_new INTEGER DEFAULT 0,
  top_actors JSONB DEFAULT '[]',

  -- Vulnerability metrics
  kevs_added INTEGER DEFAULT 0,
  critical_vulns_added INTEGER DEFAULT 0,

  -- Change metrics
  incident_change_pct NUMERIC,
  actor_change_pct NUMERIC,

  -- AI-generated summary (optional)
  ai_summary TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(week_start)
);

-- Index for efficient week lookups
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week ON weekly_summaries(week_start DESC);

-- ============================================
-- ACTOR TREND HISTORY TABLE
-- Daily snapshots of actor metrics for trajectory visualization
-- ============================================
CREATE TABLE IF NOT EXISTS actor_trend_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES threat_actors(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Trend metrics at time of snapshot
  trend_status TEXT,
  incidents_7d INTEGER DEFAULT 0,
  incidents_30d INTEGER DEFAULT 0,
  incident_velocity NUMERIC DEFAULT 0,

  -- Additional context
  rank_position INTEGER,  -- Position in top actors list

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(actor_id, recorded_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_actor_trend_history_actor ON actor_trend_history(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_trend_history_date ON actor_trend_history(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_actor_trend_history_actor_date ON actor_trend_history(actor_id, recorded_date DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get week boundaries
CREATE OR REPLACE FUNCTION get_week_boundaries(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(week_start DATE, week_end DATE) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('week', target_date)::DATE as week_start,
    (DATE_TRUNC('week', target_date) + INTERVAL '6 days')::DATE as week_end;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate weekly summary
CREATE OR REPLACE FUNCTION calculate_weekly_summary(target_week_start DATE)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  prev_week_start DATE;
  current_incidents INTEGER;
  prev_incidents INTEGER;
BEGIN
  prev_week_start := target_week_start - INTERVAL '7 days';

  -- Get current week incidents
  SELECT COUNT(*) INTO current_incidents
  FROM incidents
  WHERE discovered_date >= target_week_start
    AND discovered_date < target_week_start + INTERVAL '7 days';

  -- Get previous week incidents
  SELECT COUNT(*) INTO prev_incidents
  FROM incidents
  WHERE discovered_date >= prev_week_start
    AND discovered_date < target_week_start;

  -- Build result
  result := jsonb_build_object(
    'incidents_total', current_incidents,
    'incidents_prev', prev_incidents,
    'incident_change_pct',
      CASE WHEN prev_incidents > 0
        THEN ROUND(((current_incidents - prev_incidents)::NUMERIC / prev_incidents) * 100, 1)
        ELSE NULL
      END,
    'actors_active', (
      SELECT COUNT(DISTINCT actor_id)
      FROM incidents
      WHERE discovered_date >= target_week_start
        AND discovered_date < target_week_start + INTERVAL '7 days'
        AND actor_id IS NOT NULL
    ),
    'actors_escalating', (
      SELECT COUNT(*)
      FROM threat_actors
      WHERE trend_status = 'ESCALATING'
    ),
    'kevs_added', (
      SELECT COUNT(*)
      FROM vulnerabilities
      WHERE kev_date >= target_week_start
        AND kev_date < target_week_start + INTERVAL '7 days'
    )
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to snapshot actor trends (called daily)
CREATE OR REPLACE FUNCTION snapshot_actor_trends()
RETURNS INTEGER AS $$
DECLARE
  snapshot_count INTEGER := 0;
BEGIN
  -- Insert today's snapshot for active actors
  INSERT INTO actor_trend_history (actor_id, recorded_date, trend_status, incidents_7d, incidents_30d, incident_velocity, rank_position)
  SELECT
    id,
    CURRENT_DATE,
    trend_status,
    incidents_7d,
    COALESCE((
      SELECT COUNT(*)
      FROM incidents
      WHERE actor_id = threat_actors.id
        AND discovered_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as incidents_30d,
    incident_velocity,
    ROW_NUMBER() OVER (ORDER BY incidents_7d DESC NULLS LAST)
  FROM threat_actors
  WHERE last_seen >= CURRENT_DATE - INTERVAL '30 days'
    OR trend_status = 'ESCALATING'
  ON CONFLICT (actor_id, recorded_date)
  DO UPDATE SET
    trend_status = EXCLUDED.trend_status,
    incidents_7d = EXCLUDED.incidents_7d,
    incidents_30d = EXCLUDED.incidents_30d,
    incident_velocity = EXCLUDED.incident_velocity,
    rank_position = EXCLUDED.rank_position;

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;
  RETURN snapshot_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for recent weekly comparisons
CREATE OR REPLACE VIEW recent_weekly_trends AS
SELECT
  ws.*,
  LAG(incidents_total) OVER (ORDER BY week_start) as prev_week_incidents,
  LAG(actors_active) OVER (ORDER BY week_start) as prev_week_actors
FROM weekly_summaries ws
ORDER BY week_start DESC
LIMIT 12;

-- View for actor trajectory data (last 90 days)
CREATE OR REPLACE VIEW actor_trajectories AS
SELECT
  ath.actor_id,
  ta.name as actor_name,
  ath.recorded_date,
  ath.trend_status,
  ath.incidents_7d,
  ath.incidents_30d,
  ath.incident_velocity,
  ath.rank_position
FROM actor_trend_history ath
JOIN threat_actors ta ON ta.id = ath.actor_id
WHERE ath.recorded_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY ath.actor_id, ath.recorded_date DESC;

-- ============================================
-- ENABLE RLS (for future auth)
-- ============================================
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_trend_history ENABLE ROW LEVEL SECURITY;

-- Public read access (adjust when auth is implemented)
CREATE POLICY "Public read access for weekly_summaries" ON weekly_summaries
  FOR SELECT USING (true);

CREATE POLICY "Public read access for actor_trend_history" ON actor_trend_history
  FOR SELECT USING (true);
