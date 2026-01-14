-- Migration 010: Notifications, User Preferences, and Alert Rules
-- Sprint 2: Email & Notifications

-- ============================================
-- User Preferences (extended)
-- ============================================
-- Extend user_preferences with notification settings
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(20) DEFAULT 'none' CHECK (digest_frequency IN ('none', 'daily', 'weekly')),
ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '06:00:00',
ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS excluded_sectors TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS excluded_event_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS severity_threshold VARCHAR(20) DEFAULT 'low' CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low', 'info')),
ADD COLUMN IF NOT EXISTS preferred_regions TEXT[] DEFAULT '{}';

COMMENT ON COLUMN user_preferences.digest_frequency IS 'Email digest frequency: none, daily, weekly';
COMMENT ON COLUMN user_preferences.digest_time IS 'Preferred time for digest delivery (UTC)';
COMMENT ON COLUMN user_preferences.excluded_sectors IS 'Sectors to hide from user (e.g., ics, agriculture)';
COMMENT ON COLUMN user_preferences.severity_threshold IS 'Minimum severity to show in feeds';

-- ============================================
-- In-App Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'kev_added', 'actor_escalating', 'watchlist_update',
        'vendor_alert', 'sector_incident', 'system', 'digest_ready'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    link VARCHAR(500), -- URL to related item
    related_id VARCHAR(255), -- ID of related entity (CVE, actor, etc.)
    related_type VARCHAR(50), -- Type of related entity
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications for user alerts and updates';

-- ============================================
-- User Alert Rules
-- ============================================
CREATE TABLE IF NOT EXISTS user_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'vendor_cve', 'actor_activity', 'sector_incident',
        'kev_added', 'severity_threshold', 'custom'
    )),
    conditions JSONB NOT NULL DEFAULT '{}',
    -- Example conditions:
    -- vendor_cve: { "vendors": ["Cisco", "Microsoft"], "min_severity": "high", "kev_only": false }
    -- actor_activity: { "actor_ids": [], "actor_names": ["LockBit"], "event_types": ["escalating", "incident"] }
    -- sector_incident: { "sectors": ["healthcare"], "min_incidents": 1 }
    notify_email BOOLEAN DEFAULT true,
    notify_in_app BOOLEAN DEFAULT true,
    enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON user_alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON user_alert_rules(rule_type) WHERE enabled = true;

COMMENT ON TABLE user_alert_rules IS 'Custom alert rules for personalized notifications';

-- ============================================
-- Alert Rule Triggers (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES user_alert_rules(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    trigger_data JSONB, -- Data that triggered the alert
    notification_sent BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_rule ON alert_triggers(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_created ON alert_triggers(created_at DESC);

-- ============================================
-- Threat Hunts (for actionable hunt guides)
-- ============================================
CREATE TABLE IF NOT EXISTS threat_hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    cve_ids TEXT[] DEFAULT '{}',
    confidence VARCHAR(20) DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
    description TEXT,
    -- Quick checks that don't require special tools
    quick_checks JSONB DEFAULT '[]',
    -- Example: [{"title": "Check scheduled tasks", "command": "schtasks /query", "look_for": "Tasks by SYSTEM"}]
    -- SIEM-specific queries
    log_queries JSONB DEFAULT '{}',
    -- Example: {"splunk": "index=windows EventCode=4688...", "elastic": "process.name:cmd.exe..."}
    registry_checks JSONB DEFAULT '[]',
    network_indicators JSONB DEFAULT '[]',
    -- Defensive recommendations
    recommendations TEXT[],
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(100), -- Where this hunt came from (CISA, vendor, community)
    source_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_hunts_actor ON threat_hunts(actor_id);
CREATE INDEX IF NOT EXISTS idx_threat_hunts_active ON threat_hunts(is_active) WHERE is_active = true;

COMMENT ON TABLE threat_hunts IS 'Actionable threat hunt guides with detection queries';

-- ============================================
-- User Hunt Progress (tracking completed checks)
-- ============================================
CREATE TABLE IF NOT EXISTS user_hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    hunt_id UUID REFERENCES threat_hunts(id) ON DELETE CASCADE,
    completed_checks JSONB DEFAULT '[]', -- Array of completed check indices
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'dismissed')),
    notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, hunt_id)
);

CREATE INDEX IF NOT EXISTS idx_hunt_progress_user ON user_hunt_progress(user_id);

-- ============================================
-- Helper function to mark notification as read
-- ============================================
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = notification_id AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Helper function to mark all notifications as read
-- ============================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE notifications
    SET read_at = NOW()
    WHERE user_id = p_user_id AND read_at IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to update alert rule timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_alert_rule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alert_rule_timestamp ON user_alert_rules;
CREATE TRIGGER alert_rule_timestamp
    BEFORE UPDATE ON user_alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_alert_rule_timestamp();

-- ============================================
-- Insert some sample threat hunts
-- ============================================
INSERT INTO threat_hunts (title, actor_name, confidence, description, quick_checks, log_queries, recommendations, tags, source)
VALUES
(
    'LockBit 3.0 Detection Guide',
    'LockBit',
    'high',
    'Detection guide for LockBit 3.0 ransomware indicators. This threat hunt helps identify potential LockBit activity in your environment.',
    '[
        {"title": "Check for unexpected scheduled tasks", "command": "schtasks /query /fo LIST /v", "look_for": "Tasks created in last 7 days by SYSTEM account"},
        {"title": "Review recent service installations", "command": "Get-EventLog -LogName System -Source \"Service Control Manager\" -Newest 50", "look_for": "Services with random or suspicious names"},
        {"title": "Check for disabled security tools", "command": "Get-MpComputerStatus", "look_for": "RealTimeProtectionEnabled = False"}
    ]'::jsonb,
    '{
        "splunk": "index=windows (EventCode=4688 OR EventCode=1) (NewProcessName=\"*cmd.exe\" OR Image=\"*cmd.exe\") | where match(ParentProcessName, \"wmiprvse|powershell\")",
        "elastic": "process.name:\"cmd.exe\" AND (process.parent.name:\"wmiprvse.exe\" OR process.parent.name:\"powershell.exe\")",
        "sentinel": "SecurityEvent | where EventID == 4688 | where NewProcessName endswith \"cmd.exe\" | where ParentProcessName matches regex \"wmiprvse|powershell\""
    }'::jsonb,
    ARRAY['Patch all internet-facing systems', 'Enable MFA on all remote access', 'Segment critical systems from user networks', 'Maintain offline backups'],
    ARRAY['ransomware', 'lockbit', 'encryption'],
    'CISA'
),
(
    'ALPHV/BlackCat Detection Guide',
    'ALPHV',
    'high',
    'Detection guide for ALPHV/BlackCat ransomware. Cross-platform ransomware written in Rust targeting Windows, Linux, and VMware ESXi.',
    '[
        {"title": "Check for ESXi VM encryption", "command": "esxcli vm process list", "look_for": "VMs with .encrypted extension or unresponsive"},
        {"title": "Review PowerShell execution policy changes", "command": "Get-ExecutionPolicy -List", "look_for": "Unrestricted or Bypass policies"},
        {"title": "Check for credential dumping artifacts", "command": "dir C:\\Windows\\Temp\\*.dmp", "look_for": "Memory dump files from LSASS"}
    ]'::jsonb,
    '{
        "splunk": "index=windows EventCode=4688 (CommandLine=\"*-ep bypass*\" OR CommandLine=\"*invoke-mimikatz*\" OR CommandLine=\"*sekurlsa*\")",
        "elastic": "process.command_line:(*bypass* OR *mimikatz* OR *sekurlsa*)",
        "sentinel": "SecurityEvent | where EventID == 4688 | where CommandLine contains \"bypass\" or CommandLine contains \"mimikatz\""
    }'::jsonb,
    ARRAY['Disable RDP on ESXi hosts', 'Implement application whitelisting', 'Monitor for Rust-based executables', 'Enable protected users security group'],
    ARRAY['ransomware', 'alphv', 'blackcat', 'rust'],
    'Mandiant'
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE threat_hunts IS 'Actionable threat hunt guides - not YARA rules, but practical detection steps';
