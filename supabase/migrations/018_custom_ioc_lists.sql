-- Migration 018: Custom IOC Lists
-- Phase 2.3: Import and manage private IOC collections

-- ============================================
-- Custom IOC Lists Table
-- ============================================
CREATE TABLE IF NOT EXISTS custom_ioc_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- List metadata
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20),

    -- Source info
    source VARCHAR(100), -- internal, vendor name, osint, etc.
    source_url TEXT,

    -- Stats (updated by triggers)
    ioc_count INTEGER DEFAULT 0,

    -- Settings
    is_public BOOLEAN DEFAULT false, -- Shared with team
    auto_enrich BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_imported_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_ioc_lists_user ON custom_ioc_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_ioc_lists_team ON custom_ioc_lists(team_id);

COMMENT ON TABLE custom_ioc_lists IS 'Custom IOC list collections for private threat intelligence';

-- ============================================
-- Custom IOCs Table
-- ============================================
CREATE TABLE IF NOT EXISTS custom_iocs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES custom_ioc_lists(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- IOC details
    ioc_type VARCHAR(30) NOT NULL CHECK (ioc_type IN (
        'ip', 'ipv6', 'domain', 'url', 'email',
        'md5', 'sha1', 'sha256',
        'filename', 'filepath', 'registry_key',
        'user_agent', 'asn', 'cidr',
        'bitcoin_address', 'cve', 'other'
    )),
    value TEXT NOT NULL,
    value_normalized TEXT NOT NULL, -- Lowercase, trimmed for matching

    -- Classification
    threat_type VARCHAR(50), -- malware, c2, phishing, ransomware, botnet, etc.
    malware_family VARCHAR(100),
    confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

    -- Context
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,

    -- Enrichment data (populated by enrichment jobs)
    enrichment JSONB DEFAULT '{}',
    -- { "vt_detected": 45, "vt_total": 70, "country": "RU", "asn": "AS12345", ... }
    enriched_at TIMESTAMP WITH TIME ZONE,

    -- Match tracking
    public_match_id UUID, -- Links to public IOC if matched
    public_match_at TIMESTAMP WITH TIME ZONE,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_false_positive BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per list
    UNIQUE(list_id, ioc_type, value_normalized)
);

CREATE INDEX IF NOT EXISTS idx_custom_iocs_list ON custom_iocs(list_id);
CREATE INDEX IF NOT EXISTS idx_custom_iocs_user ON custom_iocs(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_iocs_type ON custom_iocs(ioc_type);
CREATE INDEX IF NOT EXISTS idx_custom_iocs_value ON custom_iocs(value_normalized);
CREATE INDEX IF NOT EXISTS idx_custom_iocs_active ON custom_iocs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_custom_iocs_severity ON custom_iocs(severity);
CREATE INDEX IF NOT EXISTS idx_custom_iocs_created ON custom_iocs(created_at DESC);

COMMENT ON TABLE custom_iocs IS 'Individual IOCs within custom lists';

-- ============================================
-- Import History Table
-- ============================================
CREATE TABLE IF NOT EXISTS custom_ioc_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES custom_ioc_lists(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Import details
    filename VARCHAR(255),
    format VARCHAR(20) NOT NULL, -- csv, stix, misp, json, text
    file_size INTEGER,

    -- Results
    total_rows INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]', -- Array of { line: 5, error: "Invalid IP" }

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_ioc_imports_list ON custom_ioc_imports(list_id);
CREATE INDEX IF NOT EXISTS idx_custom_ioc_imports_user ON custom_ioc_imports(user_id);

-- ============================================
-- Trigger to update list IOC count
-- ============================================
CREATE OR REPLACE FUNCTION update_custom_ioc_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE custom_ioc_lists
        SET ioc_count = (
            SELECT COUNT(*) FROM custom_iocs
            WHERE list_id = NEW.list_id AND is_active = true
        ),
        updated_at = NOW()
        WHERE id = NEW.list_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE custom_ioc_lists
        SET ioc_count = (
            SELECT COUNT(*) FROM custom_iocs
            WHERE list_id = OLD.list_id AND is_active = true
        ),
        updated_at = NOW()
        WHERE id = OLD.list_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_ioc_count_trigger ON custom_iocs;
CREATE TRIGGER custom_ioc_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON custom_iocs
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_ioc_list_count();

-- ============================================
-- View for IOC Summary
-- ============================================
CREATE OR REPLACE VIEW v_custom_iocs_summary AS
SELECT
    i.id,
    i.list_id,
    i.user_id,
    i.ioc_type,
    i.value,
    i.threat_type,
    i.malware_family,
    i.confidence,
    i.severity,
    i.tags,
    i.is_active,
    i.is_false_positive,
    i.enrichment,
    i.public_match_id,
    i.created_at,
    i.updated_at,
    l.name as list_name,
    l.color as list_color
FROM custom_iocs i
JOIN custom_ioc_lists l ON l.id = i.list_id;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE custom_ioc_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_iocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_ioc_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_ioc_lists_access ON custom_ioc_lists
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY custom_iocs_access ON custom_iocs
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY custom_ioc_imports_access ON custom_ioc_imports
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );
