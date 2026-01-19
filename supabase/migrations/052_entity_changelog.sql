-- Migration 052: Entity Changelog System
-- Tracks meaningful changes to threat_actors, iocs, and vulnerabilities
-- Zero additional operating cost - pure PostgreSQL triggers

-- Create changelog table
CREATE TABLE IF NOT EXISTS entity_changelog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'threat_actor', 'ioc', 'vulnerability'
  entity_id UUID NOT NULL,
  entity_identifier TEXT, -- Human-readable: actor name, IOC value, CVE ID
  change_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  changed_fields JSONB NOT NULL DEFAULT '{}', -- { field: { old: x, new: y } }
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT, -- Which ingestion source triggered the change
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_changelog_entity
ON entity_changelog(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_changelog_created
ON entity_changelog(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_changelog_entity_type_created
ON entity_changelog(entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_changelog_identifier
ON entity_changelog(entity_identifier)
WHERE entity_identifier IS NOT NULL;

-- Generic function to compare and log field changes
CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  entity_ident TEXT;
  tracked_fields TEXT[];
  field_name TEXT;
  old_val JSONB;
  new_val JSONB;
BEGIN
  -- Determine tracked fields based on table
  CASE TG_TABLE_NAME
    WHEN 'threat_actors' THEN
      tracked_fields := ARRAY[
        'name', 'status', 'trend_status', 'sophistication',
        'target_sectors', 'target_countries', 'ttps', 'aliases',
        'first_seen', 'last_seen', 'description'
      ];
      entity_ident := COALESCE(NEW.name, OLD.name);

    WHEN 'iocs' THEN
      tracked_fields := ARRAY[
        'type', 'confidence', 'severity', 'threat_type',
        'first_seen', 'last_seen', 'tags', 'source'
      ];
      entity_ident := COALESCE(NEW.value, OLD.value);

    WHEN 'vulnerabilities' THEN
      tracked_fields := ARRAY[
        'severity', 'cvss_score', 'exploit_maturity', 'exploit_available',
        'is_kev', 'kev_date_added', 'ransomware_use', 'epss_score',
        'epss_percentile', 'cisa_due_date'
      ];
      entity_ident := COALESCE(NEW.cve_id, OLD.cve_id);

    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_changelog (
      entity_type, entity_id, entity_identifier, change_type,
      changed_fields, source
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      entity_ident,
      'created',
      jsonb_build_object('source', NEW.source),
      NEW.source
    );
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    INSERT INTO entity_changelog (
      entity_type, entity_id, entity_identifier, change_type,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      entity_ident,
      'deleted',
      '{}'
    );
    RETURN OLD;
  END IF;

  -- Handle UPDATE - only log if tracked fields changed
  IF TG_OP = 'UPDATE' THEN
    FOREACH field_name IN ARRAY tracked_fields
    LOOP
      BEGIN
        EXECUTE format('SELECT to_jsonb($1.%I), to_jsonb($2.%I)', field_name, field_name)
        INTO old_val, new_val
        USING OLD, NEW;

        -- Compare values, treating NULL specially
        IF old_val IS DISTINCT FROM new_val THEN
          changes := changes || jsonb_build_object(
            field_name,
            jsonb_build_object('old', old_val, 'new', new_val)
          );
        END IF;
      EXCEPTION WHEN undefined_column THEN
        -- Field doesn't exist on this table version, skip
        NULL;
      END;
    END LOOP;

    -- Only insert if there were actual changes to tracked fields
    IF changes != '{}' THEN
      INSERT INTO entity_changelog (
        entity_type, entity_id, entity_identifier, change_type,
        changed_fields, source
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        entity_ident,
        'updated',
        changes,
        NEW.source
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each entity table
-- Only create if the table exists

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'threat_actors') THEN
    DROP TRIGGER IF EXISTS trigger_changelog_threat_actors ON threat_actors;
    CREATE TRIGGER trigger_changelog_threat_actors
    AFTER INSERT OR UPDATE OR DELETE ON threat_actors
    FOR EACH ROW
    EXECUTE FUNCTION log_entity_changes();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iocs') THEN
    DROP TRIGGER IF EXISTS trigger_changelog_iocs ON iocs;
    CREATE TRIGGER trigger_changelog_iocs
    AFTER INSERT OR UPDATE OR DELETE ON iocs
    FOR EACH ROW
    EXECUTE FUNCTION log_entity_changes();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerabilities') THEN
    DROP TRIGGER IF EXISTS trigger_changelog_vulnerabilities ON vulnerabilities;
    CREATE TRIGGER trigger_changelog_vulnerabilities
    AFTER INSERT OR UPDATE OR DELETE ON vulnerabilities
    FOR EACH ROW
    EXECUTE FUNCTION log_entity_changes();
  END IF;
END $$;

-- View for recent changes (convenience query)
CREATE OR REPLACE VIEW recent_entity_changes AS
SELECT
  ec.id,
  ec.entity_type,
  ec.entity_identifier,
  ec.change_type,
  ec.changed_fields,
  ec.source,
  ec.created_at,
  CASE
    WHEN ec.entity_type = 'threat_actors' THEN 'Threat Actor'
    WHEN ec.entity_type = 'iocs' THEN 'IOC'
    WHEN ec.entity_type = 'vulnerabilities' THEN 'Vulnerability'
    ELSE ec.entity_type
  END AS entity_type_label
FROM entity_changelog ec
ORDER BY ec.created_at DESC;

-- Function to get changelog for a specific entity
CREATE OR REPLACE FUNCTION get_entity_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  change_type TEXT,
  changed_fields JSONB,
  source TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.change_type,
    ec.changed_fields,
    ec.source,
    ec.created_at
  FROM entity_changelog ec
  WHERE ec.entity_type = p_entity_type
    AND ec.entity_id = p_entity_id
  ORDER BY ec.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent changes summary (for dashboard)
CREATE OR REPLACE FUNCTION get_changes_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  entity_type TEXT,
  created_count BIGINT,
  updated_count BIGINT,
  deleted_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.entity_type,
    COUNT(*) FILTER (WHERE ec.change_type = 'created') AS created_count,
    COUNT(*) FILTER (WHERE ec.change_type = 'updated') AS updated_count,
    COUNT(*) FILTER (WHERE ec.change_type = 'deleted') AS deleted_count
  FROM entity_changelog ec
  WHERE ec.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY ec.entity_type
  ORDER BY ec.entity_type;
END;
$$ LANGUAGE plpgsql;

-- Optional: Function to purge old changelog entries (run manually if storage is concern)
CREATE OR REPLACE FUNCTION purge_old_changelog(
  p_days INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM entity_changelog
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE entity_changelog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view changelog
CREATE POLICY "Authenticated users can view changelog"
ON entity_changelog FOR SELECT
TO authenticated
USING (true);

-- Only system can insert (via triggers)
CREATE POLICY "System can insert changelog"
ON entity_changelog FOR INSERT
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE entity_changelog IS 'Tracks meaningful changes to threat_actors, iocs, and vulnerabilities. Populated automatically via triggers.';
COMMENT ON FUNCTION purge_old_changelog IS 'Manually purge changelog entries older than N days to manage storage. Default 365 days.';
