-- Migration 026: Industry Benchmarking
-- Phase 4.3: Compare threat landscape against industry peers

-- ============================================
-- Benchmark Data (Aggregated Statistics)
-- ============================================
CREATE TABLE IF NOT EXISTS benchmark_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Time period
    period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Global statistics
    total_incidents INTEGER DEFAULT 0,
    total_actors_active INTEGER DEFAULT 0,
    total_vulnerabilities INTEGER DEFAULT 0,
    total_iocs INTEGER DEFAULT 0,

    -- Sector breakdown (JSONB for flexibility)
    incidents_by_sector JSONB DEFAULT '{}',
    actors_by_sector JSONB DEFAULT '{}',

    -- Severity distribution
    severity_distribution JSONB DEFAULT '{}', -- { critical: 10, high: 25, medium: 50, low: 15 }

    -- Top actors
    top_actors JSONB DEFAULT '[]', -- [{ id, name, incidents_count, trend }]

    -- Trend data
    incident_trend NUMERIC(5,2), -- Percent change from previous period
    vulnerability_trend NUMERIC(5,2),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_period ON benchmark_snapshots(period_type, period_start DESC);

COMMENT ON TABLE benchmark_snapshots IS 'Aggregated industry benchmark data for comparison';

-- ============================================
-- Sector Benchmarks (Detailed by Sector)
-- ============================================
CREATE TABLE IF NOT EXISTS sector_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Time period
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,

    -- Sector
    sector VARCHAR(50) NOT NULL,

    -- Statistics
    incident_count INTEGER DEFAULT 0,
    unique_actors INTEGER DEFAULT 0,
    unique_victims INTEGER DEFAULT 0,
    avg_incidents_per_day NUMERIC(6,2),

    -- Severity breakdown
    critical_incidents INTEGER DEFAULT 0,
    high_incidents INTEGER DEFAULT 0,
    medium_incidents INTEGER DEFAULT 0,
    low_incidents INTEGER DEFAULT 0,

    -- Top actors targeting this sector
    top_actors JSONB DEFAULT '[]',

    -- Comparison metrics
    incident_share NUMERIC(5,2), -- Percent of total incidents
    yoy_change NUMERIC(5,2), -- Year-over-year change
    mom_change NUMERIC(5,2), -- Month-over-month change
    wow_change NUMERIC(5,2), -- Week-over-week change

    -- Risk score (0-100)
    risk_score INTEGER DEFAULT 50,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(period_type, period_start, sector)
);

CREATE INDEX IF NOT EXISTS idx_sector_benchmarks_lookup ON sector_benchmarks(sector, period_type, period_start DESC);

COMMENT ON TABLE sector_benchmarks IS 'Per-sector benchmark statistics';

-- ============================================
-- User Benchmark Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS benchmark_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,

    -- Comparison sectors
    primary_sector VARCHAR(50),
    comparison_sectors TEXT[] DEFAULT '{}',

    -- Display preferences
    show_industry_average BOOLEAN DEFAULT true,
    show_top_performers BOOLEAN DEFAULT false,
    default_period VARCHAR(20) DEFAULT 'monthly',

    -- Notification preferences
    notify_sector_spike BOOLEAN DEFAULT false,
    spike_threshold INTEGER DEFAULT 25, -- Percent increase

    -- Data sharing (opt-in for richer benchmarks)
    contribute_anonymized_data BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

COMMENT ON TABLE benchmark_preferences IS 'User preferences for benchmark display';

-- ============================================
-- Views
-- ============================================

-- Latest benchmark snapshot
CREATE OR REPLACE VIEW v_latest_benchmarks AS
SELECT DISTINCT ON (period_type)
    *
FROM benchmark_snapshots
ORDER BY period_type, period_start DESC;

-- Sector rankings
CREATE OR REPLACE VIEW v_sector_rankings AS
SELECT
    sb.*,
    RANK() OVER (PARTITION BY sb.period_type ORDER BY sb.incident_count DESC) as risk_rank
FROM sector_benchmarks sb
WHERE sb.period_start = (
    SELECT MAX(period_start) FROM sector_benchmarks WHERE period_type = sb.period_type
);

-- ============================================
-- Functions
-- ============================================

-- Generate benchmark snapshot
CREATE OR REPLACE FUNCTION generate_benchmark_snapshot(
    p_period_type VARCHAR(20),
    p_start_date DATE,
    p_end_date DATE
) RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_total_incidents INTEGER;
    v_total_actors INTEGER;
    v_incidents_by_sector JSONB;
    v_top_actors JSONB;
    v_severity_dist JSONB;
    v_prev_incidents INTEGER;
    v_incident_trend NUMERIC;
BEGIN
    -- Count total incidents
    SELECT COUNT(*) INTO v_total_incidents
    FROM incidents
    WHERE discovered_date::date BETWEEN p_start_date AND p_end_date;

    -- Count active actors
    SELECT COUNT(DISTINCT threat_actor_id) INTO v_total_actors
    FROM incidents
    WHERE discovered_date::date BETWEEN p_start_date AND p_end_date
    AND threat_actor_id IS NOT NULL;

    -- Incidents by sector
    SELECT jsonb_object_agg(
        COALESCE(sector, 'unknown'),
        cnt
    ) INTO v_incidents_by_sector
    FROM (
        SELECT sector, COUNT(*) as cnt
        FROM incidents
        WHERE discovered_date::date BETWEEN p_start_date AND p_end_date
        GROUP BY sector
    ) s;

    -- Top actors
    SELECT jsonb_agg(actor_data) INTO v_top_actors
    FROM (
        SELECT jsonb_build_object(
            'id', ta.id,
            'name', ta.name,
            'count', COUNT(i.id),
            'trend', ta.trend_status
        ) as actor_data
        FROM threat_actors ta
        JOIN incidents i ON i.threat_actor_id = ta.id
        WHERE i.discovered_date::date BETWEEN p_start_date AND p_end_date
        GROUP BY ta.id, ta.name, ta.trend_status
        ORDER BY COUNT(i.id) DESC
        LIMIT 10
    ) t;

    -- Severity distribution (using status as proxy)
    SELECT jsonb_build_object(
        'critical', COUNT(*) FILTER (WHERE status IN ('confirmed', 'active')),
        'high', COUNT(*) FILTER (WHERE status = 'claimed'),
        'medium', COUNT(*) FILTER (WHERE status = 'disputed'),
        'low', COUNT(*) FILTER (WHERE status IS NULL OR status NOT IN ('confirmed', 'active', 'claimed', 'disputed'))
    ) INTO v_severity_dist
    FROM incidents
    WHERE discovered_date::date BETWEEN p_start_date AND p_end_date;

    -- Calculate trend (compare to previous period)
    SELECT COUNT(*) INTO v_prev_incidents
    FROM incidents
    WHERE discovered_date::date BETWEEN (p_start_date - (p_end_date - p_start_date + 1)) AND (p_start_date - 1);

    IF v_prev_incidents > 0 THEN
        v_incident_trend := ((v_total_incidents - v_prev_incidents)::NUMERIC / v_prev_incidents) * 100;
    ELSE
        v_incident_trend := 0;
    END IF;

    -- Insert or update snapshot
    INSERT INTO benchmark_snapshots (
        period_type,
        period_start,
        period_end,
        total_incidents,
        total_actors_active,
        incidents_by_sector,
        top_actors,
        severity_distribution,
        incident_trend
    ) VALUES (
        p_period_type,
        p_start_date,
        p_end_date,
        v_total_incidents,
        v_total_actors,
        COALESCE(v_incidents_by_sector, '{}'),
        COALESCE(v_top_actors, '[]'),
        v_severity_dist,
        v_incident_trend
    )
    ON CONFLICT (period_type, period_start) DO UPDATE SET
        period_end = EXCLUDED.period_end,
        total_incidents = EXCLUDED.total_incidents,
        total_actors_active = EXCLUDED.total_actors_active,
        incidents_by_sector = EXCLUDED.incidents_by_sector,
        top_actors = EXCLUDED.top_actors,
        severity_distribution = EXCLUDED.severity_distribution,
        incident_trend = EXCLUDED.incident_trend,
        created_at = NOW()
    RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Generate sector benchmarks
CREATE OR REPLACE FUNCTION generate_sector_benchmarks(
    p_period_type VARCHAR(20),
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_total_incidents INTEGER;
    v_sector RECORD;
    v_prev_count INTEGER;
    v_top_actors JSONB;
BEGIN
    -- Get total incidents for period
    SELECT COUNT(*) INTO v_total_incidents
    FROM incidents
    WHERE discovered_date::date BETWEEN p_start_date AND p_end_date;

    -- Generate benchmarks for each sector
    FOR v_sector IN
        SELECT sector, COUNT(*) as incident_count
        FROM incidents
        WHERE discovered_date::date BETWEEN p_start_date AND p_end_date
        AND sector IS NOT NULL
        GROUP BY sector
    LOOP
        -- Get previous period count for trend
        SELECT COUNT(*) INTO v_prev_count
        FROM incidents
        WHERE discovered_date::date BETWEEN (p_start_date - (p_end_date - p_start_date + 1)) AND (p_start_date - 1)
        AND sector = v_sector.sector;

        -- Get top actors for sector
        SELECT jsonb_agg(actor_data) INTO v_top_actors
        FROM (
            SELECT jsonb_build_object(
                'id', ta.id,
                'name', ta.name,
                'count', COUNT(i.id)
            ) as actor_data
            FROM threat_actors ta
            JOIN incidents i ON i.threat_actor_id = ta.id
            WHERE i.discovered_date::date BETWEEN p_start_date AND p_end_date
            AND i.sector = v_sector.sector
            GROUP BY ta.id, ta.name
            ORDER BY COUNT(i.id) DESC
            LIMIT 5
        ) t;

        -- Insert or update sector benchmark
        INSERT INTO sector_benchmarks (
            period_type,
            period_start,
            sector,
            incident_count,
            unique_actors,
            incident_share,
            wow_change,
            top_actors,
            risk_score
        ) VALUES (
            p_period_type,
            p_start_date,
            v_sector.sector,
            v_sector.incident_count,
            (
                SELECT COUNT(DISTINCT threat_actor_id)
                FROM incidents
                WHERE discovered_date::date BETWEEN p_start_date AND p_end_date
                AND sector = v_sector.sector
            ),
            CASE WHEN v_total_incidents > 0
                THEN (v_sector.incident_count::NUMERIC / v_total_incidents) * 100
                ELSE 0
            END,
            CASE WHEN v_prev_count > 0
                THEN ((v_sector.incident_count - v_prev_count)::NUMERIC / v_prev_count) * 100
                ELSE 0
            END,
            COALESCE(v_top_actors, '[]'),
            -- Risk score based on incident share and trend
            LEAST(100, GREATEST(0,
                50 + (v_sector.incident_count::NUMERIC / NULLIF(v_total_incidents, 0) * 100) +
                CASE WHEN v_prev_count > 0
                    THEN ((v_sector.incident_count - v_prev_count)::NUMERIC / v_prev_count) * 20
                    ELSE 0
                END
            ))::INTEGER
        )
        ON CONFLICT (period_type, period_start, sector) DO UPDATE SET
            incident_count = EXCLUDED.incident_count,
            unique_actors = EXCLUDED.unique_actors,
            incident_share = EXCLUDED.incident_share,
            wow_change = EXCLUDED.wow_change,
            top_actors = EXCLUDED.top_actors,
            risk_score = EXCLUDED.risk_score,
            created_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================

-- Benchmark snapshots are public (anonymized data)
ALTER TABLE benchmark_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmark_snapshots_read ON benchmark_snapshots
    FOR SELECT USING (true);

-- Sector benchmarks are public
ALTER TABLE sector_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY sector_benchmarks_read ON sector_benchmarks
    FOR SELECT USING (true);

-- Preferences are private
ALTER TABLE benchmark_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmark_preferences_access ON benchmark_preferences
    FOR ALL USING (user_id = current_setting('app.user_id', true));
