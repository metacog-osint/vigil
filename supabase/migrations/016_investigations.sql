-- Migration 016: Investigation Notebooks
-- Phase 2.1: Document and track threat investigations

-- ============================================
-- Investigations Table
-- ============================================
CREATE TABLE IF NOT EXISTS investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- Basic info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'archived')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),

    -- Classification
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(50), -- malware, ransomware, phishing, apt, insider, other

    -- Key findings summary
    summary TEXT,
    tlp VARCHAR(20) DEFAULT 'amber' CHECK (tlp IN ('red', 'amber', 'green', 'white')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,

    -- Sharing
    is_shared BOOLEAN DEFAULT false,
    shared_with TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_investigations_user ON investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_investigations_team ON investigations(team_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_created ON investigations(created_at DESC);

COMMENT ON TABLE investigations IS 'Threat investigation notebooks for documenting analysis';

-- ============================================
-- Investigation Entries (Timeline)
-- ============================================
CREATE TABLE IF NOT EXISTS investigation_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,

    -- Entry type
    entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN (
        'note',           -- Free-form markdown note
        'finding',        -- Key finding or conclusion
        'entity',         -- Linked entity (actor, IOC, CVE, etc.)
        'evidence',       -- Evidence/artifact reference
        'action',         -- Action taken
        'timeline_event'  -- Event in the incident timeline
    )),

    -- Content (structure depends on entry_type)
    content JSONB NOT NULL DEFAULT '{}',
    -- For 'note': { "text": "markdown content" }
    -- For 'finding': { "title": "...", "description": "...", "severity": "high" }
    -- For 'entity': { "entity_type": "actor|ioc|cve|incident", "entity_id": "...", "entity_name": "...", "notes": "..." }
    -- For 'evidence': { "name": "...", "url": "...", "type": "screenshot|log|pcap|document", "notes": "..." }
    -- For 'action': { "action": "...", "result": "...", "assignee": "..." }
    -- For 'timeline_event': { "timestamp": "...", "event": "...", "source": "..." }

    -- Metadata
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investigation_entries_inv ON investigation_entries(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_entries_type ON investigation_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_investigation_entries_created ON investigation_entries(created_at DESC);

COMMENT ON TABLE investigation_entries IS 'Entries within an investigation (notes, findings, linked entities)';

-- ============================================
-- Investigation Collaborators
-- ============================================
CREATE TABLE IF NOT EXISTS investigation_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by VARCHAR(255),

    UNIQUE(investigation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_collab_inv ON investigation_collaborators(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_collab_user ON investigation_collaborators(user_id);

-- ============================================
-- Investigation Templates (optional)
-- ============================================
CREATE TABLE IF NOT EXISTS investigation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),

    -- Template structure
    default_entries JSONB DEFAULT '[]',
    -- Array of entry templates to create when starting from this template

    checklist JSONB DEFAULT '[]',
    -- Array of { "item": "...", "required": true/false }

    is_system BOOLEAN DEFAULT false, -- System-provided vs user-created
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates
INSERT INTO investigation_templates (name, description, category, default_entries, checklist, is_system)
VALUES
(
    'Ransomware Incident',
    'Template for investigating ransomware attacks',
    'ransomware',
    '[
        {"entry_type": "note", "content": {"text": "## Initial Assessment\n\n- Affected systems:\n- Ransom note observed:\n- Encryption extension:\n"}},
        {"entry_type": "note", "content": {"text": "## Containment Actions\n\n- [ ] Isolated affected systems\n- [ ] Disabled compromised accounts\n- [ ] Blocked C2 domains/IPs\n"}}
    ]'::jsonb,
    '[
        {"item": "Identify the ransomware variant", "required": true},
        {"item": "Document affected systems and data", "required": true},
        {"item": "Identify initial access vector", "required": true},
        {"item": "Check for data exfiltration", "required": false},
        {"item": "Engage law enforcement if required", "required": false},
        {"item": "Document lessons learned", "required": true}
    ]'::jsonb,
    true
),
(
    'Phishing Investigation',
    'Template for investigating phishing campaigns',
    'phishing',
    '[
        {"entry_type": "note", "content": {"text": "## Email Analysis\n\n- Subject:\n- Sender:\n- Recipients:\n- Links:\n- Attachments:\n"}},
        {"entry_type": "note", "content": {"text": "## Impact Assessment\n\n- Users who clicked:\n- Credentials entered:\n- Malware downloaded:\n"}}
    ]'::jsonb,
    '[
        {"item": "Analyze email headers", "required": true},
        {"item": "Extract and analyze IOCs", "required": true},
        {"item": "Identify affected users", "required": true},
        {"item": "Check for credential compromise", "required": true},
        {"item": "Block malicious URLs/domains", "required": true}
    ]'::jsonb,
    true
),
(
    'Malware Analysis',
    'Template for malware sample analysis',
    'malware',
    '[
        {"entry_type": "note", "content": {"text": "## Sample Information\n\n- File name:\n- SHA256:\n- File type:\n- First seen:\n"}},
        {"entry_type": "note", "content": {"text": "## Static Analysis\n\n- Strings of interest:\n- Imports:\n- Packer/obfuscation:\n"}},
        {"entry_type": "note", "content": {"text": "## Dynamic Analysis\n\n- Network activity:\n- File system changes:\n- Registry changes:\n- Process behavior:\n"}}
    ]'::jsonb,
    '[
        {"item": "Calculate file hashes", "required": true},
        {"item": "Check VirusTotal for existing analysis", "required": true},
        {"item": "Perform static analysis", "required": true},
        {"item": "Execute in sandbox", "required": false},
        {"item": "Extract IOCs", "required": true},
        {"item": "Document detection signatures", "required": false}
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Trigger to update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_investigation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investigation_timestamp ON investigations;
CREATE TRIGGER investigation_timestamp
    BEFORE UPDATE ON investigations
    FOR EACH ROW
    EXECUTE FUNCTION update_investigation_timestamp();

DROP TRIGGER IF EXISTS investigation_entry_timestamp ON investigation_entries;
CREATE TRIGGER investigation_entry_timestamp
    BEFORE UPDATE ON investigation_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_investigation_timestamp();

-- ============================================
-- View for investigation summary
-- ============================================
CREATE OR REPLACE VIEW v_investigation_summary AS
SELECT
    i.id,
    i.user_id,
    i.team_id,
    i.title,
    i.description,
    i.status,
    i.priority,
    i.category,
    i.tags,
    i.tlp,
    i.created_at,
    i.updated_at,
    i.closed_at,
    COUNT(e.id) as entry_count,
    COUNT(CASE WHEN e.entry_type = 'entity' THEN 1 END) as entity_count,
    COUNT(CASE WHEN e.entry_type = 'finding' THEN 1 END) as finding_count
FROM investigations i
LEFT JOIN investigation_entries e ON e.investigation_id = i.id
GROUP BY i.id;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_collaborators ENABLE ROW LEVEL SECURITY;

-- Users can see their own investigations or ones shared with them
CREATE POLICY investigations_access ON investigations
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
        OR current_setting('app.user_id', true) = ANY(shared_with)
        OR EXISTS (
            SELECT 1 FROM investigation_collaborators
            WHERE investigation_id = investigations.id
            AND user_id = current_setting('app.user_id', true)
        )
    );

CREATE POLICY investigation_entries_access ON investigation_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM investigations
            WHERE id = investigation_entries.investigation_id
            AND (
                user_id = current_setting('app.user_id', true)
                OR current_setting('app.user_id', true) = ANY(shared_with)
            )
        )
    );
