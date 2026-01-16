-- Migration 017: Attack Surface Monitoring
-- Phase 2.2: Monitor customer assets against threat intelligence

-- ============================================
-- Asset Inventory Table
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- Asset information
    asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN (
        'domain',        -- company.com
        'ip',            -- Single IP address
        'ip_range',      -- CIDR notation 192.168.1.0/24
        'email_domain',  -- @company.com for breach monitoring
        'keyword',       -- Brand name monitoring
        'executive'      -- Executive name monitoring
    )),
    value TEXT NOT NULL,
    name VARCHAR(255),
    description TEXT,

    -- Classification
    tags TEXT[] DEFAULT '{}',
    criticality VARCHAR(20) DEFAULT 'medium' CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(50), -- infrastructure, brand, personnel, vendor

    -- Monitoring settings
    is_monitored BOOLEAN DEFAULT true,
    notify_on_match BOOLEAN DEFAULT true,

    -- Match stats
    last_checked_at TIMESTAMP WITH TIME ZONE,
    match_count INTEGER DEFAULT 0,
    last_match_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per user+type+value
    UNIQUE(user_id, asset_type, value)
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_team ON assets(team_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_monitored ON assets(is_monitored) WHERE is_monitored = true;
CREATE INDEX IF NOT EXISTS idx_assets_value ON assets(value);

COMMENT ON TABLE assets IS 'Customer asset inventory for attack surface monitoring';

-- ============================================
-- Asset Matches Table
-- Records when an asset matches threat intelligence
-- ============================================
CREATE TABLE IF NOT EXISTS asset_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Match details
    match_type VARCHAR(50) NOT NULL, -- ioc, breach, certificate, mention
    source_table VARCHAR(50) NOT NULL, -- iocs, breaches, incidents, etc.
    source_id UUID,

    -- Match context
    matched_value TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    -- For IOC: { "ioc_type": "domain", "threat_type": "c2", "confidence": 80 }
    -- For breach: { "breach_name": "...", "exposed_data": [...] }
    -- For mention: { "incident_id": "...", "victim_name": "..." }

    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

    -- Status
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,

    -- Timestamps
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_matches_asset ON asset_matches(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_matches_user ON asset_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_matches_status ON asset_matches(status);
CREATE INDEX IF NOT EXISTS idx_asset_matches_severity ON asset_matches(severity);
CREATE INDEX IF NOT EXISTS idx_asset_matches_matched ON asset_matches(matched_at DESC);

COMMENT ON TABLE asset_matches IS 'Records when customer assets match threat intelligence';

-- ============================================
-- Asset Groups Table
-- Organize assets into groups
-- ============================================
CREATE TABLE IF NOT EXISTS asset_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_asset_groups_user ON asset_groups(user_id);

-- Junction table for assets in groups
CREATE TABLE IF NOT EXISTS asset_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES asset_groups(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(group_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_group_members_group ON asset_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_asset_group_members_asset ON asset_group_members(asset_id);

-- ============================================
-- Functions for Asset Matching
-- ============================================

-- Function to check if an IP is within a CIDR range
CREATE OR REPLACE FUNCTION ip_in_range(ip TEXT, cidr_range TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN ip::inet <<= cidr_range::inet;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update asset timestamps
CREATE OR REPLACE FUNCTION update_asset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asset_timestamp ON assets;
CREATE TRIGGER asset_timestamp
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_asset_timestamp();

-- ============================================
-- View for Asset Summary with Match Counts
-- ============================================
CREATE OR REPLACE VIEW v_asset_summary AS
SELECT
    a.id,
    a.user_id,
    a.team_id,
    a.asset_type,
    a.value,
    a.name,
    a.description,
    a.tags,
    a.criticality,
    a.category,
    a.is_monitored,
    a.notify_on_match,
    a.match_count,
    a.last_match_at,
    a.created_at,
    a.updated_at,
    COUNT(m.id) FILTER (WHERE m.status = 'new') as new_matches,
    COUNT(m.id) FILTER (WHERE m.status = 'investigating') as investigating_matches,
    MAX(m.matched_at) as latest_match_at
FROM assets a
LEFT JOIN asset_matches m ON m.asset_id = a.id
GROUP BY a.id;

-- ============================================
-- View for Recent Matches
-- ============================================
CREATE OR REPLACE VIEW v_recent_matches AS
SELECT
    m.id,
    m.asset_id,
    m.user_id,
    m.match_type,
    m.source_table,
    m.source_id,
    m.matched_value,
    m.context,
    m.severity,
    m.status,
    m.matched_at,
    a.asset_type,
    a.value as asset_value,
    a.name as asset_name,
    a.criticality as asset_criticality
FROM asset_matches m
JOIN assets a ON a.id = m.asset_id
ORDER BY m.matched_at DESC;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_group_members ENABLE ROW LEVEL SECURITY;

-- Users can manage their own assets
CREATE POLICY assets_access ON assets
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY asset_matches_access ON asset_matches
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY asset_groups_access ON asset_groups
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY asset_group_members_access ON asset_group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM asset_groups
            WHERE id = asset_group_members.group_id
            AND user_id = current_setting('app.user_id', true)
        )
    );

-- ============================================
-- Sample Insert for Testing (commented out)
-- ============================================
-- INSERT INTO assets (user_id, asset_type, value, name, criticality, category)
-- VALUES
--     ('test-user', 'domain', 'example.com', 'Main Website', 'critical', 'infrastructure'),
--     ('test-user', 'ip_range', '192.168.1.0/24', 'Corporate Network', 'high', 'infrastructure'),
--     ('test-user', 'email_domain', 'example.com', 'Corporate Email', 'critical', 'infrastructure'),
--     ('test-user', 'keyword', 'ExampleCorp', 'Brand Monitoring', 'medium', 'brand');
