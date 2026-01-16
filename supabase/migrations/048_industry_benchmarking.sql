-- Migration: Industry Benchmarking
-- Created: 2026-01-16
-- Description: Anonymized aggregate statistics for sector comparison and benchmarking

-- ============================================
-- BENCHMARK METRICS (Aggregated by Sector)
-- ============================================

CREATE TABLE IF NOT EXISTS benchmark_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Sector
  sector TEXT NOT NULL,
  -- Organization count (for weighting)
  org_count INTEGER DEFAULT 0,
  -- Incident metrics
  incident_count INTEGER DEFAULT 0,
  incident_avg_per_org FLOAT DEFAULT 0,
  incident_median_per_org FLOAT DEFAULT 0,
  incident_p90 FLOAT DEFAULT 0,
  -- Severity distribution
  incidents_critical INTEGER DEFAULT 0,
  incidents_high INTEGER DEFAULT 0,
  incidents_medium INTEGER DEFAULT 0,
  incidents_low INTEGER DEFAULT 0,
  -- Vulnerability metrics
  vuln_exposure_avg FLOAT DEFAULT 0,
  vuln_exposure_p90 FLOAT DEFAULT 0,
  kev_exposure_avg FLOAT DEFAULT 0,
  patch_time_avg_days FLOAT DEFAULT 0,
  -- Response metrics
  response_time_avg_minutes FLOAT DEFAULT 0,
  response_time_p90_minutes FLOAT DEFAULT 0,
  -- Attack vectors (JSONB for flexibility)
  top_attack_vectors JSONB DEFAULT '[]',
  top_threat_actors JSONB DEFAULT '[]',
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(period_type, period_start, sector)
);

-- ============================================
-- BENCHMARK PARTICIPATION (Opt-in tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS benchmark_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID UNIQUE NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Opt-in status
  opted_in BOOLEAN DEFAULT FALSE,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  -- Data sharing level
  share_level TEXT DEFAULT 'aggregates' CHECK (share_level IN ('none', 'aggregates', 'detailed')),
  -- Anonymization
  anonymous_id UUID DEFAULT gen_random_uuid(), -- For tracking without identifying
  -- Sector (for benchmarking)
  sector TEXT,
  org_size TEXT CHECK (org_size IN ('small', 'medium', 'large', 'enterprise')),
  region TEXT,
  -- Last contribution
  last_contributed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BENCHMARK CONTRIBUTIONS (Anonymized data)
-- ============================================

CREATE TABLE IF NOT EXISTS benchmark_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id UUID NOT NULL, -- References benchmark_participants.anonymous_id
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sector TEXT NOT NULL,
  -- Anonymized metrics
  incident_count INTEGER DEFAULT 0,
  critical_incidents INTEGER DEFAULT 0,
  high_incidents INTEGER DEFAULT 0,
  vuln_count INTEGER DEFAULT 0,
  kev_count INTEGER DEFAULT 0,
  avg_patch_days FLOAT,
  response_time_minutes FLOAT,
  -- Attack data
  attack_vectors TEXT[],
  targeted_by_actors TEXT[], -- Actor names only, no specific targeting info
  -- Submission
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(anonymous_id, period_start)
);

-- ============================================
-- BENCHMARK REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS benchmark_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Report details
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'special')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sector TEXT, -- NULL for cross-sector reports
  -- Content
  summary TEXT,
  highlights JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  charts_data JSONB DEFAULT '{}',
  -- Access
  is_public BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Calculate sector benchmarks for a period
CREATE OR REPLACE FUNCTION calculate_sector_benchmarks(
  p_period_type TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_sector TEXT;
  v_count INTEGER := 0;
BEGIN
  -- Get distinct sectors with participants
  FOR v_sector IN
    SELECT DISTINCT sector FROM benchmark_contributions
    WHERE period_start >= p_period_start
      AND period_end <= p_period_end
      AND sector IS NOT NULL
  LOOP
    INSERT INTO benchmark_metrics (
      period_type, period_start, period_end, sector,
      org_count, incident_count, incident_avg_per_org, incident_median_per_org,
      incidents_critical, incidents_high, incidents_medium, incidents_low,
      vuln_exposure_avg, patch_time_avg_days, response_time_avg_minutes
    )
    SELECT
      p_period_type,
      p_period_start,
      p_period_end,
      v_sector,
      COUNT(DISTINCT anonymous_id),
      SUM(incident_count),
      AVG(incident_count),
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY incident_count),
      SUM(critical_incidents),
      SUM(high_incidents),
      SUM(incident_count) - SUM(critical_incidents) - SUM(high_incidents), -- Estimated medium
      0, -- Low not tracked separately
      AVG(vuln_count),
      AVG(avg_patch_days),
      AVG(response_time_minutes)
    FROM benchmark_contributions
    WHERE sector = v_sector
      AND period_start >= p_period_start
      AND period_end <= p_period_end
    ON CONFLICT (period_type, period_start, sector)
    DO UPDATE SET
      org_count = EXCLUDED.org_count,
      incident_count = EXCLUDED.incident_count,
      incident_avg_per_org = EXCLUDED.incident_avg_per_org,
      incident_median_per_org = EXCLUDED.incident_median_per_org,
      incidents_critical = EXCLUDED.incidents_critical,
      incidents_high = EXCLUDED.incidents_high,
      vuln_exposure_avg = EXCLUDED.vuln_exposure_avg,
      patch_time_avg_days = EXCLUDED.patch_time_avg_days,
      response_time_avg_minutes = EXCLUDED.response_time_avg_minutes,
      calculated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Get benchmark comparison for an organization
CREATE OR REPLACE FUNCTION get_benchmark_comparison(
  p_sector TEXT,
  p_org_metrics JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_benchmark benchmark_metrics%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Get latest monthly benchmark for sector
  SELECT * INTO v_benchmark
  FROM benchmark_metrics
  WHERE sector = p_sector
    AND period_type = 'monthly'
  ORDER BY period_start DESC
  LIMIT 1;

  IF v_benchmark.id IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'message', 'No benchmark data available for this sector'
    );
  END IF;

  -- Calculate percentiles
  v_result := jsonb_build_object(
    'available', true,
    'period', jsonb_build_object(
      'start', v_benchmark.period_start,
      'end', v_benchmark.period_end
    ),
    'sector', v_benchmark.sector,
    'participants', v_benchmark.org_count,
    'comparisons', jsonb_build_object(
      'incidents', jsonb_build_object(
        'your_value', p_org_metrics->>'incident_count',
        'sector_avg', v_benchmark.incident_avg_per_org,
        'sector_median', v_benchmark.incident_median_per_org,
        'percentile', CASE
          WHEN (p_org_metrics->>'incident_count')::int <= v_benchmark.incident_avg_per_org THEN 'below_average'
          WHEN (p_org_metrics->>'incident_count')::int <= v_benchmark.incident_p90 THEN 'average'
          ELSE 'above_average'
        END
      ),
      'response_time', jsonb_build_object(
        'your_value', p_org_metrics->>'response_time_minutes',
        'sector_avg', v_benchmark.response_time_avg_minutes,
        'sector_p90', v_benchmark.response_time_p90_minutes
      ),
      'patch_time', jsonb_build_object(
        'your_value', p_org_metrics->>'patch_time_days',
        'sector_avg', v_benchmark.patch_time_avg_days
      )
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Submit benchmark contribution
CREATE OR REPLACE FUNCTION submit_benchmark_contribution(
  p_team_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_participant benchmark_participants%ROWTYPE;
  v_metrics RECORD;
BEGIN
  -- Check if team is opted in
  SELECT * INTO v_participant
  FROM benchmark_participants
  WHERE team_id = p_team_id AND opted_in = true;

  IF v_participant.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Calculate team's metrics for the period (anonymized)
  SELECT
    COUNT(*) as incident_count,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'high') as high_count
  INTO v_metrics
  FROM incidents i
  JOIN assets a ON a.id = ANY(i.affected_assets)
  WHERE a.team_id = p_team_id
    AND i.discovered_at >= p_period_start
    AND i.discovered_at < p_period_end + INTERVAL '1 day';

  -- Insert anonymized contribution
  INSERT INTO benchmark_contributions (
    anonymous_id, period_start, period_end, sector,
    incident_count, critical_incidents, high_incidents
  )
  VALUES (
    v_participant.anonymous_id,
    p_period_start,
    p_period_end,
    v_participant.sector,
    COALESCE(v_metrics.incident_count, 0),
    COALESCE(v_metrics.critical_count, 0),
    COALESCE(v_metrics.high_count, 0)
  )
  ON CONFLICT (anonymous_id, period_start)
  DO UPDATE SET
    incident_count = EXCLUDED.incident_count,
    critical_incidents = EXCLUDED.critical_incidents,
    high_incidents = EXCLUDED.high_incidents,
    submitted_at = NOW();

  -- Update last contributed
  UPDATE benchmark_participants
  SET last_contributed = NOW()
  WHERE id = v_participant.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get sector rankings
CREATE OR REPLACE FUNCTION get_sector_rankings(p_metric TEXT DEFAULT 'incident_avg_per_org')
RETURNS TABLE(
  sector TEXT,
  metric_value FLOAT,
  rank INTEGER,
  participant_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_metrics AS (
    SELECT DISTINCT ON (bm.sector)
      bm.sector,
      CASE p_metric
        WHEN 'incident_avg_per_org' THEN bm.incident_avg_per_org
        WHEN 'response_time_avg_minutes' THEN bm.response_time_avg_minutes
        WHEN 'patch_time_avg_days' THEN bm.patch_time_avg_days
        WHEN 'vuln_exposure_avg' THEN bm.vuln_exposure_avg
        ELSE bm.incident_avg_per_org
      END as metric_value,
      bm.org_count
    FROM benchmark_metrics bm
    WHERE bm.period_type = 'monthly'
    ORDER BY bm.sector, bm.period_start DESC
  )
  SELECT
    lm.sector,
    lm.metric_value,
    ROW_NUMBER() OVER (ORDER BY lm.metric_value ASC)::integer as rank,
    lm.org_count as participant_count
  FROM latest_metrics lm
  WHERE lm.org_count >= 3 -- Minimum for anonymity
  ORDER BY lm.metric_value ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_benchmark_metrics_sector ON benchmark_metrics(sector);
CREATE INDEX IF NOT EXISTS idx_benchmark_metrics_period ON benchmark_metrics(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_benchmark_participants_team ON benchmark_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_contributions_period ON benchmark_contributions(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_benchmark_contributions_sector ON benchmark_contributions(sector);
CREATE INDEX IF NOT EXISTS idx_benchmark_reports_type ON benchmark_reports(report_type, period_start);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE benchmark_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read aggregate metrics (they're anonymized)
CREATE POLICY "Anyone can view benchmark metrics" ON benchmark_metrics
  FOR SELECT USING (org_count >= 3); -- Minimum for anonymity

-- Teams can manage their own participation
CREATE POLICY "Teams can manage their benchmark participation" ON benchmark_participants
  FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Contributions are write-only (anonymized, no read access)
CREATE POLICY "System can insert contributions" ON benchmark_contributions
  FOR INSERT WITH CHECK (true);

-- Public reports visible to all
CREATE POLICY "Anyone can view public benchmark reports" ON benchmark_reports
  FOR SELECT USING (is_public = true);

-- Team members can view all reports if opted in
CREATE POLICY "Participants can view all benchmark reports" ON benchmark_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM benchmark_participants
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
        AND opted_in = true
    )
  );
