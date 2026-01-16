-- Migration: Public Status Page
-- Created: 2026-01-16
-- Description: System status, uptime monitoring, and incident communication

-- ============================================
-- STATUS PAGE CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS status_page_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  -- Page settings
  page_title TEXT DEFAULT 'System Status',
  page_description TEXT DEFAULT 'Current status of all services',
  custom_domain TEXT,
  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#00ff88',
  background_color TEXT DEFAULT '#0a0a0f',
  -- Features
  show_uptime_history BOOLEAN DEFAULT TRUE,
  show_incident_history BOOLEAN DEFAULT TRUE,
  show_scheduled_maintenance BOOLEAN DEFAULT TRUE,
  show_subscribe_button BOOLEAN DEFAULT TRUE,
  uptime_history_days INTEGER DEFAULT 90,
  -- Status messages
  all_operational_message TEXT DEFAULT 'All Systems Operational',
  degraded_message TEXT DEFAULT 'Partial System Degradation',
  outage_message TEXT DEFAULT 'Major System Outage',
  maintenance_message TEXT DEFAULT 'Scheduled Maintenance',
  -- Analytics
  track_visitors BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SERVICE COMPONENTS
-- ============================================

CREATE TABLE IF NOT EXISTS status_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- Component info
  name TEXT NOT NULL,
  description TEXT,
  -- Grouping
  group_name TEXT,
  display_order INTEGER DEFAULT 0,
  -- Status
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  status_message TEXT,
  -- Monitoring
  monitor_url TEXT,
  monitor_type TEXT CHECK (monitor_type IN ('http', 'https', 'tcp', 'ping', 'dns')),
  monitor_interval_seconds INTEGER DEFAULT 60,
  monitor_timeout_seconds INTEGER DEFAULT 30,
  -- Visibility
  is_visible BOOLEAN DEFAULT TRUE,
  -- Uptime tracking
  uptime_percentage FLOAT DEFAULT 100,
  last_checked_at TIMESTAMPTZ,
  last_incident_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STATUS INCIDENTS
-- ============================================

CREATE TABLE IF NOT EXISTS status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- Incident details
  title TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('none', 'minor', 'major', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled')),
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ, -- For maintenance
  scheduled_until TIMESTAMPTZ, -- For maintenance
  -- Affected components
  affected_component_ids UUID[],
  -- Visibility
  is_public BOOLEAN DEFAULT TRUE,
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INCIDENT UPDATES
-- ============================================

CREATE TABLE IF NOT EXISTS status_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,
  -- Update content
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'update')),
  message TEXT NOT NULL,
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPTIME RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS status_uptime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES status_components(id) ON DELETE CASCADE,
  -- Time period
  date DATE NOT NULL,
  hour INTEGER CHECK (hour >= 0 AND hour < 24),
  -- Status counts (for the hour or day)
  checks_total INTEGER DEFAULT 0,
  checks_successful INTEGER DEFAULT 0,
  checks_failed INTEGER DEFAULT 0,
  -- Response time (ms)
  response_time_avg FLOAT,
  response_time_min FLOAT,
  response_time_max FLOAT,
  -- Calculated uptime
  uptime_percentage FLOAT,
  -- Aggregation level
  aggregation TEXT DEFAULT 'hourly' CHECK (aggregation IN ('hourly', 'daily')),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(component_id, date, hour, aggregation)
);

-- ============================================
-- SUBSCRIBERS
-- ============================================

CREATE TABLE IF NOT EXISTS status_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- Subscriber info
  email TEXT NOT NULL,
  -- Subscription preferences
  notify_on_incident BOOLEAN DEFAULT TRUE,
  notify_on_maintenance BOOLEAN DEFAULT TRUE,
  notify_on_resolution BOOLEAN DEFAULT TRUE,
  -- Component filtering (NULL = all components)
  subscribed_component_ids UUID[],
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  verified_at TIMESTAMPTZ,
  -- Unsubscribe
  unsubscribe_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  unsubscribed_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, email)
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get current status summary
CREATE OR REPLACE FUNCTION get_status_summary(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_components JSONB;
  v_incidents JSONB;
  v_overall_status TEXT;
  v_config status_page_config%ROWTYPE;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM status_page_config WHERE tenant_id = p_tenant_id;

  -- Get components with their status
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'description', description,
      'group', group_name,
      'status', status,
      'statusMessage', status_message,
      'uptimePercentage', uptime_percentage,
      'lastChecked', last_checked_at
    ) ORDER BY display_order
  ), '[]'::jsonb)
  INTO v_components
  FROM status_components
  WHERE tenant_id = p_tenant_id AND is_visible = true;

  -- Get active incidents
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'title', i.title,
      'impact', i.impact,
      'status', i.status,
      'startedAt', i.started_at,
      'updates', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'status', u.status,
            'message', u.message,
            'createdAt', u.created_at
          ) ORDER BY u.created_at DESC
        ), '[]'::jsonb)
        FROM status_incident_updates u
        WHERE u.incident_id = i.id
      )
    ) ORDER BY i.started_at DESC
  ), '[]'::jsonb)
  INTO v_incidents
  FROM status_incidents i
  WHERE i.tenant_id = p_tenant_id
    AND i.is_public = true
    AND (i.status != 'resolved' OR i.resolved_at > NOW() - INTERVAL '24 hours');

  -- Determine overall status
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM status_components WHERE tenant_id = p_tenant_id AND status = 'major_outage') THEN 'major_outage'
    WHEN EXISTS (SELECT 1 FROM status_components WHERE tenant_id = p_tenant_id AND status = 'partial_outage') THEN 'partial_outage'
    WHEN EXISTS (SELECT 1 FROM status_components WHERE tenant_id = p_tenant_id AND status = 'degraded') THEN 'degraded'
    WHEN EXISTS (SELECT 1 FROM status_components WHERE tenant_id = p_tenant_id AND status = 'maintenance') THEN 'maintenance'
    ELSE 'operational'
  END INTO v_overall_status;

  RETURN jsonb_build_object(
    'overallStatus', v_overall_status,
    'statusMessage', CASE v_overall_status
      WHEN 'operational' THEN COALESCE(v_config.all_operational_message, 'All Systems Operational')
      WHEN 'degraded' THEN COALESCE(v_config.degraded_message, 'Partial System Degradation')
      WHEN 'major_outage' THEN COALESCE(v_config.outage_message, 'Major System Outage')
      WHEN 'partial_outage' THEN COALESCE(v_config.outage_message, 'Partial System Outage')
      WHEN 'maintenance' THEN COALESCE(v_config.maintenance_message, 'Scheduled Maintenance')
    END,
    'components', v_components,
    'activeIncidents', v_incidents,
    'config', jsonb_build_object(
      'pageTitle', COALESCE(v_config.page_title, 'System Status'),
      'pageDescription', v_config.page_description,
      'logoUrl', v_config.logo_url,
      'primaryColor', COALESCE(v_config.primary_color, '#00ff88'),
      'backgroundColor', COALESCE(v_config.background_color, '#0a0a0f'),
      'showUptimeHistory', COALESCE(v_config.show_uptime_history, true),
      'showIncidentHistory', COALESCE(v_config.show_incident_history, true)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Record a status check
CREATE OR REPLACE FUNCTION record_status_check(
  p_component_id UUID,
  p_success BOOLEAN,
  p_response_time_ms FLOAT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_hour INTEGER := EXTRACT(HOUR FROM NOW());
BEGIN
  -- Update or insert hourly record
  INSERT INTO status_uptime_records (
    component_id, date, hour, aggregation,
    checks_total, checks_successful, checks_failed,
    response_time_avg, response_time_min, response_time_max
  )
  VALUES (
    p_component_id, v_date, v_hour, 'hourly',
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_response_time_ms, p_response_time_ms, p_response_time_ms
  )
  ON CONFLICT (component_id, date, hour, aggregation)
  DO UPDATE SET
    checks_total = status_uptime_records.checks_total + 1,
    checks_successful = status_uptime_records.checks_successful + CASE WHEN p_success THEN 1 ELSE 0 END,
    checks_failed = status_uptime_records.checks_failed + CASE WHEN p_success THEN 0 ELSE 1 END,
    response_time_avg = (
      status_uptime_records.response_time_avg * status_uptime_records.checks_total + COALESCE(p_response_time_ms, 0)
    ) / (status_uptime_records.checks_total + 1),
    response_time_min = LEAST(status_uptime_records.response_time_min, p_response_time_ms),
    response_time_max = GREATEST(status_uptime_records.response_time_max, p_response_time_ms),
    uptime_percentage = (
      (status_uptime_records.checks_successful + CASE WHEN p_success THEN 1 ELSE 0 END)::float /
      (status_uptime_records.checks_total + 1)::float * 100
    );

  -- Update component last checked
  UPDATE status_components
  SET
    last_checked_at = NOW(),
    status = CASE
      WHEN p_success THEN 'operational'
      ELSE 'degraded'
    END
  WHERE id = p_component_id;
END;
$$ LANGUAGE plpgsql;

-- Get uptime history
CREATE OR REPLACE FUNCTION get_uptime_history(
  p_component_id UUID,
  p_days INTEGER DEFAULT 90
)
RETURNS TABLE(
  date DATE,
  uptime_percentage FLOAT,
  incidents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_uptime AS (
    SELECT
      r.date,
      AVG(r.uptime_percentage) as avg_uptime
    FROM status_uptime_records r
    WHERE r.component_id = p_component_id
      AND r.date >= CURRENT_DATE - p_days
      AND r.aggregation = 'hourly'
    GROUP BY r.date
  ),
  daily_incidents AS (
    SELECT
      DATE(i.started_at) as incident_date,
      COUNT(*) as incident_count
    FROM status_incidents i
    WHERE p_component_id = ANY(i.affected_component_ids)
      AND i.started_at >= CURRENT_DATE - p_days
    GROUP BY DATE(i.started_at)
  )
  SELECT
    d.date,
    COALESCE(du.avg_uptime, 100)::float as uptime_percentage,
    COALESCE(di.incident_count, 0)::integer as incidents
  FROM generate_series(CURRENT_DATE - p_days, CURRENT_DATE, '1 day') d(date)
  LEFT JOIN daily_uptime du ON du.date = d.date
  LEFT JOIN daily_incidents di ON di.incident_date = d.date
  ORDER BY d.date;
END;
$$ LANGUAGE plpgsql;

-- Calculate component uptime
CREATE OR REPLACE FUNCTION calculate_component_uptime(
  p_component_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS FLOAT AS $$
DECLARE
  v_uptime FLOAT;
BEGIN
  SELECT COALESCE(AVG(uptime_percentage), 100)
  INTO v_uptime
  FROM status_uptime_records
  WHERE component_id = p_component_id
    AND date >= CURRENT_DATE - p_days
    AND aggregation = 'hourly';

  -- Update component
  UPDATE status_components
  SET uptime_percentage = v_uptime
  WHERE id = p_component_id;

  RETURN v_uptime;
END;
$$ LANGUAGE plpgsql;

-- Create incident with initial update
CREATE OR REPLACE FUNCTION create_status_incident(
  p_tenant_id UUID,
  p_title TEXT,
  p_impact TEXT,
  p_message TEXT,
  p_affected_components UUID[],
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  -- Create incident
  INSERT INTO status_incidents (
    tenant_id, title, impact, status,
    affected_component_ids, created_by
  )
  VALUES (
    p_tenant_id, p_title, p_impact, 'investigating',
    p_affected_components, p_user_id
  )
  RETURNING id INTO v_incident_id;

  -- Create initial update
  INSERT INTO status_incident_updates (
    incident_id, status, message, created_by
  )
  VALUES (
    v_incident_id, 'investigating', p_message, p_user_id
  );

  -- Update component statuses
  UPDATE status_components
  SET
    status = CASE p_impact
      WHEN 'critical' THEN 'major_outage'
      WHEN 'major' THEN 'partial_outage'
      ELSE 'degraded'
    END,
    last_incident_at = NOW()
  WHERE id = ANY(p_affected_components);

  RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve incident
CREATE OR REPLACE FUNCTION resolve_status_incident(
  p_incident_id UUID,
  p_message TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_incident status_incidents%ROWTYPE;
BEGIN
  SELECT * INTO v_incident FROM status_incidents WHERE id = p_incident_id;

  IF v_incident.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update incident
  UPDATE status_incidents
  SET
    status = 'resolved',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_incident_id;

  -- Add resolution update
  INSERT INTO status_incident_updates (
    incident_id, status, message, created_by
  )
  VALUES (
    p_incident_id, 'resolved', p_message, p_user_id
  );

  -- Reset component statuses
  UPDATE status_components
  SET status = 'operational'
  WHERE id = ANY(v_incident.affected_component_ids);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_status_components_tenant ON status_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_components_status ON status_components(status);
CREATE INDEX IF NOT EXISTS idx_status_incidents_tenant ON status_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_incidents_status ON status_incidents(status);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents(started_at);
CREATE INDEX IF NOT EXISTS idx_status_uptime_component ON status_uptime_records(component_id, date);
CREATE INDEX IF NOT EXISTS idx_status_subscribers_tenant ON status_subscribers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_incident ON status_incident_updates(incident_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE status_page_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_uptime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_subscribers ENABLE ROW LEVEL SECURITY;

-- Public read access to status (for public status pages)
CREATE POLICY "Public can view status components" ON status_components
  FOR SELECT USING (is_visible = true);

CREATE POLICY "Public can view status incidents" ON status_incidents
  FOR SELECT USING (is_public = true);

CREATE POLICY "Public can view incident updates" ON status_incident_updates
  FOR SELECT USING (
    incident_id IN (SELECT id FROM status_incidents WHERE is_public = true)
  );

CREATE POLICY "Public can view uptime records" ON status_uptime_records
  FOR SELECT USING (
    component_id IN (SELECT id FROM status_components WHERE is_visible = true)
  );

-- Tenant admin management
CREATE POLICY "Tenant admins can manage status config" ON status_page_config
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Tenant admins can manage components" ON status_components
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Tenant admins can manage incidents" ON status_incidents
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Tenant admins can manage subscribers" ON status_subscribers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Anyone can subscribe
CREATE POLICY "Anyone can subscribe to status updates" ON status_subscribers
  FOR INSERT WITH CHECK (true);
