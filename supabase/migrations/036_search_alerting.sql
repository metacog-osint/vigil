-- Search Alerting
-- Notify users when saved searches have new results

-- Add alerting fields to saved_searches
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN DEFAULT false;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS alert_frequency TEXT DEFAULT 'daily' CHECK (alert_frequency IN ('realtime', 'hourly', 'daily', 'weekly'));
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS alert_channels TEXT[] DEFAULT ARRAY['email'];
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_count INTEGER DEFAULT 0;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_hash TEXT;

-- Search alert history
CREATE TABLE IF NOT EXISTS search_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id UUID REFERENCES saved_searches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Alert details
  new_results_count INTEGER NOT NULL,
  previous_count INTEGER DEFAULT 0,
  sample_results JSONB DEFAULT '[]', -- First 5 new results

  -- Delivery
  channels_sent TEXT[] DEFAULT '{}',
  delivered_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_alert ON saved_searches(user_id, alert_enabled) WHERE alert_enabled = true;
CREATE INDEX IF NOT EXISTS idx_saved_searches_alert_freq ON saved_searches(alert_frequency, last_alert_at) WHERE alert_enabled = true;
CREATE INDEX IF NOT EXISTS idx_search_alert_history_search ON search_alert_history(saved_search_id);
CREATE INDEX IF NOT EXISTS idx_search_alert_history_user ON search_alert_history(user_id, created_at DESC);

-- Comments
COMMENT ON COLUMN saved_searches.alert_enabled IS 'Whether to send alerts when new results match';
COMMENT ON COLUMN saved_searches.alert_frequency IS 'How often to check for new results: realtime, hourly, daily, weekly';
COMMENT ON COLUMN saved_searches.last_result_hash IS 'Hash of result IDs to detect changes';
COMMENT ON TABLE search_alert_history IS 'History of alerts sent for saved searches';
