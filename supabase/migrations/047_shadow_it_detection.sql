-- Migration: Shadow IT Detection
-- Created: 2026-01-16
-- Description: Track and detect unauthorized/unknown IT assets and services

-- ============================================
-- DISCOVERED ASSETS (Shadow IT Candidates)
-- ============================================

CREATE TABLE IF NOT EXISTS discovered_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  -- Discovery info
  discovery_source TEXT NOT NULL CHECK (discovery_source IN (
    'dns_query', 'certificate_transparency', 'network_scan',
    'cloud_audit', 'traffic_analysis', 'third_party_integration', 'manual'
  )),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  -- Asset details
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'domain', 'subdomain', 'ip_address', 'cloud_service',
    'saas_application', 'api_endpoint', 'server', 'device', 'other'
  )),
  value TEXT NOT NULL, -- The actual asset identifier
  hostname TEXT,
  ip_addresses TEXT[],
  ports INTEGER[],
  -- Classification
  status TEXT DEFAULT 'unreviewed' CHECK (status IN (
    'unreviewed', 'approved', 'shadow_it', 'blocked', 'retired'
  )),
  risk_level TEXT DEFAULT 'unknown' CHECK (risk_level IN (
    'critical', 'high', 'medium', 'low', 'unknown'
  )),
  -- Context
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  associated_users TEXT[],
  departments TEXT[],
  -- Metadata
  cloud_provider TEXT,
  service_type TEXT, -- e.g., 'storage', 'collaboration', 'development'
  vendor TEXT,
  -- Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  -- Raw data
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, asset_type, value)
);

-- ============================================
-- KNOWN CLOUD SERVICES (For Detection)
-- ============================================

CREATE TABLE IF NOT EXISTS known_cloud_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'storage', 'communication', 'development', 'productivity', etc.
  vendor TEXT,
  domains TEXT[] NOT NULL, -- Domains that indicate this service
  risk_level TEXT DEFAULT 'medium',
  is_sanctioned BOOLEAN DEFAULT FALSE, -- Is this an approved service?
  description TEXT,
  security_rating TEXT, -- 'A', 'B', 'C', 'D', 'F'
  compliance_certifications TEXT[], -- 'SOC2', 'ISO27001', 'HIPAA', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHADOW IT RULES
-- ============================================

CREATE TABLE IF NOT EXISTS shadow_it_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'domain_pattern', 'ip_range', 'cloud_service', 'port', 'keyword'
  )),
  -- Rule criteria
  pattern TEXT, -- Regex or CIDR
  cloud_services TEXT[], -- List of service names
  ports INTEGER[],
  -- Action
  action TEXT NOT NULL DEFAULT 'alert' CHECK (action IN ('alert', 'block', 'monitor', 'ignore')),
  risk_level TEXT DEFAULT 'medium',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHADOW IT ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS shadow_it_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  discovered_asset_id UUID REFERENCES discovered_assets(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES shadow_it_rules(id) ON DELETE SET NULL,
  -- Alert details
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APPROVED SERVICES (Whitelist)
-- ============================================

CREATE TABLE IF NOT EXISTS approved_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_type TEXT,
  domains TEXT[],
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  business_justification TEXT,
  data_classification TEXT, -- 'public', 'internal', 'confidential', 'restricted'
  compliance_requirements TEXT[],

  UNIQUE(team_id, service_name)
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if a domain matches shadow IT patterns
CREATE OR REPLACE FUNCTION check_shadow_it(
  p_team_id UUID,
  p_value TEXT,
  p_asset_type TEXT
)
RETURNS TABLE(
  is_shadow_it BOOLEAN,
  risk_level TEXT,
  matched_rule_id UUID,
  service_name TEXT
) AS $$
DECLARE
  v_rule shadow_it_rules%ROWTYPE;
  v_service known_cloud_services%ROWTYPE;
  v_approved BOOLEAN;
BEGIN
  -- Check if it's an approved service
  SELECT EXISTS(
    SELECT 1 FROM approved_services
    WHERE team_id = p_team_id
      AND (
        service_name ILIKE '%' || p_value || '%'
        OR p_value = ANY(domains)
      )
      AND (expiry_date IS NULL OR expiry_date > NOW())
  ) INTO v_approved;

  IF v_approved THEN
    RETURN QUERY SELECT FALSE, 'low'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Check against known cloud services
  SELECT * INTO v_service
  FROM known_cloud_services
  WHERE p_value ILIKE ANY(
    SELECT '%' || unnest(domains) || '%'
  )
  AND NOT is_sanctioned
  LIMIT 1;

  IF v_service.id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, v_service.risk_level, NULL::UUID, v_service.name;
    RETURN;
  END IF;

  -- Check against team rules
  FOR v_rule IN
    SELECT * FROM shadow_it_rules
    WHERE team_id = p_team_id
      AND enabled = TRUE
      AND rule_type = 'domain_pattern'
  LOOP
    IF p_value ~ v_rule.pattern THEN
      RETURN QUERY SELECT TRUE, v_rule.risk_level, v_rule.id, NULL::TEXT;
      RETURN;
    END IF;
  END LOOP;

  -- Default: not detected as shadow IT
  RETURN QUERY SELECT FALSE, 'unknown'::TEXT, NULL::UUID, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Record a discovered asset
CREATE OR REPLACE FUNCTION record_discovered_asset(
  p_team_id UUID,
  p_asset_type TEXT,
  p_value TEXT,
  p_source TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_asset_id UUID;
  v_shadow_check RECORD;
BEGIN
  -- Check shadow IT status
  SELECT * INTO v_shadow_check FROM check_shadow_it(p_team_id, p_value, p_asset_type);

  -- Upsert the discovered asset
  INSERT INTO discovered_assets (
    team_id, asset_type, value, discovery_source,
    status, risk_level, raw_data
  )
  VALUES (
    p_team_id, p_asset_type, p_value, p_source,
    CASE WHEN v_shadow_check.is_shadow_it THEN 'shadow_it' ELSE 'unreviewed' END,
    COALESCE(v_shadow_check.risk_level, 'unknown'),
    p_metadata
  )
  ON CONFLICT (team_id, asset_type, value) DO UPDATE SET
    last_seen = NOW(),
    occurrence_count = discovered_assets.occurrence_count + 1,
    raw_data = discovered_assets.raw_data || p_metadata,
    updated_at = NOW()
  RETURNING id INTO v_asset_id;

  -- Create alert if shadow IT detected
  IF v_shadow_check.is_shadow_it THEN
    INSERT INTO shadow_it_alerts (
      team_id, discovered_asset_id, rule_id,
      alert_type, severity, title, description
    )
    VALUES (
      p_team_id, v_asset_id, v_shadow_check.matched_rule_id,
      'shadow_it_detected',
      CASE v_shadow_check.risk_level
        WHEN 'critical' THEN 'critical'
        WHEN 'high' THEN 'high'
        ELSE 'medium'
      END,
      'Potential Shadow IT Detected: ' || p_value,
      'A potentially unauthorized service was detected: ' || p_value ||
      CASE WHEN v_shadow_check.service_name IS NOT NULL
        THEN ' (identified as ' || v_shadow_check.service_name || ')'
        ELSE ''
      END
    );
  END IF;

  RETURN v_asset_id;
END;
$$ LANGUAGE plpgsql;

-- Get shadow IT summary for a team
CREATE OR REPLACE FUNCTION get_shadow_it_summary(p_team_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_discovered', (SELECT COUNT(*) FROM discovered_assets WHERE team_id = p_team_id),
    'shadow_it_count', (SELECT COUNT(*) FROM discovered_assets WHERE team_id = p_team_id AND status = 'shadow_it'),
    'unreviewed_count', (SELECT COUNT(*) FROM discovered_assets WHERE team_id = p_team_id AND status = 'unreviewed'),
    'approved_count', (SELECT COUNT(*) FROM discovered_assets WHERE team_id = p_team_id AND status = 'approved'),
    'by_risk_level', (
      SELECT jsonb_object_agg(risk_level, cnt)
      FROM (
        SELECT risk_level, COUNT(*) as cnt
        FROM discovered_assets
        WHERE team_id = p_team_id AND status IN ('shadow_it', 'unreviewed')
        GROUP BY risk_level
      ) sub
    ),
    'by_asset_type', (
      SELECT jsonb_object_agg(asset_type, cnt)
      FROM (
        SELECT asset_type, COUNT(*) as cnt
        FROM discovered_assets
        WHERE team_id = p_team_id
        GROUP BY asset_type
      ) sub
    ),
    'open_alerts', (SELECT COUNT(*) FROM shadow_it_alerts WHERE team_id = p_team_id AND status = 'open'),
    'recent_discoveries', (
      SELECT jsonb_agg(row_to_json(d))
      FROM (
        SELECT id, asset_type, value, status, risk_level, discovered_at
        FROM discovered_assets
        WHERE team_id = p_team_id
        ORDER BY discovered_at DESC
        LIMIT 10
      ) d
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DEFAULT KNOWN SERVICES
-- ============================================

INSERT INTO known_cloud_services (name, category, vendor, domains, risk_level, is_sanctioned, security_rating, compliance_certifications) VALUES
  ('Dropbox', 'storage', 'Dropbox Inc', ARRAY['dropbox.com', 'dropboxusercontent.com'], 'medium', false, 'B', ARRAY['SOC2', 'ISO27001']),
  ('Google Drive', 'storage', 'Google', ARRAY['drive.google.com', 'docs.google.com'], 'medium', false, 'A', ARRAY['SOC2', 'ISO27001', 'FedRAMP']),
  ('OneDrive', 'storage', 'Microsoft', ARRAY['onedrive.live.com', 'sharepoint.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'FedRAMP']),
  ('Box', 'storage', 'Box Inc', ARRAY['box.com', 'box.net'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'HIPAA']),
  ('WeTransfer', 'file_transfer', 'WeTransfer', ARRAY['wetransfer.com'], 'high', false, 'C', ARRAY['SOC2']),
  ('Slack', 'communication', 'Salesforce', ARRAY['slack.com', 'slack-edge.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001']),
  ('Discord', 'communication', 'Discord Inc', ARRAY['discord.com', 'discordapp.com'], 'high', false, 'C', ARRAY[]),
  ('Telegram', 'communication', 'Telegram', ARRAY['telegram.org', 't.me', 'web.telegram.org'], 'high', false, 'D', ARRAY[]),
  ('WhatsApp Web', 'communication', 'Meta', ARRAY['web.whatsapp.com'], 'medium', false, 'C', ARRAY[]),
  ('Zoom', 'video_conferencing', 'Zoom', ARRAY['zoom.us', 'zoomgov.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'HIPAA']),
  ('Notion', 'productivity', 'Notion Labs', ARRAY['notion.so', 'notion.site'], 'medium', false, 'B', ARRAY['SOC2']),
  ('Airtable', 'productivity', 'Airtable', ARRAY['airtable.com'], 'medium', false, 'B', ARRAY['SOC2']),
  ('Trello', 'productivity', 'Atlassian', ARRAY['trello.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001']),
  ('GitHub', 'development', 'Microsoft', ARRAY['github.com', 'githubusercontent.com'], 'medium', false, 'A', ARRAY['SOC2', 'ISO27001']),
  ('GitLab', 'development', 'GitLab Inc', ARRAY['gitlab.com'], 'medium', false, 'A', ARRAY['SOC2', 'ISO27001']),
  ('Bitbucket', 'development', 'Atlassian', ARRAY['bitbucket.org'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001']),
  ('Heroku', 'cloud_hosting', 'Salesforce', ARRAY['heroku.com', 'herokuapp.com'], 'high', false, 'B', ARRAY['SOC2']),
  ('Vercel', 'cloud_hosting', 'Vercel', ARRAY['vercel.app', 'vercel.com'], 'medium', false, 'B', ARRAY['SOC2']),
  ('Netlify', 'cloud_hosting', 'Netlify', ARRAY['netlify.app', 'netlify.com'], 'medium', false, 'B', ARRAY['SOC2']),
  ('AWS', 'cloud_infrastructure', 'Amazon', ARRAY['amazonaws.com', 'aws.amazon.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'FedRAMP', 'HIPAA']),
  ('Azure', 'cloud_infrastructure', 'Microsoft', ARRAY['azure.com', 'windows.net', 'azurewebsites.net'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'FedRAMP', 'HIPAA']),
  ('GCP', 'cloud_infrastructure', 'Google', ARRAY['cloud.google.com', 'googleapis.com', 'appspot.com'], 'low', false, 'A', ARRAY['SOC2', 'ISO27001', 'FedRAMP']),
  ('Pastebin', 'utility', 'Pastebin', ARRAY['pastebin.com'], 'critical', false, 'F', ARRAY[]),
  ('file.io', 'file_transfer', 'file.io', ARRAY['file.io'], 'critical', false, 'F', ARRAY[]),
  ('ngrok', 'tunneling', 'ngrok', ARRAY['ngrok.io', 'ngrok.com'], 'critical', false, 'D', ARRAY[]),
  ('Tailscale', 'vpn', 'Tailscale', ARRAY['tailscale.com'], 'high', false, 'B', ARRAY['SOC2'])
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_discovered_assets_team ON discovered_assets(team_id);
CREATE INDEX IF NOT EXISTS idx_discovered_assets_status ON discovered_assets(status);
CREATE INDEX IF NOT EXISTS idx_discovered_assets_type ON discovered_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_discovered_assets_value ON discovered_assets(value);
CREATE INDEX IF NOT EXISTS idx_discovered_assets_last_seen ON discovered_assets(last_seen);
CREATE INDEX IF NOT EXISTS idx_shadow_it_rules_team ON shadow_it_rules(team_id);
CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_team ON shadow_it_alerts(team_id);
CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_status ON shadow_it_alerts(status);
CREATE INDEX IF NOT EXISTS idx_known_services_domains ON known_cloud_services USING gin(domains);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE discovered_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_it_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_it_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view discovered assets" ON discovered_assets
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can manage discovered assets" ON discovered_assets
  FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Team members can view shadow IT rules" ON shadow_it_rules
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can manage shadow IT rules" ON shadow_it_rules
  FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Team members can view shadow IT alerts" ON shadow_it_alerts
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can update shadow IT alerts" ON shadow_it_alerts
  FOR UPDATE USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can view approved services" ON approved_services
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Anyone can read known cloud services
CREATE POLICY "Anyone can view known cloud services" ON known_cloud_services
  FOR SELECT USING (true);
