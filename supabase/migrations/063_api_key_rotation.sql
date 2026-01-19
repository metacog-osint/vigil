-- Migration: API Key Rotation Support
-- Enables key rotation with grace period for zero-downtime key updates

-- Add rotation-related columns to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotation_expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES api_keys(id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS replaces UUID REFERENCES api_keys(id);

-- Add comment for documentation
COMMENT ON COLUMN api_keys.rotated_at IS 'When this key was rotated (replaced by a new key)';
COMMENT ON COLUMN api_keys.rotation_expires_at IS 'When the old key stops working after rotation';
COMMENT ON COLUMN api_keys.replaced_by IS 'The new key that replaced this one';
COMMENT ON COLUMN api_keys.replaces IS 'The old key that this key replaced';

-- Create index for rotation lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_rotation ON api_keys(replaced_by) WHERE replaced_by IS NOT NULL;

-- Function to rotate an API key
-- Returns the new key's ID (caller must generate the actual key value)
CREATE OR REPLACE FUNCTION rotate_api_key(
  p_key_id UUID,
  p_user_id UUID,
  p_grace_period_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
  v_new_key_id UUID;
  v_old_key RECORD;
BEGIN
  -- Get the old key
  SELECT * INTO v_old_key
  FROM api_keys
  WHERE id = p_key_id AND user_id = p_user_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API key not found or inactive';
  END IF;

  -- Check if already rotated
  IF v_old_key.replaced_by IS NOT NULL THEN
    RAISE EXCEPTION 'API key has already been rotated';
  END IF;

  -- Generate new key ID (actual key will be created by the application)
  v_new_key_id := gen_random_uuid();

  -- Mark old key as rotated
  UPDATE api_keys
  SET
    rotated_at = NOW(),
    rotation_expires_at = NOW() + (p_grace_period_hours || ' hours')::INTERVAL,
    replaced_by = v_new_key_id
  WHERE id = p_key_id;

  RETURN v_new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a key is valid (including rotated keys within grace period)
CREATE OR REPLACE FUNCTION is_api_key_valid(p_key_hash TEXT)
RETURNS TABLE(
  key_id UUID,
  user_id UUID,
  scopes TEXT[],
  is_rotated BOOLEAN,
  rate_limit_per_minute INTEGER,
  rate_limit_per_day INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.user_id,
    ak.scopes,
    (ak.rotated_at IS NOT NULL) AS is_rotated,
    ak.rate_limit_per_minute,
    ak.rate_limit_per_day
  FROM api_keys ak
  WHERE
    ak.key_hash = p_key_hash
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    AND (
      -- Not rotated
      ak.rotated_at IS NULL
      -- Or within grace period
      OR ak.rotation_expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired rotated keys
CREATE OR REPLACE FUNCTION cleanup_expired_rotated_keys()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Deactivate keys past their rotation grace period
  WITH deactivated AS (
    UPDATE api_keys
    SET is_active = false
    WHERE
      rotated_at IS NOT NULL
      AND rotation_expires_at < NOW()
      AND is_active = true
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deactivated;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for key rotation status
CREATE OR REPLACE VIEW api_key_rotation_status AS
SELECT
  id,
  user_id,
  name,
  key_prefix,
  is_active,
  created_at,
  last_used_at,
  rotated_at,
  rotation_expires_at,
  replaced_by,
  replaces,
  CASE
    WHEN rotated_at IS NULL THEN 'active'
    WHEN rotation_expires_at > NOW() THEN 'grace_period'
    ELSE 'expired'
  END AS rotation_status,
  CASE
    WHEN rotation_expires_at IS NOT NULL AND rotation_expires_at > NOW() THEN
      EXTRACT(EPOCH FROM (rotation_expires_at - NOW()))::INTEGER
    ELSE NULL
  END AS grace_period_seconds_remaining
FROM api_keys;
