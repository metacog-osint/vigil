-- Migration 040: Enhanced Investigation Notebooks
-- Adds rich text notes, activity timeline, and templates

-- Add markdown content column for rich text notes
ALTER TABLE investigations
ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
ADD COLUMN IF NOT EXISTS notes_html TEXT,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES investigation_templates(id),
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2);

-- Create investigation templates table
CREATE TABLE IF NOT EXISTS investigation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  initial_status TEXT DEFAULT 'open',
  default_priority TEXT DEFAULT 'medium',
  notes_template TEXT, -- Markdown template for notes
  checklist JSONB DEFAULT '[]', -- Predefined checklist items
  entity_types TEXT[] DEFAULT '{}', -- Which entity types to include by default
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false, -- Shared with team
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create investigation activity log
CREATE TABLE IF NOT EXISTS investigation_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL, -- created, updated, status_change, entity_added, entity_removed, note_added, comment
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create investigation comments
CREATE TABLE IF NOT EXISTS investigation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES investigation_comments(id) ON DELETE CASCADE, -- For threaded comments
  content TEXT NOT NULL,
  content_html TEXT,
  mentions UUID[] DEFAULT '{}', -- User IDs mentioned
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create investigation checklist items
CREATE TABLE IF NOT EXISTS investigation_checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_investigation_activities_investigation
ON investigation_activities(investigation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investigation_comments_investigation
ON investigation_comments(investigation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_investigation_templates_user
ON investigation_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_investigation_templates_team
ON investigation_templates(team_id)
WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investigations_assigned
ON investigations(assigned_to)
WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investigations_due_date
ON investigations(due_date)
WHERE due_date IS NOT NULL AND status != 'closed';

-- Function to log investigation activity
CREATE OR REPLACE FUNCTION log_investigation_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO investigation_activities (
      investigation_id, user_id, activity_type, description,
      old_value, new_value
    ) VALUES (
      NEW.id,
      NEW.updated_by,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  -- Log priority changes
  IF TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO investigation_activities (
      investigation_id, user_id, activity_type, description,
      old_value, new_value
    ) VALUES (
      NEW.id,
      NEW.updated_by,
      'priority_change',
      'Priority changed from ' || COALESCE(OLD.priority, 'none') || ' to ' || NEW.priority,
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority)
    );
  END IF;

  -- Log assignment changes
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO investigation_activities (
      investigation_id, user_id, activity_type, description,
      old_value, new_value
    ) VALUES (
      NEW.id,
      NEW.updated_by,
      'assignment_change',
      'Investigation reassigned',
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to)
    );
  END IF;

  -- Log creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO investigation_activities (
      investigation_id, user_id, activity_type, description
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'created',
      'Investigation created: ' || NEW.title
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS trigger_investigation_activity ON investigations;
CREATE TRIGGER trigger_investigation_activity
AFTER INSERT OR UPDATE ON investigations
FOR EACH ROW
EXECUTE FUNCTION log_investigation_activity();

-- Function to log entity attachment
CREATE OR REPLACE FUNCTION log_investigation_entity_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO investigation_activities (
      investigation_id, activity_type, description,
      new_value
    ) VALUES (
      NEW.investigation_id,
      'entity_added',
      'Added ' || NEW.entity_type || ' entity',
      jsonb_build_object('entity_type', NEW.entity_type, 'entity_id', NEW.entity_id)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO investigation_activities (
      investigation_id, activity_type, description,
      old_value
    ) VALUES (
      OLD.investigation_id,
      'entity_removed',
      'Removed ' || OLD.entity_type || ' entity',
      jsonb_build_object('entity_type', OLD.entity_type, 'entity_id', OLD.entity_id)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for entity activity
DROP TRIGGER IF EXISTS trigger_investigation_entity_activity ON investigation_entities;
CREATE TRIGGER trigger_investigation_entity_activity
AFTER INSERT OR DELETE ON investigation_entities
FOR EACH ROW
EXECUTE FUNCTION log_investigation_entity_activity();

-- Insert default templates
INSERT INTO investigation_templates (user_id, name, description, category, notes_template, checklist, is_public)
SELECT
  (SELECT id FROM auth.users LIMIT 1),
  name,
  description,
  category,
  notes_template,
  checklist,
  true
FROM (VALUES
  (
    'Ransomware Incident',
    'Template for investigating ransomware incidents',
    'incident_response',
    E'## Incident Overview\n\n- **Victim:**\n- **Threat Actor:**\n- **First Seen:**\n- **Current Status:**\n\n## Timeline\n\n| Date | Event |\n|------|-------|\n| | |\n\n## IOCs Identified\n\n### Hashes\n\n### IPs/Domains\n\n### URLs\n\n## Recommendations\n\n',
    '[{"content": "Identify affected systems", "completed": false}, {"content": "Collect IOCs", "completed": false}, {"content": "Check for data exfiltration", "completed": false}, {"content": "Identify initial access vector", "completed": false}, {"content": "Document timeline", "completed": false}, {"content": "Prepare stakeholder report", "completed": false}]'::JSONB
  ),
  (
    'Threat Actor Profile',
    'Template for profiling threat actors',
    'threat_intel',
    E'## Actor Overview\n\n- **Name:**\n- **Aliases:**\n- **Active Since:**\n- **Motivation:**\n\n## TTPs\n\n### Initial Access\n\n### Execution\n\n### Persistence\n\n### Command & Control\n\n## Target Profile\n\n- **Sectors:**\n- **Regions:**\n- **Victim Types:**\n\n## Infrastructure\n\n## Related IOCs\n\n',
    '[{"content": "Research actor history", "completed": false}, {"content": "Map TTPs to MITRE ATT&CK", "completed": false}, {"content": "Identify infrastructure patterns", "completed": false}, {"content": "Collect IOCs", "completed": false}, {"content": "Document victimology", "completed": false}]'::JSONB
  ),
  (
    'Vulnerability Analysis',
    'Template for analyzing critical vulnerabilities',
    'vuln_analysis',
    E'## Vulnerability Details\n\n- **CVE:**\n- **CVSS:**\n- **Affected Products:**\n\n## Exposure Assessment\n\n- **Internal Systems Affected:**\n- **Internet-Facing:**\n- **Exploitation Status:**\n\n## Mitigation\n\n### Immediate Actions\n\n### Long-term Remediation\n\n## References\n\n',
    '[{"content": "Verify affected systems", "completed": false}, {"content": "Check for exploit availability", "completed": false}, {"content": "Assess exposure", "completed": false}, {"content": "Identify mitigation options", "completed": false}, {"content": "Create patching plan", "completed": false}, {"content": "Validate remediation", "completed": false}]'::JSONB
  )
) AS t(name, description, category, notes_template, checklist)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE investigation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_checklist ENABLE ROW LEVEL SECURITY;

-- Templates: users can see their own and public team templates
CREATE POLICY "Users can view own templates"
ON investigation_templates FOR SELECT
USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can manage own templates"
ON investigation_templates FOR ALL
USING (user_id = auth.uid());

-- Activities: users can see activities for their investigations
CREATE POLICY "Users can view investigation activities"
ON investigation_activities FOR SELECT
USING (
  investigation_id IN (
    SELECT id FROM investigations WHERE user_id = auth.uid()
  )
);

-- Comments: users can see and create comments on their investigations
CREATE POLICY "Users can view investigation comments"
ON investigation_comments FOR SELECT
USING (
  investigation_id IN (
    SELECT id FROM investigations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create comments"
ON investigation_comments FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can edit own comments"
ON investigation_comments FOR UPDATE
USING (user_id = auth.uid());

-- Checklist: same as investigation access
CREATE POLICY "Users can manage checklist"
ON investigation_checklist FOR ALL
USING (
  investigation_id IN (
    SELECT id FROM investigations WHERE user_id = auth.uid()
  )
);
