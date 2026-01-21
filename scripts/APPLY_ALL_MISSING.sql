-- ==========================================
-- APPLY ALL MISSING TABLES
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql/new
-- ==========================================

-- ============================================
-- 1. ALERTS TABLE (from migration 005)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'cisa',
  alert_type TEXT,
  category TEXT,
  severity TEXT DEFAULT 'high',
  published_date TIMESTAMPTZ,
  url TEXT,
  cve_ids TEXT[],
  actor_ids UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
CREATE INDEX IF NOT EXISTS idx_alerts_published ON alerts(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for alerts" ON alerts;
CREATE POLICY "Allow all for alerts" ON alerts FOR ALL USING (true);

-- ============================================
-- 2. BLOCKLISTS TABLE (from migration 005)
-- ============================================
CREATE TABLE IF NOT EXISTS blocklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  description TEXT,
  list_type TEXT,
  entry_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocklists_source ON blocklists(source);

ALTER TABLE blocklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for blocklists" ON blocklists;
CREATE POLICY "Allow all for blocklists" ON blocklists FOR ALL USING (true);

-- ============================================
-- 3. THREAT_FEEDS TABLE (from migration 005)
-- ============================================
CREATE TABLE IF NOT EXISTS threat_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  feed_type TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  refresh_interval INTEGER DEFAULT 86400,
  last_fetched TIMESTAMPTZ,
  last_status TEXT,
  entry_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_feeds_active ON threat_feeds(is_active);

ALTER TABLE threat_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for threat_feeds" ON threat_feeds;
CREATE POLICY "Allow all for threat_feeds" ON threat_feeds FOR ALL USING (true);

-- ============================================
-- 4. BREACHES TABLE (from migration 008)
-- ============================================
CREATE TABLE IF NOT EXISTS breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  title TEXT,
  domain TEXT,
  breach_date DATE,
  added_date DATE,
  modified_date DATE,
  pwn_count BIGINT DEFAULT 0,
  description TEXT,
  logo_path TEXT,
  data_classes TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  is_fabricated BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  is_retired BOOLEAN DEFAULT false,
  is_spam_list BOOLEAN DEFAULT false,
  is_malware BOOLEAN DEFAULT false,
  is_subscription_free BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'hibp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breaches_name ON breaches(name);
CREATE INDEX IF NOT EXISTS idx_breaches_domain ON breaches(domain);
CREATE INDEX IF NOT EXISTS idx_breaches_date ON breaches(breach_date DESC);

ALTER TABLE breaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for breaches" ON breaches;
CREATE POLICY "Allow all for breaches" ON breaches FOR ALL USING (true);

-- ============================================
-- 5. TENANTS TABLE (from migration 021)
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    admin_email VARCHAR(255) NOT NULL,
    support_email VARCHAR(255),
    billing_email VARCHAR(255),
    custom_domain VARCHAR(255) UNIQUE,
    domain_verified BOOLEAN DEFAULT false,
    domain_verification_token VARCHAR(100),
    subscription_tier VARCHAR(50) DEFAULT 'team',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    max_users INTEGER DEFAULT 10,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tenants" ON tenants;
CREATE POLICY "Allow all for tenants" ON tenants FOR ALL USING (true);

-- ============================================
-- 6. TENANT_BRANDING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    logo_url TEXT,
    logo_dark_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#00ff9d',
    primary_dark VARCHAR(20) DEFAULT '#00cc7d',
    background_color VARCHAR(20) DEFAULT '#0a0f1a',
    surface_color VARCHAR(20) DEFAULT '#111827',
    text_color VARCHAR(20) DEFAULT '#ffffff',
    text_muted VARCHAR(20) DEFAULT '#9ca3af',
    font_family VARCHAR(100) DEFAULT 'Inter, system-ui, sans-serif',
    font_heading VARCHAR(100),
    company_name VARCHAR(255),
    tagline VARCHAR(255),
    copyright_text VARCHAR(255),
    support_url TEXT,
    documentation_url TEXT,
    terms_url TEXT,
    privacy_url TEXT,
    email_logo_url TEXT,
    email_footer_text TEXT,
    hide_powered_by BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id)
);

ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tenant_branding" ON tenant_branding;
CREATE POLICY "Allow all for tenant_branding" ON tenant_branding FOR ALL USING (true);

-- ============================================
-- 7. TENANT_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '[]',
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

ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tenant_members" ON tenant_members;
CREATE POLICY "Allow all for tenant_members" ON tenant_members FOR ALL USING (true);

-- ============================================
-- 8. TENANT_INVITATIONS TABLE
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

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tenant_invitations" ON tenant_invitations;
CREATE POLICY "Allow all for tenant_invitations" ON tenant_invitations FOR ALL USING (true);

-- ============================================
-- VERIFY ALL TABLES CREATED
-- ============================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('alerts', 'blocklists', 'threat_feeds', 'breaches', 'tenants', 'tenant_branding', 'tenant_members', 'tenant_invitations')
ORDER BY table_name;
