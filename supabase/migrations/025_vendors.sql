-- Migration 025: Vendor Risk Monitoring
-- Phase 4.2: Monitor third-party vendors for security issues

-- ============================================
-- Vendor Registry
-- ============================================
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    -- Vendor info
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255), -- Primary domain for breach monitoring
    website VARCHAR(500),
    description TEXT,
    logo_url TEXT,

    -- Classification
    category VARCHAR(50), -- cloud, saas, infrastructure, security, etc.
    criticality VARCHAR(20) DEFAULT 'medium', -- critical, high, medium, low

    -- Contact
    primary_contact VARCHAR(255),
    contact_email VARCHAR(255),
    contract_owner VARCHAR(255),

    -- Contract details
    contract_start_date DATE,
    contract_end_date DATE,
    contract_value DECIMAL(12, 2),
    renewal_type VARCHAR(20), -- auto, manual

    -- Data handling
    data_types TEXT[], -- pii, phi, financial, credentials, etc.
    data_classification VARCHAR(20), -- public, internal, confidential, restricted

    -- Risk assessment
    risk_score INTEGER DEFAULT 50, -- 0-100
    risk_level VARCHAR(20) DEFAULT 'medium', -- critical, high, medium, low
    last_assessment_date DATE,

    -- Monitoring
    is_monitored BOOLEAN DEFAULT true,
    monitor_breaches BOOLEAN DEFAULT true,
    monitor_vulnerabilities BOOLEAN DEFAULT true,
    monitor_news BOOLEAN DEFAULT false,

    -- Technology stack (for CVE correlation)
    technologies TEXT[], -- e.g., ['microsoft_365', 'aws', 'salesforce']

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, pending_review, offboarding

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_user ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_team ON vendors(team_id);
CREATE INDEX IF NOT EXISTS idx_vendors_domain ON vendors(domain);
CREATE INDEX IF NOT EXISTS idx_vendors_risk ON vendors(risk_level, risk_score);

COMMENT ON TABLE vendors IS 'Third-party vendor inventory for risk monitoring';

-- ============================================
-- Vendor Risk Events
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

    -- Event info
    event_type VARCHAR(50) NOT NULL, -- breach, vulnerability, news, compliance, incident
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low, info

    -- Details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    source VARCHAR(100), -- hibp, cve, news, manual
    source_url TEXT,
    source_id VARCHAR(255), -- External ID (CVE-xxx, breach ID, etc.)

    -- Impact
    affected_data_types TEXT[],
    affected_records INTEGER,
    financial_impact DECIMAL(12, 2),

    -- Status
    status VARCHAR(20) DEFAULT 'open', -- open, acknowledged, mitigated, resolved
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,

    -- Risk score impact
    risk_score_delta INTEGER DEFAULT 0,

    -- Timestamps
    event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_events_vendor ON vendor_risk_events(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_events_type ON vendor_risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vendor_events_status ON vendor_risk_events(status);

COMMENT ON TABLE vendor_risk_events IS 'Security events affecting vendors';

-- ============================================
-- Vendor Assessments
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

    -- Assessment info
    assessment_type VARCHAR(50), -- initial, annual, incident_triggered, contract_renewal
    status VARCHAR(20) DEFAULT 'in_progress', -- draft, in_progress, completed, expired

    -- Scores by category
    security_score INTEGER, -- 0-100
    privacy_score INTEGER,
    compliance_score INTEGER,
    operational_score INTEGER,
    overall_score INTEGER,

    -- Questionnaire responses (flexible JSON)
    responses JSONB DEFAULT '{}',

    -- Findings
    findings JSONB DEFAULT '[]', -- Array of { category, finding, severity, recommendation }

    -- Attachments
    attachments JSONB DEFAULT '[]', -- Array of { name, url, type }

    -- Reviewer
    assessed_by VARCHAR(255),
    reviewed_by VARCHAR(255),

    -- Dates
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    valid_until DATE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_assessments_vendor ON vendor_assessments(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_status ON vendor_assessments(status);

COMMENT ON TABLE vendor_assessments IS 'Security assessments and questionnaires for vendors';

-- ============================================
-- Vendor Technology Products (for CVE mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product info
    name VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255), -- The software vendor (Microsoft, Cisco, etc.)
    product_type VARCHAR(50), -- os, application, service, hardware

    -- CPE for CVE matching
    cpe_vendor VARCHAR(100),
    cpe_product VARCHAR(100),

    -- Common identifiers
    keywords TEXT[], -- For fuzzy matching

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed some common products
INSERT INTO vendor_products (name, vendor_name, product_type, cpe_vendor, cpe_product, keywords) VALUES
    ('Microsoft 365', 'Microsoft', 'service', 'microsoft', 'office_365', ARRAY['office365', 'm365', 'microsoft_365']),
    ('Azure', 'Microsoft', 'service', 'microsoft', 'azure', ARRAY['azure_cloud', 'microsoft_azure']),
    ('AWS', 'Amazon', 'service', 'amazon', 'aws', ARRAY['amazon_web_services', 'ec2', 's3']),
    ('Salesforce', 'Salesforce', 'service', 'salesforce', 'salesforce', ARRAY['sfdc', 'salesforce_crm']),
    ('Google Workspace', 'Google', 'service', 'google', 'workspace', ARRAY['gsuite', 'google_apps']),
    ('Okta', 'Okta', 'service', 'okta', 'okta', ARRAY['okta_sso', 'okta_identity']),
    ('ServiceNow', 'ServiceNow', 'service', 'servicenow', 'servicenow', ARRAY['snow', 'service_now']),
    ('Workday', 'Workday', 'service', 'workday', 'workday', ARRAY['workday_hcm']),
    ('Slack', 'Salesforce', 'service', 'slack', 'slack', ARRAY['slack_enterprise']),
    ('Zoom', 'Zoom', 'service', 'zoom', 'zoom', ARRAY['zoom_meetings', 'zoom_video'])
ON CONFLICT DO NOTHING;

-- ============================================
-- Views
-- ============================================

-- Vendor risk summary
CREATE OR REPLACE VIEW v_vendor_risk_summary AS
SELECT
    v.id,
    v.name,
    v.domain,
    v.category,
    v.criticality,
    v.risk_score,
    v.risk_level,
    v.status,
    v.is_monitored,
    (
        SELECT COUNT(*) FROM vendor_risk_events vre
        WHERE vre.vendor_id = v.id AND vre.status = 'open'
    ) as open_events,
    (
        SELECT MAX(event_date) FROM vendor_risk_events vre
        WHERE vre.vendor_id = v.id
    ) as last_event_date,
    (
        SELECT overall_score FROM vendor_assessments va
        WHERE va.vendor_id = v.id AND va.status = 'completed'
        ORDER BY va.completed_at DESC LIMIT 1
    ) as latest_assessment_score
FROM vendors v
WHERE v.status != 'inactive';

-- Open risk events
CREATE OR REPLACE VIEW v_open_vendor_risks AS
SELECT
    vre.*,
    v.name as vendor_name,
    v.criticality as vendor_criticality
FROM vendor_risk_events vre
JOIN vendors v ON vre.vendor_id = v.id
WHERE vre.status IN ('open', 'acknowledged')
ORDER BY
    CASE vre.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
    END,
    vre.event_date DESC;

-- ============================================
-- Functions
-- ============================================

-- Calculate vendor risk score
CREATE OR REPLACE FUNCTION calculate_vendor_risk_score(p_vendor_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_base_score INTEGER := 50;
    v_event_score INTEGER := 0;
    v_assessment_score INTEGER := 0;
    v_criticality_multiplier NUMERIC;
    v_final_score INTEGER;
BEGIN
    -- Get criticality multiplier
    SELECT
        CASE criticality
            WHEN 'critical' THEN 1.5
            WHEN 'high' THEN 1.25
            WHEN 'medium' THEN 1.0
            WHEN 'low' THEN 0.75
            ELSE 1.0
        END INTO v_criticality_multiplier
    FROM vendors WHERE id = p_vendor_id;

    -- Calculate event-based score adjustment
    SELECT COALESCE(SUM(
        CASE severity
            WHEN 'critical' THEN 20
            WHEN 'high' THEN 10
            WHEN 'medium' THEN 5
            WHEN 'low' THEN 2
            ELSE 0
        END
    ), 0) INTO v_event_score
    FROM vendor_risk_events
    WHERE vendor_id = p_vendor_id
    AND status IN ('open', 'acknowledged')
    AND event_date > NOW() - INTERVAL '90 days';

    -- Get latest assessment score (inverted: lower assessment = higher risk)
    SELECT 100 - COALESCE(overall_score, 50) INTO v_assessment_score
    FROM vendor_assessments
    WHERE vendor_id = p_vendor_id AND status = 'completed'
    ORDER BY completed_at DESC LIMIT 1;

    -- Calculate final score
    v_final_score := LEAST(100, GREATEST(0,
        (v_base_score + v_event_score + (v_assessment_score * 0.3)) * v_criticality_multiplier
    ))::INTEGER;

    -- Update vendor
    UPDATE vendors
    SET
        risk_score = v_final_score,
        risk_level = CASE
            WHEN v_final_score >= 80 THEN 'critical'
            WHEN v_final_score >= 60 THEN 'high'
            WHEN v_final_score >= 40 THEN 'medium'
            ELSE 'low'
        END,
        updated_at = NOW()
    WHERE id = p_vendor_id;

    RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_assessments ENABLE ROW LEVEL SECURITY;

-- Vendors: User or team access
CREATE POLICY vendors_access ON vendors
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
        OR (team_id IS NOT NULL AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
        ))
    );

-- Events: Access through vendor
CREATE POLICY vendor_events_access ON vendor_risk_events
    FOR ALL USING (
        vendor_id IN (
            SELECT id FROM vendors
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );

-- Assessments: Access through vendor
CREATE POLICY vendor_assessments_access ON vendor_assessments
    FOR ALL USING (
        vendor_id IN (
            SELECT id FROM vendors
            WHERE user_id = current_setting('app.user_id', true)
            OR (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = current_setting('app.user_id', true)
            ))
        )
    );
