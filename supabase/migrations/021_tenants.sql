-- Migration 021: Multi-Tenancy / White-Label Support
-- Phase 3.3: Allow MSSPs to rebrand Vigil for their customers

-- ============================================
-- Tenants Table
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    slug VARCHAR(50) UNIQUE NOT NULL, -- URL-safe identifier (e.g., 'acme-security')
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Contact
    admin_email VARCHAR(255) NOT NULL,
    support_email VARCHAR(255),
    billing_email VARCHAR(255),

    -- Custom domain
    custom_domain VARCHAR(255) UNIQUE, -- e.g., 'intel.acmesecurity.com'
    domain_verified BOOLEAN DEFAULT false,
    domain_verification_token VARCHAR(100),

    -- Subscription
    subscription_tier VARCHAR(50) DEFAULT 'team', -- team, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, past_due, canceled
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    max_users INTEGER DEFAULT 10,

    -- Feature flags
    features JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Parent tenant for resellers
    parent_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

COMMENT ON TABLE tenants IS 'Multi-tenant organizations for white-label support';

-- ============================================
-- Tenant Branding Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Logo and visuals
    logo_url TEXT,
    logo_dark_url TEXT, -- Alternative logo for dark backgrounds
    favicon_url TEXT,

    -- Colors (CSS custom properties)
    primary_color VARCHAR(20) DEFAULT '#00ff9d', -- Main accent color
    primary_dark VARCHAR(20) DEFAULT '#00cc7d',
    background_color VARCHAR(20) DEFAULT '#0a0f1a',
    surface_color VARCHAR(20) DEFAULT '#111827',
    text_color VARCHAR(20) DEFAULT '#ffffff',
    text_muted VARCHAR(20) DEFAULT '#9ca3af',

    -- Typography
    font_family VARCHAR(100) DEFAULT 'Inter, system-ui, sans-serif',
    font_heading VARCHAR(100),

    -- Additional branding
    company_name VARCHAR(255), -- Overrides 'Vigil' in UI
    tagline VARCHAR(255),
    copyright_text VARCHAR(255),

    -- Links
    support_url TEXT,
    documentation_url TEXT,
    terms_url TEXT,
    privacy_url TEXT,

    -- Email templates
    email_logo_url TEXT,
    email_footer_text TEXT,

    -- Hide Vigil branding
    hide_powered_by BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id)
);

COMMENT ON TABLE tenant_branding IS 'Custom branding configuration per tenant';

-- ============================================
-- Tenant Members (Link users to tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Firebase UID

    -- Role within tenant
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer

    -- Permissions (JSON for flexibility)
    permissions JSONB DEFAULT '[]'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,
    invited_by VARCHAR(255),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

COMMENT ON TABLE tenant_members IS 'User membership in tenants';

-- ============================================
-- Tenant Invitations
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',

    invited_by VARCHAR(255) NOT NULL,
    token VARCHAR(100) UNIQUE NOT NULL,

    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);

COMMENT ON TABLE tenant_invitations IS 'Pending invitations to join tenants';

-- ============================================
-- Views
-- ============================================

-- Tenant summary view
CREATE OR REPLACE VIEW v_tenant_summary AS
SELECT
    t.id,
    t.slug,
    t.name,
    t.custom_domain,
    t.subscription_tier,
    t.subscription_status,
    t.is_active,
    t.max_users,
    COUNT(DISTINCT tm.user_id) as current_users,
    t.created_at
FROM tenants t
LEFT JOIN tenant_members tm ON t.id = tm.tenant_id AND tm.is_active = true
GROUP BY t.id;

-- ============================================
-- Helper Functions
-- ============================================

-- Get tenant by domain or slug
CREATE OR REPLACE FUNCTION get_tenant(p_identifier VARCHAR)
RETURNS TABLE (
    id UUID,
    slug VARCHAR,
    name VARCHAR,
    custom_domain VARCHAR,
    subscription_tier VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.slug,
        t.name,
        t.custom_domain,
        t.subscription_tier,
        t.is_active
    FROM tenants t
    WHERE t.slug = p_identifier
       OR t.custom_domain = p_identifier
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get user's tenants
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id VARCHAR)
RETURNS TABLE (
    tenant_id UUID,
    tenant_slug VARCHAR,
    tenant_name VARCHAR,
    user_role VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.slug,
        t.name,
        tm.role,
        t.is_active
    FROM tenant_members tm
    JOIN tenants t ON tm.tenant_id = t.id
    WHERE tm.user_id = p_user_id
      AND tm.is_active = true
      AND t.is_active = true
    ORDER BY t.name;
END;
$$ LANGUAGE plpgsql;

-- Get branding for tenant
CREATE OR REPLACE FUNCTION get_tenant_branding(p_tenant_id UUID)
RETURNS tenant_branding AS $$
DECLARE
    v_branding tenant_branding;
BEGIN
    SELECT * INTO v_branding
    FROM tenant_branding
    WHERE tenant_id = p_tenant_id;

    RETURN v_branding;
END;
$$ LANGUAGE plpgsql;

-- Check if user can access tenant
CREATE OR REPLACE FUNCTION can_access_tenant(p_user_id VARCHAR, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_members
        WHERE user_id = p_user_id
          AND tenant_id = p_tenant_id
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Check if user is tenant admin
CREATE OR REPLACE FUNCTION is_tenant_admin(p_user_id VARCHAR, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_members
        WHERE user_id = p_user_id
          AND tenant_id = p_tenant_id
          AND role IN ('owner', 'admin')
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Tenants: Members can view their tenant, admins can modify
CREATE POLICY tenants_select ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND is_active = true
        )
    );

CREATE POLICY tenants_update ON tenants
    FOR UPDATE USING (
        id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Branding: Same as tenants
CREATE POLICY branding_select ON tenant_branding
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND is_active = true
        )
    );

CREATE POLICY branding_all ON tenant_branding
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Members: Admins can manage, members can view
CREATE POLICY members_select ON tenant_members
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members tm2
            WHERE tm2.user_id = current_setting('app.user_id', true)
            AND tm2.is_active = true
        )
    );

CREATE POLICY members_modify ON tenant_members
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members tm2
            WHERE tm2.user_id = current_setting('app.user_id', true)
            AND tm2.role IN ('owner', 'admin')
            AND tm2.is_active = true
        )
    );

-- Invitations: Admins only
CREATE POLICY invitations_all ON tenant_invitations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members
            WHERE user_id = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Allow anyone to check invitation by token (for accepting)
CREATE POLICY invitations_select_token ON tenant_invitations
    FOR SELECT USING (true);
