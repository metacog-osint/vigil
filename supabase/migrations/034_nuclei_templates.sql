-- Nuclei Template Integration
-- Adds fields to track which vulnerabilities have detection templates

-- Add nuclei template fields to vulnerabilities
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS has_nuclei_template BOOLEAN DEFAULT false;
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS nuclei_templates JSONB DEFAULT '[]';

-- Index for filtering vulnerabilities with templates
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_nuclei ON vulnerabilities(has_nuclei_template) WHERE has_nuclei_template = true;

-- Comment
COMMENT ON COLUMN vulnerabilities.has_nuclei_template IS 'Whether vulnerability has Nuclei detection template';
COMMENT ON COLUMN vulnerabilities.nuclei_templates IS 'Array of {template_id, name, severity} objects';
