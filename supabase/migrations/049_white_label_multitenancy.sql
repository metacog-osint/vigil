-- Migration: White-Label / Multi-Tenancy
-- Created: 2026-01-16
-- Description: Custom branding, domains, and tenant isolation for enterprise customers

-- ============================================
-- TENANTS (Top-level organizations)
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-safe identifier
  -- Plan/tier
  plan TEXT DEFAULT 'standard' CHECK (plan IN ('standard', 'professional', 'enterprise', 'white_label')),
  plan_expires_at TIMESTAMPTZ,
  -- Contact
  owner_email TEXT NOT NULL,
  billing_email TEXT,
  support_email TEXT,
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  -- Limits
  max_users INTEGER DEFAULT 10,
  max_teams INTEGER DEFAULT 3,
  max_api_calls_daily INTEGER DEFAULT 10000,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TENANT BRANDING
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Company branding
  company_name TEXT,
  logo_url TEXT,
  logo_light_url TEXT, -- For light backgrounds
  favicon_url TEXT,
  -- Colors
  primary_color TEXT DEFAULT '#00ff88',
  secondary_color TEXT DEFAULT '#0a0a0f',
  accent_color TEXT DEFAULT '#00d4ff',
  background_color TEXT DEFAULT '#0a0a0f',
  text_color TEXT DEFAULT '#ffffff',
  -- Typography
  font_family TEXT DEFAULT 'Inter, system-ui, sans-serif',
  heading_font TEXT,
  -- Email branding
  email_logo_url TEXT,
  email_header_color TEXT,
  email_footer_text TEXT,
  -- Report branding
  report_logo_url TEXT,
  report_header_text TEXT,
  report_footer_text TEXT,
  -- Remove Vigil branding
  hide_powered_by BOOLEAN DEFAULT FALSE,
  -- CSS overrides (for advanced customization)
  custom_css TEXT,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOM DOMAINS
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Domain info
  domain TEXT UNIQUE NOT NULL,
  subdomain TEXT, -- e.g., 'intel' for intel.company.com
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  verified_at TIMESTAMPTZ,
  -- SSL
  ssl_enabled BOOLEAN DEFAULT FALSE,
  ssl_certificate_expires TIMESTAMPTZ,
  -- Status
  is_primary BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TENANT SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Feature toggles
  features_enabled JSONB DEFAULT '{}'::jsonb,
  -- Data retention
  data_retention_days INTEGER DEFAULT 365,
  audit_log_retention_days INTEGER DEFAULT 90,
  -- Security settings
  require_2fa BOOLEAN DEFAULT FALSE,
  allowed_ip_ranges TEXT[],
  session_timeout_minutes INTEGER DEFAULT 60,
  -- Notification settings
  notification_email_from TEXT,
  notification_email_name TEXT,
  -- API settings
  api_rate_limit_per_minute INTEGER DEFAULT 60,
  api_rate_limit_per_day INTEGER DEFAULT 10000,
  -- Compliance
  compliance_mode TEXT, -- 'hipaa', 'pci', 'fedramp', etc.
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TENANT MEMBERS
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),

  UNIQUE(tenant_id, user_id)
);

-- ============================================
-- TENANT AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  -- Action details
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  -- Change details
  old_values JSONB,
  new_values JSONB,
  -- Context
  ip_address INET,
  user_agent TEXT,
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get tenant by domain
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM tenant_domains
    WHERE domain = p_domain AND verified = true AND status = 'verified'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Get tenant branding
CREATE OR REPLACE FUNCTION get_tenant_branding(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_branding tenant_branding%ROWTYPE;
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  SELECT * INTO v_branding FROM tenant_branding WHERE tenant_id = p_tenant_id;

  IF v_tenant.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return branding with defaults
  RETURN jsonb_build_object(
    'tenantId', v_tenant.id,
    'tenantName', v_tenant.name,
    'plan', v_tenant.plan,
    'companyName', COALESCE(v_branding.company_name, v_tenant.name),
    'logoUrl', v_branding.logo_url,
    'logoLightUrl', v_branding.logo_light_url,
    'faviconUrl', v_branding.favicon_url,
    'colors', jsonb_build_object(
      'primary', COALESCE(v_branding.primary_color, '#00ff88'),
      'secondary', COALESCE(v_branding.secondary_color, '#0a0a0f'),
      'accent', COALESCE(v_branding.accent_color, '#00d4ff'),
      'background', COALESCE(v_branding.background_color, '#0a0a0f'),
      'text', COALESCE(v_branding.text_color, '#ffffff')
    ),
    'fonts', jsonb_build_object(
      'body', COALESCE(v_branding.font_family, 'Inter, system-ui, sans-serif'),
      'heading', v_branding.heading_font
    ),
    'email', jsonb_build_object(
      'logoUrl', v_branding.email_logo_url,
      'headerColor', v_branding.email_header_color,
      'footerText', v_branding.email_footer_text
    ),
    'report', jsonb_build_object(
      'logoUrl', v_branding.report_logo_url,
      'headerText', v_branding.report_header_text,
      'footerText', v_branding.report_footer_text
    ),
    'hidePoweredBy', COALESCE(v_branding.hide_powered_by, false),
    'customCss', v_branding.custom_css
  );
END;
$$ LANGUAGE plpgsql;

-- Check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limit(
  p_tenant_id UUID,
  p_limit_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_current_count INTEGER;
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_limit_type = 'users' THEN
    SELECT COUNT(*) INTO v_current_count FROM tenant_members WHERE tenant_id = p_tenant_id AND status = 'active';
    RETURN v_current_count < v_tenant.max_users;
  ELSIF p_limit_type = 'teams' THEN
    SELECT COUNT(*) INTO v_current_count FROM teams WHERE tenant_id = p_tenant_id;
    RETURN v_current_count < v_tenant.max_teams;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Verify domain ownership
CREATE OR REPLACE FUNCTION verify_domain(p_domain_id UUID, p_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_domain tenant_domains%ROWTYPE;
BEGIN
  SELECT * INTO v_domain FROM tenant_domains WHERE id = p_domain_id;

  IF v_domain.verification_token = p_token THEN
    UPDATE tenant_domains
    SET verified = true, status = 'verified', verified_at = NOW()
    WHERE id = p_domain_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Log tenant action
CREATE OR REPLACE FUNCTION log_tenant_action(
  p_tenant_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO tenant_audit_log (
    tenant_id, user_id, action, resource_type, resource_id,
    old_values, new_values, ip_address, user_agent
  )
  VALUES (
    p_tenant_id, p_user_id, p_action, p_resource_type, p_resource_id,
    p_old_values, p_new_values, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADD TENANT_ID TO TEAMS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN tenant_id UUID REFERENCES tenants(id);
    CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(domain);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_created ON tenant_audit_log(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant owners and admins can manage tenant
CREATE POLICY "Tenant admins can view tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Tenant owners can update tenant" ON tenants
  FOR UPDATE USING (
    id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Branding access
CREATE POLICY "Tenant members can view branding" ON tenant_branding
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenant admins can manage branding" ON tenant_branding
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Domain access
CREATE POLICY "Tenant admins can manage domains" ON tenant_domains
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Settings access
CREATE POLICY "Tenant admins can manage settings" ON tenant_settings
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Members access
CREATE POLICY "Tenant members can view other members" ON tenant_members
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenant admins can manage members" ON tenant_members
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Audit log access
CREATE POLICY "Tenant admins can view audit log" ON tenant_audit_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
