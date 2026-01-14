-- ============================================
-- SUBSCRIPTION & API SYSTEM
-- Sprint 4: Monetization & API Access
-- ============================================

-- ============================================
-- USER SUBSCRIPTIONS TABLE
-- Tracks subscription status per user
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,  -- Firebase UID
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'professional', 'team', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,

  -- Billing info
  billing_email TEXT,
  billing_period TEXT DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'annual')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Trial info
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API KEYS TABLE
-- Stores API keys for Team+ users
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,  -- Firebase UID
  name TEXT NOT NULL,  -- User-provided key name (e.g., "Production", "Testing")
  key_hash TEXT NOT NULL,  -- SHA-256 hash of the actual key
  key_prefix TEXT NOT NULL,  -- First 8 chars for identification (e.g., "vgl_abc1...")

  -- Permissions
  scopes TEXT[] DEFAULT ARRAY['read'],  -- 'read', 'write', 'admin'

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,  -- Optional expiration

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- ============================================
-- API REQUEST LOG TABLE
-- Logs API requests for analytics and rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS api_request_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Request info
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,
  request_body_size INTEGER,
  response_body_size INTEGER,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTION EVENTS TABLE
-- Audit log of subscription changes
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'created', 'upgraded', 'downgraded', 'canceled', 'renewed', 'payment_failed'

  -- Change details
  previous_tier TEXT,
  new_tier TEXT,

  -- Stripe event info
  stripe_event_id TEXT,
  stripe_event_type TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- User subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON user_subscriptions(status);

-- API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;

-- API request log
CREATE INDEX IF NOT EXISTS idx_api_log_key ON api_request_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_log_user ON api_request_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_log_created ON api_request_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_log_endpoint ON api_request_log(endpoint);

-- Subscription events
CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_events_created ON subscription_events(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for subscriptions
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for API keys
CREATE TRIGGER trigger_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's current subscription tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT tier INTO v_tier
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
  LIMIT 1;

  RETURN COALESCE(v_tier, 'free');
END;
$$ LANGUAGE plpgsql;

-- Check if user has API access
CREATE OR REPLACE FUNCTION user_has_api_access(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
BEGIN
  v_tier := get_user_tier(p_user_id);
  RETURN v_tier IN ('team', 'enterprise');
END;
$$ LANGUAGE plpgsql;

-- Get API key usage stats for a user
CREATE OR REPLACE FUNCTION get_api_usage_stats(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_requests BIGINT,
  requests_today BIGINT,
  avg_response_time NUMERIC,
  top_endpoints JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::BIGINT as requests_today,
    AVG(response_time_ms)::NUMERIC as avg_response_time,
    (
      SELECT jsonb_agg(jsonb_build_object('endpoint', endpoint, 'count', cnt))
      FROM (
        SELECT endpoint, COUNT(*) as cnt
        FROM api_request_log
        WHERE user_id = p_user_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY endpoint
        ORDER BY cnt DESC
        LIMIT 5
      ) top
    ) as top_endpoints
  FROM api_request_log
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE USER_PREFERENCES TABLE
-- Add subscription-related fields
-- ============================================

-- Add subscription_tier column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences'
    AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_preferences
    ADD COLUMN subscription_tier TEXT DEFAULT 'free';
  END IF;
END $$;

-- ============================================
-- SEED DEFAULT FREE TIER FOR EXISTING USERS
-- ============================================

-- This will be handled by the application on user login
-- No seed data needed
