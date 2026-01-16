-- Migration 028: Real-Time Alert System
-- Extends existing notification system with push notifications, webhooks, and faster alerting

-- ============================================
-- Push Notification Subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,  -- Public key for encryption
    auth TEXT NOT NULL,    -- Auth secret
    user_agent TEXT,
    device_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id) WHERE is_active = true;

COMMENT ON TABLE push_subscriptions IS 'Web Push API subscription endpoints for browser notifications';

-- ============================================
-- Webhook Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS alert_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    webhook_type VARCHAR(50) NOT NULL CHECK (webhook_type IN ('slack', 'discord', 'teams', 'generic')),
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    -- Event filters
    event_types TEXT[] DEFAULT ARRAY['ransomware', 'kev', 'cisa_alert'],
    severity_min VARCHAR(20) DEFAULT 'medium' CHECK (severity_min IN ('critical', 'high', 'medium', 'low', 'info')),
    -- Webhook-specific settings
    settings JSONB DEFAULT '{}',
    -- Stats
    last_sent_at TIMESTAMP WITH TIME ZONE,
    send_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_webhooks_user ON alert_webhooks(user_id) WHERE is_active = true;

COMMENT ON TABLE alert_webhooks IS 'User-configured webhook endpoints for Slack, Discord, Teams, etc.';

-- ============================================
-- Alert Delivery Log
-- ============================================
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    -- Delivery channels attempted
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'push', 'slack', 'discord', 'teams', 'webhook', 'in_app')),
    channel_target TEXT,  -- Email address, webhook ID, etc.
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    error_message TEXT,
    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    -- Response data
    response_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user ON alert_deliveries(user_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries(status) WHERE status = 'pending';

COMMENT ON TABLE alert_deliveries IS 'Tracks delivery status of each alert across channels';

-- ============================================
-- Extend user_preferences with real-time settings
-- ============================================
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_ransomware BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_kev BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_cisa_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_watchlist BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_vendor_cve BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_instant_alerts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_hours_end TIME DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

COMMENT ON COLUMN user_preferences.push_enabled IS 'Master toggle for push notifications';
COMMENT ON COLUMN user_preferences.email_instant_alerts IS 'Send email immediately for critical alerts vs digest only';
COMMENT ON COLUMN user_preferences.quiet_hours_enabled IS 'Suppress non-critical alerts during quiet hours';

-- ============================================
-- Alert Queue (for async processing)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    priority INTEGER DEFAULT 5,  -- 1 = highest, 10 = lowest
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(event_type, event_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_queue_pending ON alert_queue(priority, created_at) WHERE status = 'pending';

COMMENT ON TABLE alert_queue IS 'Queue for async alert processing to handle burst events';

-- ============================================
-- Function: Queue new event for alerting
-- ============================================
CREATE OR REPLACE FUNCTION queue_alert_event(
    p_event_type VARCHAR(50),
    p_event_id VARCHAR(255),
    p_event_data JSONB,
    p_priority INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO alert_queue (event_type, event_id, event_data, priority)
    VALUES (p_event_type, p_event_id, p_event_data, p_priority)
    ON CONFLICT (event_type, event_id) DO UPDATE
    SET event_data = EXCLUDED.event_data,
        status = 'pending',
        attempts = 0,
        processed_at = NULL
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger: Auto-queue ransomware incidents for alerting
-- ============================================
CREATE OR REPLACE FUNCTION trigger_queue_incident_alert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if this is a new incident (not an update)
    IF TG_OP = 'INSERT' THEN
        PERFORM queue_alert_event(
            'ransomware',
            NEW.id::TEXT,
            jsonb_build_object(
                'victim_name', NEW.victim_name,
                'threat_actor', NEW.threat_actor,
                'sector', NEW.sector,
                'country', NEW.country,
                'discovered_date', NEW.discovered_date,
                'source', NEW.source
            ),
            3  -- High priority
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_queue_incident_alert ON incidents;
CREATE TRIGGER auto_queue_incident_alert
    AFTER INSERT ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_queue_incident_alert();

-- ============================================
-- Trigger: Auto-queue KEV additions for alerting
-- ============================================
CREATE OR REPLACE FUNCTION trigger_queue_kev_alert()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue when a CVE is added to KEV (kev_date set)
    IF NEW.kev_date IS NOT NULL AND (OLD IS NULL OR OLD.kev_date IS NULL) THEN
        PERFORM queue_alert_event(
            'kev',
            NEW.cve_id,
            jsonb_build_object(
                'cve_id', NEW.cve_id,
                'title', NEW.title,
                'vendor', NEW.vendor,
                'product', NEW.product,
                'cvss_score', NEW.cvss_score,
                'kev_date', NEW.kev_date
            ),
            2  -- Critical priority
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_queue_kev_alert ON vulnerabilities;
CREATE TRIGGER auto_queue_kev_alert
    AFTER INSERT OR UPDATE ON vulnerabilities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_queue_kev_alert();

-- ============================================
-- Trigger: Auto-queue CISA alerts
-- Note: Commented out until alerts table exists
-- ============================================
-- CREATE OR REPLACE FUNCTION trigger_queue_cisa_alert()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF TG_OP = 'INSERT' THEN
--         PERFORM queue_alert_event(
--             'cisa_alert',
--             NEW.id::TEXT,
--             jsonb_build_object(
--                 'alert_id', NEW.alert_id,
--                 'title', NEW.title,
--                 'severity', NEW.severity,
--                 'published_date', NEW.published_date,
--                 'url', NEW.url
--             ),
--             4  -- Medium-high priority
--         );
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- DROP TRIGGER IF EXISTS auto_queue_cisa_alert ON alerts;
-- CREATE TRIGGER auto_queue_cisa_alert
--     AFTER INSERT ON alerts
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_queue_cisa_alert();

-- ============================================
-- Function: Get pending alerts for processing
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_alerts(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(50),
    event_id VARCHAR(255),
    event_data JSONB,
    priority INTEGER,
    attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE alert_queue q
    SET status = 'processing', attempts = attempts + 1
    WHERE q.id IN (
        SELECT aq.id FROM alert_queue aq
        WHERE aq.status = 'pending' AND aq.attempts < aq.max_attempts
        ORDER BY aq.priority, aq.created_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING q.id, q.event_type, q.event_id, q.event_data, q.priority, q.attempts;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Mark alert as completed
-- ============================================
CREATE OR REPLACE FUNCTION complete_alert(p_alert_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE alert_queue
    SET status = 'completed', processed_at = NOW()
    WHERE id = p_alert_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Mark alert as failed
-- ============================================
CREATE OR REPLACE FUNCTION fail_alert(p_alert_id UUID, p_error TEXT)
RETURNS void AS $$
BEGIN
    UPDATE alert_queue
    SET status = CASE
            WHEN attempts >= max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        last_error = p_error
    WHERE id = p_alert_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get users to notify for an event
-- ============================================
CREATE OR REPLACE FUNCTION get_users_for_alert(
    p_event_type VARCHAR(50),
    p_event_data JSONB
) RETURNS TABLE (
    user_id VARCHAR(255),
    email VARCHAR(255),
    push_enabled BOOLEAN,
    email_enabled BOOLEAN,
    in_quiet_hours BOOLEAN
) AS $$
DECLARE
    v_sector TEXT;
    v_actor TEXT;
    v_vendor TEXT;
BEGIN
    -- Extract relevant fields from event data
    v_sector := p_event_data->>'sector';
    v_actor := p_event_data->>'threat_actor';
    v_vendor := p_event_data->>'vendor';

    RETURN QUERY
    SELECT
        up.user_id,
        u.email,
        COALESCE(up.push_enabled, true) AND (
            CASE p_event_type
                WHEN 'ransomware' THEN COALESCE(up.push_ransomware, true)
                WHEN 'kev' THEN COALESCE(up.push_kev, true)
                WHEN 'cisa_alert' THEN COALESCE(up.push_cisa_alerts, true)
                ELSE true
            END
        ) AS push_enabled,
        COALESCE(up.email_alerts, true) AS email_enabled,
        COALESCE(up.quiet_hours_enabled, false) AND
            CURRENT_TIME BETWEEN COALESCE(up.quiet_hours_start, '22:00')
            AND COALESCE(up.quiet_hours_end, '07:00') AS in_quiet_hours
    FROM user_preferences up
    LEFT JOIN users u ON u.id = up.user_id
    WHERE
        -- Sector relevance check
        (v_sector IS NULL OR v_sector = ANY(up.sectors) OR up.sectors = '{}' OR up.sectors IS NULL)
        -- Severity threshold check
        AND COALESCE(up.email_alerts, true) = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Cleanup: Remove old processed alerts (30 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alert_queue
    WHERE status IN ('completed', 'failed')
    AND processed_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Stats view for monitoring
-- ============================================
CREATE OR REPLACE VIEW alert_queue_stats AS
SELECT
    status,
    event_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest,
    AVG(attempts) as avg_attempts
FROM alert_queue
GROUP BY status, event_type
ORDER BY status, event_type;

COMMENT ON VIEW alert_queue_stats IS 'Alert queue statistics for monitoring';
