-- Migration 027: Chat Integrations (Slack/Teams)
-- Phase 4.4: Query Vigil directly from chat

-- ============================================
-- Chat Integration Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS chat_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    -- Integration type
    platform VARCHAR(20) NOT NULL, -- slack, teams, discord

    -- OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,

    -- Workspace/Team info
    workspace_id VARCHAR(255), -- Slack workspace ID or Teams tenant ID
    workspace_name VARCHAR(255),

    -- Bot info
    bot_user_id VARCHAR(255),
    bot_access_token TEXT,

    -- Webhook URL (for incoming)
    incoming_webhook_url TEXT,

    -- Default channel for alerts
    default_channel_id VARCHAR(255),
    default_channel_name VARCHAR(255),

    -- Permissions/scopes
    scopes TEXT[],

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, platform, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_integrations_user ON chat_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_integrations_platform ON chat_integrations(platform, is_active);

COMMENT ON TABLE chat_integrations IS 'OAuth connections to Slack/Teams workspaces';

-- ============================================
-- Chat Commands (slash command registry)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Command definition
    command VARCHAR(50) NOT NULL, -- search, actor, alert, help
    description TEXT,
    usage_example TEXT,

    -- Feature flags
    is_enabled BOOLEAN DEFAULT true,
    required_tier VARCHAR(20) DEFAULT 'pro',

    -- Response settings
    response_type VARCHAR(20) DEFAULT 'ephemeral', -- ephemeral, in_channel
    allows_options BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default commands
INSERT INTO chat_commands (command, description, usage_example, response_type) VALUES
    ('search', 'Search for IOCs, actors, or vulnerabilities', '/vigil search 192.168.1.1', 'ephemeral'),
    ('actor', 'Get threat actor summary and recent activity', '/vigil actor LockBit', 'ephemeral'),
    ('alerts', 'List recent alerts for your watchlists', '/vigil alerts', 'ephemeral'),
    ('stats', 'Get current threat statistics', '/vigil stats', 'in_channel'),
    ('subscribe', 'Subscribe channel to alert notifications', '/vigil subscribe #channel', 'ephemeral'),
    ('help', 'Show available commands', '/vigil help', 'ephemeral')
ON CONFLICT DO NOTHING;

-- ============================================
-- Chat Command Logs
-- ============================================
CREATE TABLE IF NOT EXISTS chat_command_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES chat_integrations(id) ON DELETE CASCADE,

    -- Command details
    command VARCHAR(50) NOT NULL,
    arguments TEXT,

    -- Requestor
    platform_user_id VARCHAR(255),
    platform_user_name VARCHAR(255),
    channel_id VARCHAR(255),
    channel_name VARCHAR(255),

    -- Response
    response_status VARCHAR(20), -- success, error, rate_limited
    response_time_ms INTEGER,
    error_message TEXT,

    -- Results
    results_count INTEGER,
    result_type VARCHAR(50),

    -- Timestamps
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_command_logs_integration ON chat_command_logs(integration_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_command_logs_command ON chat_command_logs(command, executed_at DESC);

COMMENT ON TABLE chat_command_logs IS 'Log of all chat commands executed';

-- ============================================
-- Channel Subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS chat_channel_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES chat_integrations(id) ON DELETE CASCADE,

    -- Channel info
    channel_id VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255),

    -- Subscription settings
    subscription_type VARCHAR(50) NOT NULL, -- alerts, daily_digest, actor_updates

    -- Filters
    alert_severities TEXT[] DEFAULT ARRAY['critical', 'high'],
    alert_types TEXT[] DEFAULT ARRAY['incident', 'vulnerability', 'ioc'],
    sectors TEXT[],
    actors TEXT[],

    -- Delivery settings
    is_active BOOLEAN DEFAULT true,
    last_notification_at TIMESTAMP WITH TIME ZONE,
    notification_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(integration_id, channel_id, subscription_type)
);

CREATE INDEX IF NOT EXISTS idx_channel_subs_integration ON chat_channel_subscriptions(integration_id, is_active);

COMMENT ON TABLE chat_channel_subscriptions IS 'Channel subscriptions to different notification types';

-- ============================================
-- Chat Messages Queue
-- ============================================
CREATE TABLE IF NOT EXISTS chat_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES chat_integrations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES chat_channel_subscriptions(id) ON DELETE SET NULL,

    -- Message details
    channel_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- alert, digest, notification

    -- Payload
    payload JSONB NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, cancelled
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Error tracking
    last_error TEXT,

    -- Timestamps
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_queue_pending ON chat_message_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chat_queue_integration ON chat_message_queue(integration_id, created_at DESC);

COMMENT ON TABLE chat_message_queue IS 'Queue for outgoing chat messages';

-- ============================================
-- Views
-- ============================================

-- Active integrations with stats
CREATE OR REPLACE VIEW v_chat_integration_stats AS
SELECT
    ci.*,
    (
        SELECT COUNT(*) FROM chat_command_logs ccl
        WHERE ccl.integration_id = ci.id
        AND ccl.executed_at > NOW() - INTERVAL '7 days'
    ) as commands_7d,
    (
        SELECT COUNT(*) FROM chat_channel_subscriptions ccs
        WHERE ccs.integration_id = ci.id
        AND ccs.is_active = true
    ) as active_subscriptions,
    (
        SELECT MAX(executed_at) FROM chat_command_logs ccl
        WHERE ccl.integration_id = ci.id
    ) as last_command_at
FROM chat_integrations ci
WHERE ci.is_active = true;

-- ============================================
-- Functions
-- ============================================

-- Process pending messages
CREATE OR REPLACE FUNCTION process_chat_message(p_message_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_message RECORD;
BEGIN
    SELECT * INTO v_message FROM chat_message_queue WHERE id = p_message_id;

    IF v_message IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update status to sent (actual sending happens in application layer)
    UPDATE chat_message_queue
    SET
        status = 'sent',
        sent_at = NOW()
    WHERE id = p_message_id;

    -- Update subscription stats
    IF v_message.subscription_id IS NOT NULL THEN
        UPDATE chat_channel_subscriptions
        SET
            last_notification_at = NOW(),
            notification_count = notification_count + 1
        WHERE id = v_message.subscription_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Log command execution
CREATE OR REPLACE FUNCTION log_chat_command(
    p_integration_id UUID,
    p_command VARCHAR(50),
    p_arguments TEXT,
    p_user_id VARCHAR(255),
    p_user_name VARCHAR(255),
    p_channel_id VARCHAR(255),
    p_channel_name VARCHAR(255),
    p_status VARCHAR(20),
    p_response_time_ms INTEGER,
    p_results_count INTEGER DEFAULT NULL,
    p_result_type VARCHAR(50) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO chat_command_logs (
        integration_id,
        command,
        arguments,
        platform_user_id,
        platform_user_name,
        channel_id,
        channel_name,
        response_status,
        response_time_ms,
        results_count,
        result_type,
        error_message
    ) VALUES (
        p_integration_id,
        p_command,
        p_arguments,
        p_user_id,
        p_user_name,
        p_channel_id,
        p_channel_name,
        p_status,
        p_response_time_ms,
        p_results_count,
        p_result_type,
        p_error_message
    )
    RETURNING id INTO v_log_id;

    -- Update last used timestamp on integration
    UPDATE chat_integrations
    SET last_used_at = NOW()
    WHERE id = p_integration_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE chat_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_command_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_queue ENABLE ROW LEVEL SECURITY;

-- Integrations: Owner or team member access
CREATE POLICY chat_integrations_access ON chat_integrations
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
        OR (team_id IS NOT NULL AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
        ))
    );

-- Command logs: Access through integration
CREATE POLICY chat_command_logs_access ON chat_command_logs
    FOR ALL USING (
        integration_id IN (
            SELECT id FROM chat_integrations
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );

-- Subscriptions: Access through integration
CREATE POLICY chat_subscriptions_access ON chat_channel_subscriptions
    FOR ALL USING (
        integration_id IN (
            SELECT id FROM chat_integrations
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );

-- Message queue: Access through integration
CREATE POLICY chat_queue_access ON chat_message_queue
    FOR ALL USING (
        integration_id IN (
            SELECT id FROM chat_integrations
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );
