-- Migration 015: Usage Analytics
-- Phase 1C: Track user engagement and feature usage

-- ============================================
-- Analytics Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    session_id VARCHAR(255),

    -- Event details
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',

    -- Context
    page_path VARCHAR(255),
    referrer VARCHAR(255),
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partition by month for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

COMMENT ON TABLE analytics_events IS 'User engagement and feature usage tracking';

-- ============================================
-- Event Types
-- ============================================
-- page_view: User viewed a page
-- search: User performed a search
-- export: User exported data
-- watchlist: Watchlist interactions
-- alert: Alert rule interactions
-- report: Report interactions
-- api: API key/usage events
-- feature: Feature usage tracking

-- ============================================
-- Daily Aggregates (for faster queries)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',

    -- Counts
    page_views INTEGER DEFAULT 0,
    searches INTEGER DEFAULT 0,
    exports INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,

    -- Engagement
    session_count INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,

    -- Feature usage (JSONB for flexibility)
    features_used JSONB DEFAULT '{}',
    -- Example: { "ioc_search": 5, "bulk_search": 2, "watchlist_add": 3 }

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_user ON analytics_daily(user_id);

COMMENT ON TABLE analytics_daily IS 'Pre-aggregated daily analytics for dashboard queries';

-- ============================================
-- User Engagement Score
-- ============================================
CREATE TABLE IF NOT EXISTS user_engagement (
    user_id VARCHAR(255) PRIMARY KEY,

    -- Activity metrics
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,

    -- Engagement score (0-100)
    engagement_score INTEGER DEFAULT 0,

    -- Feature adoption
    features_discovered TEXT[] DEFAULT '{}',
    -- Array of feature names the user has used

    -- Risk indicators
    days_since_last_activity INTEGER DEFAULT 0,
    is_at_risk BOOLEAN DEFAULT false,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_engagement IS 'User engagement tracking for churn prevention';

-- ============================================
-- Function to update daily aggregates
-- ============================================
CREATE OR REPLACE FUNCTION update_analytics_daily()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO analytics_daily (date, user_id, page_views, searches, exports, api_calls, features_used)
    VALUES (
        DATE(NEW.created_at),
        NEW.user_id,
        CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'search' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'export' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'api' THEN 1 ELSE 0 END,
        jsonb_build_object(NEW.event_name, 1)
    )
    ON CONFLICT (date, user_id) DO UPDATE SET
        page_views = analytics_daily.page_views + CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        searches = analytics_daily.searches + CASE WHEN NEW.event_type = 'search' THEN 1 ELSE 0 END,
        exports = analytics_daily.exports + CASE WHEN NEW.event_type = 'export' THEN 1 ELSE 0 END,
        api_calls = analytics_daily.api_calls + CASE WHEN NEW.event_type = 'api' THEN 1 ELSE 0 END,
        features_used = analytics_daily.features_used || jsonb_build_object(
            NEW.event_name,
            COALESCE((analytics_daily.features_used->>NEW.event_name)::integer, 0) + 1
        ),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analytics_daily_trigger ON analytics_events;
CREATE TRIGGER analytics_daily_trigger
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_daily();

-- ============================================
-- Function to update user engagement
-- ============================================
CREATE OR REPLACE FUNCTION update_user_engagement()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_engagement (user_id, last_seen_at, total_sessions, total_page_views, features_discovered)
    VALUES (
        NEW.user_id,
        NOW(),
        CASE WHEN NEW.event_type = 'page_view' AND NEW.event_name = 'session_start' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        ARRAY[NEW.event_name]
    )
    ON CONFLICT (user_id) DO UPDATE SET
        last_seen_at = NOW(),
        total_sessions = user_engagement.total_sessions +
            CASE WHEN NEW.event_type = 'page_view' AND NEW.event_name = 'session_start' THEN 1 ELSE 0 END,
        total_page_views = user_engagement.total_page_views +
            CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        features_discovered = CASE
            WHEN NOT (NEW.event_name = ANY(user_engagement.features_discovered))
            THEN array_append(user_engagement.features_discovered, NEW.event_name)
            ELSE user_engagement.features_discovered
        END,
        days_since_last_activity = 0,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_engagement_trigger ON analytics_events;
CREATE TRIGGER user_engagement_trigger
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_engagement();

-- ============================================
-- View for engagement dashboard
-- ============================================
CREATE OR REPLACE VIEW v_engagement_summary AS
SELECT
    COUNT(DISTINCT user_id) as total_users,
    COUNT(DISTINCT CASE WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN user_id END) as active_7d,
    COUNT(DISTINCT CASE WHEN last_seen_at > NOW() - INTERVAL '30 days' THEN user_id END) as active_30d,
    AVG(engagement_score) as avg_engagement,
    COUNT(CASE WHEN is_at_risk THEN 1 END) as at_risk_users
FROM user_engagement;

-- ============================================
-- View for feature adoption
-- ============================================
CREATE OR REPLACE VIEW v_feature_adoption AS
SELECT
    feature,
    COUNT(DISTINCT user_id) as users,
    SUM((features_used->>feature)::integer) as total_usage
FROM analytics_daily,
     jsonb_object_keys(features_used) as feature
WHERE date > NOW() - INTERVAL '30 days'
GROUP BY feature
ORDER BY users DESC;

-- ============================================
-- Auto-cleanup old events (keep 90 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
