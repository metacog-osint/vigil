-- Migration: Terms Acceptance Tracking and Session Management
-- Created: 2026-01-19

-- ============================================================================
-- TERMS VERSION TRACKING
-- ============================================================================

-- Track terms/privacy policy versions
CREATE TABLE IF NOT EXISTS terms_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  terms_updated_at DATE NOT NULL,
  privacy_updated_at DATE NOT NULL,
  summary TEXT, -- Brief description of changes for user notification
  requires_reaccept BOOLEAN DEFAULT true, -- Whether existing users must re-accept
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track user acceptances of terms
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL REFERENCES terms_versions(version),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  UNIQUE(user_id, terms_version)
);

-- Index for quick lookup of user's latest acceptance
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user
  ON terms_acceptances(user_id, accepted_at DESC);

-- Insert initial version (the one we just created)
INSERT INTO terms_versions (version, terms_updated_at, privacy_updated_at, summary, requires_reaccept)
VALUES ('1.0.0', '2026-01-19', '2026-01-19', 'Initial Terms of Service and Privacy Policy', false)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SESSION MANAGEMENT
-- ============================================================================

-- Track user sessions for security auditing and forced logout
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL, -- Supabase session ID (hashed)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}',
  is_valid BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_valid ON user_sessions(user_id, is_valid) WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Terms versions are readable by all authenticated users
CREATE POLICY "Terms versions are publicly readable"
  ON terms_versions FOR SELECT
  TO authenticated
  USING (true);

-- Users can only see and create their own acceptances
CREATE POLICY "Users can view own acceptances"
  ON terms_acceptances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own acceptances"
  ON terms_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current terms version
CREATE OR REPLACE FUNCTION get_current_terms_version()
RETURNS TABLE(version TEXT, terms_updated_at DATE, privacy_updated_at DATE, summary TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT tv.version, tv.terms_updated_at, tv.privacy_updated_at, tv.summary
  FROM terms_versions tv
  ORDER BY tv.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has accepted current terms
CREATE OR REPLACE FUNCTION has_accepted_current_terms(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_version TEXT;
  has_accepted BOOLEAN;
BEGIN
  -- Get current version
  SELECT tv.version INTO current_version
  FROM terms_versions tv
  WHERE tv.requires_reaccept = true
  ORDER BY tv.created_at DESC
  LIMIT 1;

  -- If no version requires reaccept, return true
  IF current_version IS NULL THEN
    RETURN true;
  END IF;

  -- Check if user has accepted this version
  SELECT EXISTS(
    SELECT 1 FROM terms_acceptances ta
    WHERE ta.user_id = check_user_id
      AND ta.terms_version = current_version
  ) INTO has_accepted;

  RETURN has_accepted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record terms acceptance
CREATE OR REPLACE FUNCTION accept_terms(
  p_version TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO terms_acceptances (user_id, terms_version, ip_address, user_agent)
  VALUES (auth.uid(), p_version, p_ip_address, p_user_agent)
  ON CONFLICT (user_id, terms_version) DO UPDATE
    SET accepted_at = NOW(),
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invalidate all sessions for a user (for forced logout)
CREATE OR REPLACE FUNCTION invalidate_user_sessions(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_valid = false
  WHERE user_id = target_user_id AND is_valid = true;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
