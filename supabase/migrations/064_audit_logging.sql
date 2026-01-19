-- Migration: Audit Logging System
-- Created: January 18, 2026
-- Purpose: Comprehensive audit trail for sensitive operations

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'blocked')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_status ON audit_log(status) WHERE status != 'success';

-- Create composite index for user activity queries
CREATE INDEX idx_audit_log_user_activity ON audit_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Admins can read all audit logs (via service role)
-- Service role bypasses RLS

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id TEXT,
  p_user_email TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_user_email,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Create view for recent activity summary
CREATE OR REPLACE VIEW audit_activity_summary AS
SELECT
  user_id,
  user_email,
  action,
  resource_type,
  COUNT(*) as event_count,
  MAX(created_at) as last_occurrence
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, user_email, action, resource_type
ORDER BY event_count DESC;

-- Create function to get user activity
CREATE OR REPLACE FUNCTION get_user_audit_log(
  p_user_id TEXT,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.resource_type,
    al.resource_id,
    al.details,
    al.status,
    al.created_at
  FROM audit_log al
  WHERE al.user_id = p_user_id
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create function to cleanup old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM audit_log
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT ON audit_activity_summary TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_audit_log TO authenticated;

-- Add comment
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for security-sensitive operations';
