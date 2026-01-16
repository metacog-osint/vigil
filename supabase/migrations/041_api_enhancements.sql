-- Migration 041: API Enhancements
-- Adds API versioning, rate limit tracking, and bulk endpoint support

-- API version tracking
CREATE TABLE IF NOT EXISTS api_versions (
  version TEXT PRIMARY KEY,
  released_at TIMESTAMPTZ DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ,
  sunset_at TIMESTAMPTZ,
  changelog TEXT,
  is_current BOOLEAN DEFAULT false,
  is_supported BOOLEAN DEFAULT true
);

-- Insert API versions
INSERT INTO api_versions (version, is_current, is_supported, changelog) VALUES
  ('v1', false, true, 'Initial API version'),
  ('v2', true, true, 'Added pagination cursors, rate limit headers, bulk endpoints')
ON CONFLICT (version) DO NOTHING;

-- Rate limit tracking per API key
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS rate_limit_per_day INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS requests_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS requests_this_minute INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minute_window_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS day_window_start DATE;

-- Rate limit log for analytics
CREATE TABLE IF NOT EXISTS api_rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  requests_count INTEGER DEFAULT 1,
  was_limited BOOLEAN DEFAULT false,
  window_type TEXT NOT NULL, -- 'minute' or 'day'
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk operation tracking
CREATE TABLE IF NOT EXISTS api_bulk_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'search', 'export', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'actors', 'incidents', 'iocs', 'vulnerabilities'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  request_params JSONB,
  result_url TEXT, -- For async exports
  expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagination cursors for stable pagination
CREATE TABLE IF NOT EXISTS api_pagination_cursors (
  cursor_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  query_hash TEXT NOT NULL, -- Hash of query params for cache invalidation
  last_id UUID,
  last_value TEXT, -- The value of the sort column
  sort_column TEXT DEFAULT 'created_at',
  sort_direction TEXT DEFAULT 'desc',
  page_size INTEGER DEFAULT 25,
  total_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_log_key
ON api_rate_limit_log(api_key_id, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_api_bulk_operations_user
ON api_bulk_operations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_bulk_operations_status
ON api_bulk_operations(status)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_api_pagination_cursors_expires
ON api_pagination_cursors(expires_at);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_api_rate_limit(
  p_api_key_id UUID,
  p_endpoint TEXT,
  p_method TEXT
) RETURNS TABLE(
  allowed BOOLEAN,
  remaining_minute INTEGER,
  remaining_day INTEGER,
  reset_minute TIMESTAMPTZ,
  reset_day TIMESTAMPTZ
) AS $$
DECLARE
  v_key RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_minute_start TIMESTAMPTZ;
  v_day_start DATE;
  v_allowed BOOLEAN := true;
BEGIN
  -- Get API key with rate limits
  SELECT * INTO v_key FROM api_keys WHERE id = p_api_key_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, v_now, v_now::DATE::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Calculate window starts
  v_minute_start := date_trunc('minute', v_now);
  v_day_start := v_now::DATE;

  -- Reset counters if windows have passed
  IF v_key.minute_window_start IS NULL OR v_key.minute_window_start < v_minute_start THEN
    UPDATE api_keys SET
      requests_this_minute = 0,
      minute_window_start = v_minute_start
    WHERE id = p_api_key_id;
    v_key.requests_this_minute := 0;
  END IF;

  IF v_key.day_window_start IS NULL OR v_key.day_window_start < v_day_start THEN
    UPDATE api_keys SET
      requests_today = 0,
      day_window_start = v_day_start
    WHERE id = p_api_key_id;
    v_key.requests_today := 0;
  END IF;

  -- Check limits
  IF v_key.requests_this_minute >= v_key.rate_limit_per_minute THEN
    v_allowed := false;

    -- Log rate limit hit
    INSERT INTO api_rate_limit_log (api_key_id, user_id, endpoint, method, was_limited, window_type, window_start)
    VALUES (p_api_key_id, v_key.user_id, p_endpoint, p_method, true, 'minute', v_minute_start);
  ELSIF v_key.requests_today >= v_key.rate_limit_per_day THEN
    v_allowed := false;

    INSERT INTO api_rate_limit_log (api_key_id, user_id, endpoint, method, was_limited, window_type, window_start)
    VALUES (p_api_key_id, v_key.user_id, p_endpoint, p_method, true, 'day', v_day_start::TIMESTAMPTZ);
  ELSE
    -- Increment counters
    UPDATE api_keys SET
      requests_this_minute = requests_this_minute + 1,
      requests_today = requests_today + 1,
      last_used_at = v_now
    WHERE id = p_api_key_id;
  END IF;

  RETURN QUERY SELECT
    v_allowed,
    GREATEST(0, v_key.rate_limit_per_minute - v_key.requests_this_minute - 1),
    GREATEST(0, v_key.rate_limit_per_day - v_key.requests_today - 1),
    v_minute_start + INTERVAL '1 minute',
    (v_day_start + 1)::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql;

-- Function to create pagination cursor
CREATE OR REPLACE FUNCTION create_pagination_cursor(
  p_user_id UUID,
  p_api_key_id UUID,
  p_entity_type TEXT,
  p_query_params JSONB,
  p_last_id UUID,
  p_last_value TEXT,
  p_sort_column TEXT,
  p_sort_direction TEXT,
  p_page_size INTEGER,
  p_total_count INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_cursor_id TEXT;
  v_query_hash TEXT;
BEGIN
  -- Generate cursor ID and query hash
  v_cursor_id := encode(gen_random_bytes(16), 'hex');
  v_query_hash := encode(sha256(p_query_params::TEXT::BYTEA), 'hex');

  -- Insert cursor
  INSERT INTO api_pagination_cursors (
    cursor_id, user_id, api_key_id, entity_type, query_hash,
    last_id, last_value, sort_column, sort_direction, page_size, total_count
  ) VALUES (
    v_cursor_id, p_user_id, p_api_key_id, p_entity_type, v_query_hash,
    p_last_id, p_last_value, p_sort_column, p_sort_direction, p_page_size, p_total_count
  );

  RETURN v_cursor_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old cursors and rate limit logs
CREATE OR REPLACE FUNCTION cleanup_api_data() RETURNS void AS $$
BEGIN
  -- Delete expired cursors
  DELETE FROM api_pagination_cursors WHERE expires_at < NOW();

  -- Delete old rate limit logs (keep 7 days)
  DELETE FROM api_rate_limit_log WHERE created_at < NOW() - INTERVAL '7 days';

  -- Delete old completed bulk operations (keep 30 days)
  DELETE FROM api_bulk_operations
  WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE api_versions IS 'Tracks API versions for versioning support';
COMMENT ON TABLE api_rate_limit_log IS 'Logs rate limit events for analytics';
COMMENT ON TABLE api_bulk_operations IS 'Tracks async bulk API operations';
COMMENT ON TABLE api_pagination_cursors IS 'Stores cursor state for stable pagination';
