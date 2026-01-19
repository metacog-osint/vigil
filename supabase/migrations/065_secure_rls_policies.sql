-- Migration: Secure RLS Policies
-- Created: January 18, 2026
-- Purpose: Replace permissive RLS policies with proper user-scoped access

-- =============================================================================
-- API Keys - Users can only access their own API keys
-- =============================================================================

-- Drop existing permissive policy if exists
DROP POLICY IF EXISTS "Allow all for api_keys" ON api_keys;
DROP POLICY IF EXISTS "api_keys_user_policy" ON api_keys;

-- Enable RLS if not already enabled
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "api_keys_select_own"
  ON api_keys FOR SELECT
  USING (user_id = auth.uid()::text);

-- Users can only insert their own API keys
CREATE POLICY "api_keys_insert_own"
  ON api_keys FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Users can only update their own API keys
CREATE POLICY "api_keys_update_own"
  ON api_keys FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Users can only delete their own API keys
CREATE POLICY "api_keys_delete_own"
  ON api_keys FOR DELETE
  USING (user_id = auth.uid()::text);

-- =============================================================================
-- Watchlists - Users can only access their own watchlists
-- =============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Allow all for watchlists" ON watchlists;

-- Users can only see their own watchlists
CREATE POLICY "watchlists_select_own"
  ON watchlists FOR SELECT
  USING (user_id = auth.uid()::text);

-- Users can only insert their own watchlists
CREATE POLICY "watchlists_insert_own"
  ON watchlists FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Users can only update their own watchlists
CREATE POLICY "watchlists_update_own"
  ON watchlists FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Users can only delete their own watchlists
CREATE POLICY "watchlists_delete_own"
  ON watchlists FOR DELETE
  USING (user_id = auth.uid()::text);

-- =============================================================================
-- Watchlist Items - Access through watchlist ownership
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for watchlist_items" ON watchlist_items;

-- Users can access items in their own watchlists
CREATE POLICY "watchlist_items_access_via_watchlist"
  ON watchlist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_items.watchlist_id
      AND w.user_id = auth.uid()::text
    )
  );

-- =============================================================================
-- User Preferences - Users can only access their own preferences
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for user_preferences" ON user_preferences;

CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user_preferences_delete_own"
  ON user_preferences FOR DELETE
  USING (user_id = auth.uid()::text);

-- =============================================================================
-- Saved Searches - Users can only access their own saved searches
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for saved_searches" ON saved_searches;

CREATE POLICY "saved_searches_select_own"
  ON saved_searches FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "saved_searches_insert_own"
  ON saved_searches FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "saved_searches_update_own"
  ON saved_searches FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "saved_searches_delete_own"
  ON saved_searches FOR DELETE
  USING (user_id = auth.uid()::text);

-- =============================================================================
-- Alert Webhooks - Users can only access their own webhooks
-- =============================================================================

-- Enable RLS on alert_webhooks if not already
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'alert_webhooks') THEN
    ALTER TABLE alert_webhooks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow all for alert_webhooks" ON alert_webhooks;

    CREATE POLICY "alert_webhooks_select_own"
      ON alert_webhooks FOR SELECT
      USING (user_id = auth.uid()::text);

    CREATE POLICY "alert_webhooks_insert_own"
      ON alert_webhooks FOR INSERT
      WITH CHECK (user_id = auth.uid()::text);

    CREATE POLICY "alert_webhooks_update_own"
      ON alert_webhooks FOR UPDATE
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);

    CREATE POLICY "alert_webhooks_delete_own"
      ON alert_webhooks FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- Push Subscriptions - Users can only access their own subscriptions
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'push_subscriptions') THEN
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow all for push_subscriptions" ON push_subscriptions;

    CREATE POLICY "push_subscriptions_select_own"
      ON push_subscriptions FOR SELECT
      USING (user_id = auth.uid()::text);

    CREATE POLICY "push_subscriptions_insert_own"
      ON push_subscriptions FOR INSERT
      WITH CHECK (user_id = auth.uid()::text);

    CREATE POLICY "push_subscriptions_update_own"
      ON push_subscriptions FOR UPDATE
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);

    CREATE POLICY "push_subscriptions_delete_own"
      ON push_subscriptions FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- Notifications - Users can only access their own notifications
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow all for notifications" ON notifications;

    CREATE POLICY "notifications_select_own"
      ON notifications FOR SELECT
      USING (user_id = auth.uid()::text);

    CREATE POLICY "notifications_update_own"
      ON notifications FOR UPDATE
      USING (user_id = auth.uid()::text);

    CREATE POLICY "notifications_delete_own"
      ON notifications FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- Alerts (user-specific alerts) - Users can only access their own alerts
-- =============================================================================

-- Note: The alerts table may store both system alerts and user alerts
-- Only apply user filtering if user_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'user_id'
  ) THEN
    DROP POLICY IF EXISTS "Allow all for alerts" ON alerts;

    CREATE POLICY "alerts_select_own"
      ON alerts FOR SELECT
      USING (user_id IS NULL OR user_id = auth.uid()::text);

    CREATE POLICY "alerts_update_own"
      ON alerts FOR UPDATE
      USING (user_id = auth.uid()::text);

    CREATE POLICY "alerts_delete_own"
      ON alerts FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- User Subscriptions - Users can only access their own subscriptions
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_subscriptions') THEN
    ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow all for user_subscriptions" ON user_subscriptions;

    CREATE POLICY "user_subscriptions_select_own"
      ON user_subscriptions FOR SELECT
      USING (user_id = auth.uid()::text);

    CREATE POLICY "user_subscriptions_update_own"
      ON user_subscriptions FOR UPDATE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- Tags - User-scoped tags
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for tags" ON tags;

-- If tags have user_id, scope to user; otherwise allow read for all
CREATE POLICY "tags_user_scoped"
  ON tags FOR ALL
  USING (
    CASE
      WHEN user_id IS NOT NULL THEN user_id = auth.uid()::text
      ELSE true  -- System tags visible to all
    END
  );

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON POLICY "api_keys_select_own" ON api_keys IS 'Users can only view their own API keys';
COMMENT ON POLICY "watchlists_select_own" ON watchlists IS 'Users can only view their own watchlists';
COMMENT ON POLICY "user_preferences_select_own" ON user_preferences IS 'Users can only view their own preferences';
