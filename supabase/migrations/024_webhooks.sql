-- Migration 024: API Webhooks
-- Phase 4.1: Push events to customer systems in real-time

-- ============================================
-- Webhook Endpoints
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    -- Endpoint configuration
    name VARCHAR(100) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,

    -- Authentication
    secret VARCHAR(255), -- For HMAC signature verification
    auth_type VARCHAR(20) DEFAULT 'signature', -- signature, bearer, basic, none
    auth_header VARCHAR(100), -- Custom auth header name
    auth_value_encrypted TEXT, -- Encrypted bearer token or basic auth

    -- Event subscriptions
    events TEXT[] NOT NULL DEFAULT '{}',
    -- Available: incident.created, incident.updated, actor.created, actor.trend_changed,
    -- vulnerability.created, vulnerability.kev_added, ioc.created, ioc.matched,
    -- alert.triggered, report.generated, watchlist.match

    -- Filters (optional)
    filters JSONB DEFAULT '{}',
    -- Example: { "sectors": ["healthcare"], "severity": ["critical", "high"] }

    -- Status
    is_enabled BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,

    -- Rate limiting
    rate_limit INTEGER DEFAULT 100, -- max events per minute

    -- Retry configuration
    max_retries INTEGER DEFAULT 5,
    retry_delay_seconds INTEGER DEFAULT 60,

    -- Statistics
    total_sent INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT webhooks_url_valid CHECK (url ~ '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_team ON webhooks(team_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(is_enabled);

COMMENT ON TABLE webhooks IS 'Webhook endpoint configurations for event delivery';

-- ============================================
-- Webhook Deliveries (Event Log)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

    -- Event info
    event_type VARCHAR(50) NOT NULL,
    event_id UUID, -- Reference to the source event
    payload JSONB NOT NULL,

    -- Delivery status
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed, retrying
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,

    -- Response info
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,

    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_attempted_at TIMESTAMP WITH TIME ZONE,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type, created_at DESC);

-- Partition by month for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempts and responses';

-- ============================================
-- Webhook Event Types Reference
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_event_types (
    id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    payload_schema JSONB,
    is_enabled BOOLEAN DEFAULT true
);

-- Seed event types
INSERT INTO webhook_event_types (id, category, name, description) VALUES
    ('incident.created', 'incidents', 'Incident Created', 'New ransomware incident discovered'),
    ('incident.updated', 'incidents', 'Incident Updated', 'Existing incident was updated'),
    ('actor.created', 'actors', 'Actor Created', 'New threat actor added'),
    ('actor.trend_changed', 'actors', 'Actor Trend Changed', 'Threat actor trend status changed (escalating/declining)'),
    ('actor.activity_spike', 'actors', 'Actor Activity Spike', 'Unusual increase in actor activity'),
    ('vulnerability.created', 'vulnerabilities', 'Vulnerability Created', 'New CVE added'),
    ('vulnerability.kev_added', 'vulnerabilities', 'KEV Added', 'CVE added to CISA KEV list'),
    ('vulnerability.exploited', 'vulnerabilities', 'Vulnerability Exploited', 'Evidence of active exploitation'),
    ('ioc.created', 'iocs', 'IOC Created', 'New indicator of compromise added'),
    ('ioc.matched', 'iocs', 'IOC Matched', 'IOC matched against your assets'),
    ('alert.triggered', 'alerts', 'Alert Triggered', 'Custom alert rule triggered'),
    ('alert.resolved', 'alerts', 'Alert Resolved', 'Alert was resolved'),
    ('report.generated', 'reports', 'Report Generated', 'Scheduled report was generated'),
    ('watchlist.match', 'watchlist', 'Watchlist Match', 'New activity on watched item'),
    ('asset.match', 'assets', 'Asset Match', 'Your asset matched threat intelligence')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Queue a webhook delivery
CREATE OR REPLACE FUNCTION queue_webhook_delivery(
    p_webhook_id UUID,
    p_event_type VARCHAR,
    p_event_id UUID,
    p_payload JSONB
)
RETURNS UUID AS $$
DECLARE
    v_delivery_id UUID;
    v_webhook webhooks;
BEGIN
    -- Get webhook config
    SELECT * INTO v_webhook FROM webhooks WHERE id = p_webhook_id;

    IF v_webhook IS NULL OR NOT v_webhook.is_enabled THEN
        RETURN NULL;
    END IF;

    -- Check if event type is subscribed
    IF NOT (p_event_type = ANY(v_webhook.events)) THEN
        RETURN NULL;
    END IF;

    -- Create delivery record
    INSERT INTO webhook_deliveries (
        webhook_id, event_type, event_id, payload, max_attempts
    ) VALUES (
        p_webhook_id, p_event_type, p_event_id, p_payload, v_webhook.max_retries
    )
    RETURNING id INTO v_delivery_id;

    RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- Mark delivery as successful
CREATE OR REPLACE FUNCTION complete_webhook_delivery(
    p_delivery_id UUID,
    p_response_status INTEGER,
    p_response_body TEXT,
    p_response_time_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE webhook_deliveries
    SET
        status = 'success',
        response_status = p_response_status,
        response_body = LEFT(p_response_body, 10000), -- Truncate large responses
        response_time_ms = p_response_time_ms,
        completed_at = NOW(),
        last_attempted_at = NOW(),
        attempts = attempts + 1
    WHERE id = p_delivery_id;

    -- Update webhook stats
    UPDATE webhooks
    SET
        total_sent = total_sent + 1,
        last_sent_at = NOW()
    WHERE id = (SELECT webhook_id FROM webhook_deliveries WHERE id = p_delivery_id);
END;
$$ LANGUAGE plpgsql;

-- Mark delivery as failed
CREATE OR REPLACE FUNCTION fail_webhook_delivery(
    p_delivery_id UUID,
    p_error_message TEXT,
    p_error_code VARCHAR,
    p_response_status INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_delivery webhook_deliveries;
    v_webhook webhooks;
    v_next_retry TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT * INTO v_delivery FROM webhook_deliveries WHERE id = p_delivery_id;
    SELECT * INTO v_webhook FROM webhooks WHERE id = v_delivery.webhook_id;

    -- Calculate next retry with exponential backoff
    IF v_delivery.attempts < v_delivery.max_attempts THEN
        v_next_retry := NOW() + (v_webhook.retry_delay_seconds * POWER(2, v_delivery.attempts)) * INTERVAL '1 second';

        UPDATE webhook_deliveries
        SET
            status = 'retrying',
            attempts = attempts + 1,
            error_message = p_error_message,
            error_code = p_error_code,
            response_status = p_response_status,
            last_attempted_at = NOW(),
            next_retry_at = v_next_retry
        WHERE id = p_delivery_id;
    ELSE
        -- Max retries exceeded
        UPDATE webhook_deliveries
        SET
            status = 'failed',
            attempts = attempts + 1,
            error_message = p_error_message,
            error_code = p_error_code,
            response_status = p_response_status,
            last_attempted_at = NOW(),
            completed_at = NOW()
        WHERE id = p_delivery_id;

        -- Update webhook error stats
        UPDATE webhooks
        SET
            total_failed = total_failed + 1,
            last_error = p_error_message,
            last_error_at = NOW()
        WHERE id = v_delivery.webhook_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get pending deliveries for processing
CREATE OR REPLACE FUNCTION get_pending_webhook_deliveries(p_limit INTEGER DEFAULT 100)
RETURNS SETOF webhook_deliveries AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM webhook_deliveries
    WHERE status IN ('pending', 'retrying')
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old deliveries
CREATE OR REPLACE FUNCTION cleanup_webhook_deliveries(p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM webhook_deliveries
    WHERE created_at < NOW() - (p_days || ' days')::INTERVAL
    AND status IN ('success', 'failed');

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views
-- ============================================

-- Webhook summary with recent stats
CREATE OR REPLACE VIEW v_webhook_summary AS
SELECT
    w.id,
    w.name,
    w.url,
    w.is_enabled,
    w.is_verified,
    w.events,
    w.total_sent,
    w.total_failed,
    w.last_sent_at,
    w.last_error,
    (
        SELECT COUNT(*) FROM webhook_deliveries wd
        WHERE wd.webhook_id = w.id
        AND wd.status = 'pending'
    ) as pending_count,
    (
        SELECT COUNT(*) FROM webhook_deliveries wd
        WHERE wd.webhook_id = w.id
        AND wd.status = 'retrying'
    ) as retrying_count
FROM webhooks w;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can manage their own webhooks
CREATE POLICY webhooks_user_access ON webhooks
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
        OR (team_id IS NOT NULL AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        ))
    );

-- Users can view deliveries for their webhooks
CREATE POLICY deliveries_user_access ON webhook_deliveries
    FOR SELECT USING (
        webhook_id IN (
            SELECT id FROM webhooks
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );
