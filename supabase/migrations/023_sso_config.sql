-- Migration 023: SSO/SAML Configuration
-- Phase 3.1: Enterprise single sign-on support

-- ============================================
-- SSO Providers Enum-like Table
-- ============================================
-- Supported providers: okta, azure_ad, google_workspace, onelogin, generic_saml

-- ============================================
-- SSO Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Provider info
    provider VARCHAR(50) NOT NULL, -- okta, azure_ad, google_workspace, onelogin, generic_saml
    provider_name VARCHAR(100), -- Display name (e.g., "Acme Corp Okta")

    -- Status
    is_enabled BOOLEAN DEFAULT false,
    is_enforced BOOLEAN DEFAULT false, -- Require SSO for all tenant users

    -- SAML Configuration
    saml_entity_id VARCHAR(500),
    saml_sso_url VARCHAR(500), -- IdP SSO URL
    saml_slo_url VARCHAR(500), -- IdP Single Logout URL
    saml_certificate TEXT, -- IdP X.509 certificate

    -- Our Service Provider info (generated)
    sp_entity_id VARCHAR(500),
    sp_acs_url VARCHAR(500), -- Assertion Consumer Service URL
    sp_slo_url VARCHAR(500), -- SP Single Logout URL
    sp_metadata_url VARCHAR(500),

    -- OIDC Configuration (for providers that support it)
    oidc_client_id VARCHAR(255),
    oidc_client_secret_encrypted TEXT, -- Encrypted client secret
    oidc_discovery_url VARCHAR(500),
    oidc_scopes VARCHAR(255) DEFAULT 'openid email profile',

    -- Domain restrictions
    allowed_domains TEXT[], -- Restrict to specific email domains
    auto_provision_users BOOLEAN DEFAULT true, -- Auto-create users on first SSO login

    -- Attribute mapping
    attribute_mapping JSONB DEFAULT '{
        "email": "email",
        "firstName": "firstName",
        "lastName": "lastName",
        "displayName": "displayName"
    }'::jsonb,

    -- Default role for new SSO users
    default_role VARCHAR(50) DEFAULT 'member',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Only one SSO config per tenant
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_sso_config_tenant ON sso_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_enabled ON sso_configurations(is_enabled, tenant_id);

COMMENT ON TABLE sso_configurations IS 'SSO/SAML configuration per tenant';

-- ============================================
-- SSO Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sso_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sso_config_id UUID NOT NULL REFERENCES sso_configurations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Session info
    idp_session_id VARCHAR(255), -- From IdP
    name_id VARCHAR(255), -- SAML NameID
    session_index VARCHAR(255), -- SAML SessionIndex

    -- Session attributes from IdP
    attributes JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    logged_out_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_user ON sso_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_config ON sso_sessions(sso_config_id);

COMMENT ON TABLE sso_sessions IS 'Active SSO sessions for Single Logout support';

-- ============================================
-- SSO Login Attempts (for auditing)
-- ============================================
CREATE TABLE IF NOT EXISTS sso_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sso_config_id UUID REFERENCES sso_configurations(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Attempt info
    email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Result
    status VARCHAR(20) NOT NULL, -- success, failed, error
    error_message TEXT,
    error_code VARCHAR(50),

    -- Timestamps
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_attempts_tenant ON sso_login_attempts(tenant_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_attempts_email ON sso_login_attempts(email, attempted_at DESC);

COMMENT ON TABLE sso_login_attempts IS 'SSO login attempt audit log';

-- ============================================
-- Helper Functions
-- ============================================

-- Get SSO config for a tenant
CREATE OR REPLACE FUNCTION get_sso_config(p_tenant_id UUID)
RETURNS sso_configurations AS $$
DECLARE
    v_config sso_configurations;
BEGIN
    SELECT * INTO v_config
    FROM sso_configurations
    WHERE tenant_id = p_tenant_id
    AND is_enabled = true;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Check if email domain is allowed for SSO
CREATE OR REPLACE FUNCTION is_sso_domain_allowed(p_tenant_id UUID, p_email VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_domain VARCHAR;
    v_allowed_domains TEXT[];
BEGIN
    -- Extract domain from email
    v_domain := split_part(p_email, '@', 2);

    -- Get allowed domains
    SELECT allowed_domains INTO v_allowed_domains
    FROM sso_configurations
    WHERE tenant_id = p_tenant_id
    AND is_enabled = true;

    -- If no restrictions, allow all
    IF v_allowed_domains IS NULL OR array_length(v_allowed_domains, 1) IS NULL THEN
        RETURN true;
    END IF;

    -- Check if domain is in allowed list
    RETURN v_domain = ANY(v_allowed_domains);
END;
$$ LANGUAGE plpgsql;

-- Log SSO attempt
CREATE OR REPLACE FUNCTION log_sso_attempt(
    p_sso_config_id UUID,
    p_tenant_id UUID,
    p_email VARCHAR,
    p_ip_address INET,
    p_user_agent TEXT,
    p_status VARCHAR,
    p_error_message TEXT DEFAULT NULL,
    p_error_code VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
BEGIN
    INSERT INTO sso_login_attempts (
        sso_config_id, tenant_id, email,
        ip_address, user_agent,
        status, error_message, error_code
    ) VALUES (
        p_sso_config_id, p_tenant_id, p_email,
        p_ip_address, p_user_agent,
        p_status, p_error_message, p_error_code
    )
    RETURNING id INTO v_attempt_id;

    -- Update last_used_at on config
    IF p_sso_config_id IS NOT NULL AND p_status = 'success' THEN
        UPDATE sso_configurations
        SET last_used_at = NOW()
        WHERE id = p_sso_config_id;
    END IF;

    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_login_attempts ENABLE ROW LEVEL SECURITY;

-- SSO config: tenant admins only
CREATE POLICY sso_config_access ON sso_configurations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- SSO sessions: users can see their own
CREATE POLICY sso_sessions_access ON sso_sessions
    FOR SELECT USING (
        user_id = current_setting('app.user_id', true)
    );

-- Login attempts: tenant admins can see all for their tenant
CREATE POLICY sso_attempts_access ON sso_login_attempts
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );
