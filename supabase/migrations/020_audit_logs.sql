-- Migration 020: Audit Logs
-- Phase 3.2: Detailed activity logs for compliance

-- ============================================
-- Audit Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor information
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- auth, data, settings, admin, api, export

    -- Resource affected
    resource_type VARCHAR(50), -- actor, incident, ioc, vulnerability, investigation, etc.
    resource_id UUID,
    resource_name VARCHAR(255),

    -- Action details
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, export, login, logout, etc.
    description TEXT,

    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),

    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    -- Can include: old_values, new_values, query_params, filters, etc.

    -- Outcome
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Partition by month for efficient querying and retention
    logged_month DATE GENERATED ALWAYS AS (date_trunc('month', created_at)::date) STORED
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_month ON audit_logs(logged_month);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status) WHERE status != 'success';

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance and security monitoring';

-- ============================================
-- Event Types Reference
-- ============================================
-- Auth events: user.login, user.logout, user.mfa_enrolled, user.mfa_verified, user.password_changed
-- Data events: search.executed, entity.viewed, entity.created, entity.updated, entity.deleted
-- Export events: export.csv, export.stix, export.pdf, report.generated
-- Settings events: settings.updated, profile.updated, api_key.created, api_key.revoked
-- Admin events: team.member_invited, team.member_removed, team.role_changed
-- API events: api.request, api.rate_limited, api.key_used

-- ============================================
-- Audit Log Retention Settings
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    -- Retention period in days (default 90 days, enterprise can extend)
    retention_days INTEGER DEFAULT 90,

    -- What to log (enterprise can customize)
    log_auth_events BOOLEAN DEFAULT true,
    log_data_events BOOLEAN DEFAULT true,
    log_export_events BOOLEAN DEFAULT true,
    log_settings_events BOOLEAN DEFAULT true,
    log_admin_events BOOLEAN DEFAULT true,
    log_api_events BOOLEAN DEFAULT true,

    -- Export settings
    auto_export_enabled BOOLEAN DEFAULT false,
    auto_export_format VARCHAR(10) DEFAULT 'json', -- json, csv
    auto_export_frequency VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly
    auto_export_destination TEXT, -- S3 bucket, webhook URL, etc.

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(team_id)
);

COMMENT ON TABLE audit_log_settings IS 'Per-team audit log configuration';

-- ============================================
-- Audit Summary View
-- ============================================
CREATE OR REPLACE VIEW v_audit_summary AS
SELECT
    user_id,
    team_id,
    event_category,
    action,
    DATE(created_at) as log_date,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE status = 'failure') as failure_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY user_id, team_id, event_category, action, DATE(created_at);

-- ============================================
-- Recent Activity View
-- ============================================
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
    id,
    user_id,
    user_email,
    event_type,
    event_category,
    resource_type,
    resource_name,
    action,
    description,
    status,
    ip_address,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 1000;

-- ============================================
-- Function to log audit events
-- ============================================
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id VARCHAR(255),
    p_user_email VARCHAR(255),
    p_event_type VARCHAR(100),
    p_event_category VARCHAR(50),
    p_action VARCHAR(50),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_resource_name VARCHAR(255) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_team_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, team_id,
        event_type, event_category, action,
        resource_type, resource_id, resource_name,
        description, metadata,
        ip_address, user_agent,
        status, error_message
    ) VALUES (
        p_user_id, p_user_email, p_team_id,
        p_event_type, p_event_category, p_action,
        p_resource_type, p_resource_id, p_resource_name,
        p_description, p_metadata,
        p_ip_address, p_user_agent,
        p_status, p_error_message
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to cleanup old audit logs
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_team RECORD;
BEGIN
    -- For each team with custom retention
    FOR v_team IN
        SELECT team_id, retention_days
        FROM audit_log_settings
        WHERE retention_days IS NOT NULL
    LOOP
        DELETE FROM audit_logs
        WHERE team_id = v_team.team_id
        AND created_at < NOW() - (v_team.retention_days || ' days')::INTERVAL;

        GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;
    END LOOP;

    -- Default cleanup for logs without team or custom settings (90 days)
    DELETE FROM audit_logs
    WHERE (team_id IS NULL OR team_id NOT IN (SELECT team_id FROM audit_log_settings WHERE team_id IS NOT NULL))
    AND created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_settings ENABLE ROW LEVEL SECURITY;

-- Users can see their own audit logs, admins can see team logs
CREATE POLICY audit_logs_access ON audit_logs
    FOR SELECT USING (
        user_id = current_setting('app.user_id', true)
        OR (team_id IS NOT NULL AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        ))
    );

-- Only allow inserts (no updates/deletes for audit integrity)
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY audit_log_settings_access ON audit_log_settings
    FOR ALL USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        )
    );
