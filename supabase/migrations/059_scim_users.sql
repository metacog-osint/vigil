-- Migration 059: SCIM User Provisioning
-- Supports enterprise SSO integration via SCIM 2.0

CREATE TABLE IF NOT EXISTS scim_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,  -- ID from IdP (Okta, Azure AD, etc.)
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  status TEXT DEFAULT 'active',  -- active, deactivated
  department TEXT,
  organization_id UUID,  -- Will reference organizations table when created
  groups TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scim_users_email ON scim_users(email);
CREATE INDEX IF NOT EXISTS idx_scim_users_external_id ON scim_users(external_id);
CREATE INDEX IF NOT EXISTS idx_scim_users_org ON scim_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_users_status ON scim_users(status);

-- SCIM tokens for organization authentication
CREATE TABLE IF NOT EXISTS scim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,  -- Will reference organizations table when created
  token_hash TEXT NOT NULL,  -- SHA-256 hash of token
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scim_tokens_org ON scim_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_hash ON scim_tokens(token_hash);

-- RLS
ALTER TABLE scim_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access for scim_users"
  ON scim_users FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role access for scim_tokens"
  ON scim_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE TRIGGER trigger_scim_users_updated_at
  BEFORE UPDATE ON scim_users
  FOR EACH ROW
  EXECUTE FUNCTION update_malware_families_updated_at();

COMMENT ON TABLE scim_users IS 'SCIM 2.0 provisioned users for enterprise SSO integration';
COMMENT ON TABLE scim_tokens IS 'SCIM bearer tokens for IdP authentication';
