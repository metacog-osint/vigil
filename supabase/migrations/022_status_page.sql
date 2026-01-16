-- Migration 022: Status Page / SLA Dashboard
-- Phase 3.4: Uptime monitoring and SLA reporting

-- ============================================
-- Service Components
-- ============================================
CREATE TABLE IF NOT EXISTS status_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Component info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(50) UNIQUE NOT NULL,

    -- Grouping
    group_name VARCHAR(100), -- e.g., 'API', 'Web App', 'Data Feeds'
    display_order INTEGER DEFAULT 0,

    -- Current status
    status VARCHAR(20) DEFAULT 'operational',
    -- operational, degraded_performance, partial_outage, major_outage, maintenance

    -- Monitoring
    monitor_url TEXT, -- URL to ping for health checks
    monitor_interval INTEGER DEFAULT 60, -- seconds between checks
    last_check_at TIMESTAMP WITH TIME ZONE,
    last_response_time INTEGER, -- milliseconds

    -- Uptime tracking
    uptime_day NUMERIC(5,2) DEFAULT 100.00, -- last 24 hours
    uptime_week NUMERIC(5,2) DEFAULT 100.00, -- last 7 days
    uptime_month NUMERIC(5,2) DEFAULT 100.00, -- last 30 days
    uptime_quarter NUMERIC(5,2) DEFAULT 100.00, -- last 90 days

    -- Status
    is_visible BOOLEAN DEFAULT true,
    is_monitored BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_components_slug ON status_components(slug);
CREATE INDEX IF NOT EXISTS idx_status_components_visible ON status_components(is_visible, display_order);

COMMENT ON TABLE status_components IS 'Service components shown on status page';

-- ============================================
-- Status Incidents
-- ============================================
CREATE TABLE IF NOT EXISTS status_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Incident info
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Impact
    impact VARCHAR(20) NOT NULL DEFAULT 'minor',
    -- none, minor, major, critical

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'investigating',
    -- investigating, identified, monitoring, resolved

    -- Affected components
    affected_components UUID[] DEFAULT '{}',

    -- Timeline
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    identified_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Root cause (for post-mortem)
    root_cause TEXT,
    postmortem_url TEXT,

    -- Visibility
    is_public BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_status_incidents_status ON status_incidents(status);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_incidents_public ON status_incidents(is_public, started_at DESC);

COMMENT ON TABLE status_incidents IS 'Service incidents and outages';

-- ============================================
-- Incident Updates
-- ============================================
CREATE TABLE IF NOT EXISTS status_incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,

    -- Update info
    status VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON status_incident_updates(incident_id, created_at DESC);

COMMENT ON TABLE status_incident_updates IS 'Timeline updates for incidents';

-- ============================================
-- Scheduled Maintenance
-- ============================================
CREATE TABLE IF NOT EXISTS status_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Maintenance info
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Impact
    impact VARCHAR(20) DEFAULT 'minor',

    -- Schedule
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Affected components
    affected_components UUID[] DEFAULT '{}',

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',
    -- scheduled, in_progress, completed, cancelled

    -- Visibility
    is_public BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_status_maintenance_schedule ON status_maintenance(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_status_maintenance_status ON status_maintenance(status);

COMMENT ON TABLE status_maintenance IS 'Scheduled maintenance windows';

-- ============================================
-- Uptime Records (for historical tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS status_uptime_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES status_components(id) ON DELETE CASCADE,

    -- Period
    recorded_date DATE NOT NULL,

    -- Metrics
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    failed_checks INTEGER DEFAULT 0,
    uptime_percent NUMERIC(5,2) DEFAULT 100.00,
    avg_response_time INTEGER, -- milliseconds
    min_response_time INTEGER,
    max_response_time INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(component_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_uptime_records_date ON status_uptime_records(component_id, recorded_date DESC);

COMMENT ON TABLE status_uptime_records IS 'Daily uptime records per component';

-- ============================================
-- SLA Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS sla_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    -- SLA targets
    uptime_target NUMERIC(5,2) DEFAULT 99.90, -- 99.9% SLA
    response_time_target INTEGER DEFAULT 500, -- max response time in ms

    -- Credits (for SLA breaches)
    credit_policy JSONB DEFAULT '{
        "breach_99": 10,
        "breach_99_5": 25,
        "breach_99_9": 50
    }'::jsonb,

    -- Reporting
    report_frequency VARCHAR(20) DEFAULT 'monthly', -- weekly, monthly, quarterly
    report_recipients TEXT[], -- email addresses

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sla_configurations IS 'SLA configuration per tenant';

-- ============================================
-- Views
-- ============================================

-- Current system status
CREATE OR REPLACE VIEW v_system_status AS
SELECT
    sc.id,
    sc.name,
    sc.slug,
    sc.group_name,
    sc.status,
    sc.uptime_day,
    sc.uptime_week,
    sc.uptime_month,
    sc.last_check_at,
    sc.last_response_time,
    (
        SELECT COUNT(*) FROM status_incidents si
        WHERE sc.id = ANY(si.affected_components)
        AND si.status != 'resolved'
    ) as active_incidents
FROM status_components sc
WHERE sc.is_visible = true
ORDER BY sc.display_order, sc.name;

-- Active incidents
CREATE OR REPLACE VIEW v_active_incidents AS
SELECT
    si.*,
    (
        SELECT json_agg(json_build_object(
            'id', siu.id,
            'status', siu.status,
            'message', siu.message,
            'created_at', siu.created_at
        ) ORDER BY siu.created_at DESC)
        FROM status_incident_updates siu
        WHERE siu.incident_id = si.id
    ) as updates
FROM status_incidents si
WHERE si.status != 'resolved'
AND si.is_public = true
ORDER BY si.impact DESC, si.started_at DESC;

-- Upcoming maintenance
CREATE OR REPLACE VIEW v_upcoming_maintenance AS
SELECT *
FROM status_maintenance
WHERE status IN ('scheduled', 'in_progress')
AND scheduled_end > NOW()
AND is_public = true
ORDER BY scheduled_start;

-- ============================================
-- Helper Functions
-- ============================================

-- Get overall system status
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS TABLE (
    overall_status VARCHAR,
    components_operational INTEGER,
    components_degraded INTEGER,
    components_outage INTEGER,
    active_incidents INTEGER,
    upcoming_maintenance INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM status_components WHERE status IN ('major_outage', 'partial_outage')) THEN 'major_outage'::VARCHAR
            WHEN EXISTS (SELECT 1 FROM status_components WHERE status = 'degraded_performance') THEN 'degraded'::VARCHAR
            WHEN EXISTS (SELECT 1 FROM status_components WHERE status = 'maintenance') THEN 'maintenance'::VARCHAR
            ELSE 'operational'::VARCHAR
        END,
        (SELECT COUNT(*)::INTEGER FROM status_components WHERE status = 'operational' AND is_visible),
        (SELECT COUNT(*)::INTEGER FROM status_components WHERE status = 'degraded_performance' AND is_visible),
        (SELECT COUNT(*)::INTEGER FROM status_components WHERE status IN ('partial_outage', 'major_outage') AND is_visible),
        (SELECT COUNT(*)::INTEGER FROM status_incidents WHERE status != 'resolved'),
        (SELECT COUNT(*)::INTEGER FROM status_maintenance WHERE status IN ('scheduled', 'in_progress') AND scheduled_end > NOW());
END;
$$ LANGUAGE plpgsql;

-- Update component uptime metrics
CREATE OR REPLACE FUNCTION update_component_uptime(p_component_id UUID)
RETURNS VOID AS $$
DECLARE
    v_day NUMERIC;
    v_week NUMERIC;
    v_month NUMERIC;
    v_quarter NUMERIC;
BEGIN
    -- Calculate day uptime
    SELECT COALESCE(
        AVG(uptime_percent),
        100
    ) INTO v_day
    FROM status_uptime_records
    WHERE component_id = p_component_id
    AND recorded_date >= CURRENT_DATE - INTERVAL '1 day';

    -- Calculate week uptime
    SELECT COALESCE(
        AVG(uptime_percent),
        100
    ) INTO v_week
    FROM status_uptime_records
    WHERE component_id = p_component_id
    AND recorded_date >= CURRENT_DATE - INTERVAL '7 days';

    -- Calculate month uptime
    SELECT COALESCE(
        AVG(uptime_percent),
        100
    ) INTO v_month
    FROM status_uptime_records
    WHERE component_id = p_component_id
    AND recorded_date >= CURRENT_DATE - INTERVAL '30 days';

    -- Calculate quarter uptime
    SELECT COALESCE(
        AVG(uptime_percent),
        100
    ) INTO v_quarter
    FROM status_uptime_records
    WHERE component_id = p_component_id
    AND recorded_date >= CURRENT_DATE - INTERVAL '90 days';

    -- Update component
    UPDATE status_components
    SET
        uptime_day = v_day,
        uptime_week = v_week,
        uptime_month = v_month,
        uptime_quarter = v_quarter,
        updated_at = NOW()
    WHERE id = p_component_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Seed Default Components
-- ============================================
INSERT INTO status_components (name, slug, group_name, display_order, description) VALUES
    ('Web Application', 'web-app', 'Core Services', 1, 'Main web application and dashboard'),
    ('API', 'api', 'Core Services', 2, 'REST API endpoints'),
    ('Authentication', 'auth', 'Core Services', 3, 'Login and user authentication'),
    ('Database', 'database', 'Infrastructure', 4, 'Primary data storage'),
    ('Ransomware Feed', 'feed-ransomware', 'Data Feeds', 5, 'Ransomware incident data ingestion'),
    ('Vulnerability Feed', 'feed-vulnerabilities', 'Data Feeds', 6, 'CVE and KEV data ingestion'),
    ('IOC Feed', 'feed-iocs', 'Data Feeds', 7, 'Indicator of compromise data'),
    ('Scheduled Reports', 'reports', 'Features', 8, 'Automated report generation and delivery'),
    ('Alerts', 'alerts', 'Features', 9, 'Alert notifications and rules')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- RLS Policies (status page is public read)
-- ============================================
ALTER TABLE status_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_uptime_records ENABLE ROW LEVEL SECURITY;

-- Public can read visible components
CREATE POLICY components_read ON status_components
    FOR SELECT USING (is_visible = true);

-- Public can read public incidents
CREATE POLICY incidents_read ON status_incidents
    FOR SELECT USING (is_public = true);

-- Public can read incident updates
CREATE POLICY updates_read ON status_incident_updates
    FOR SELECT USING (
        incident_id IN (SELECT id FROM status_incidents WHERE is_public = true)
    );

-- Public can read public maintenance
CREATE POLICY maintenance_read ON status_maintenance
    FOR SELECT USING (is_public = true);

-- Public can read uptime records
CREATE POLICY uptime_read ON status_uptime_records
    FOR SELECT USING (true);
