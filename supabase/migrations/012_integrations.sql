-- ============================================
-- INTEGRATIONS SYSTEM
-- Sprint 5: External Integrations
-- ============================================

-- ============================================
-- USER INTEGRATIONS TABLE
-- Stores integration configurations per user
-- ============================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,  -- Firebase UID

  -- Integration type
  integration_type TEXT NOT NULL CHECK (integration_type IN (
    'slack', 'teams', 'jira', 'servicenow', 'pagerduty', 'webhook',
    'splunk', 'elastic', 'sentinel'
  )),

  -- Connection status
  is_enabled BOOLEAN DEFAULT TRUE,
  is_connected BOOLEAN DEFAULT FALSE,

  -- Configuration (encrypted in production)
  config JSONB NOT NULL DEFAULT '{}',
  -- For Slack: { webhook_url, channel_id, bot_token }
  -- For Teams: { webhook_url, tenant_id }
  -- For Jira: { site_url, project_key, api_token, email }
  -- For webhook: { url, secret, events }

  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Notification preferences for this integration
  notify_on JSONB DEFAULT '{
    "critical_incidents": true,
    "high_incidents": true,
    "watchlist_updates": true,
    "new_kevs": true,
    "actor_escalations": true
  }',

  -- Metadata
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, integration_type)
);

-- ============================================
-- INTEGRATION LOGS TABLE
-- Audit log of integration activities
-- ============================================
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES user_integrations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL,  -- 'notification_sent', 'ticket_created', 'sync', 'error'
  event_data JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OUTBOUND WEBHOOKS TABLE
-- Custom webhooks for programmatic integrations
-- ============================================
CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Webhook configuration
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,  -- For HMAC signature verification

  -- Event subscriptions
  events TEXT[] DEFAULT ARRAY['incident.new', 'kev.new', 'actor.escalating'],

  -- Filtering
  filters JSONB DEFAULT '{}',
  -- { severity: ['critical', 'high'], sectors: ['healthcare'] }

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON user_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON user_integrations(is_enabled) WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_user ON integration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON outbound_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON outbound_webhooks(is_enabled) WHERE is_enabled = TRUE;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trigger_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_webhooks_updated_at
  BEFORE UPDATE ON outbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all enabled integrations for a user
CREATE OR REPLACE FUNCTION get_user_integrations(p_user_id TEXT)
RETURNS SETOF user_integrations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM user_integrations
  WHERE user_id = p_user_id AND is_enabled = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get integrations that should receive a specific notification type
CREATE OR REPLACE FUNCTION get_integrations_for_notification(
  p_user_id TEXT,
  p_notification_type TEXT
)
RETURNS SETOF user_integrations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM user_integrations
  WHERE user_id = p_user_id
    AND is_enabled = TRUE
    AND is_connected = TRUE
    AND (notify_on->>p_notification_type)::boolean = TRUE;
END;
$$ LANGUAGE plpgsql;
