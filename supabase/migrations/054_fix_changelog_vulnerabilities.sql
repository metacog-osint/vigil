-- Fix changelog trigger to handle vulnerabilities table correctly
-- The vulnerabilities table uses cve_id as primary key, not id

CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  entity_ident TEXT;
  entity_pk TEXT;
  tracked_fields TEXT[];
  field_name TEXT;
  old_val JSONB;
  new_val JSONB;
BEGIN
  -- Determine tracked fields and primary key based on table
  CASE TG_TABLE_NAME
    WHEN 'threat_actors' THEN
      tracked_fields := ARRAY[
        'name', 'status', 'trend_status', 'sophistication',
        'target_sectors', 'target_countries', 'ttps', 'aliases',
        'first_seen', 'last_seen', 'description'
      ];
      entity_ident := COALESCE(NEW.name, OLD.name);
      entity_pk := COALESCE(NEW.id::TEXT, OLD.id::TEXT);

    WHEN 'iocs' THEN
      tracked_fields := ARRAY[
        'type', 'confidence', 'first_seen', 'last_seen', 'tags', 'source'
      ];
      entity_ident := COALESCE(NEW.value, OLD.value);
      entity_pk := COALESCE(NEW.id::TEXT, OLD.id::TEXT);

    WHEN 'vulnerabilities' THEN
      tracked_fields := ARRAY[
        'cvss_score', 'exploited_in_wild', 'ransomware_campaign_use',
        'kev_date', 'kev_due_date', 'epss_score', 'epss_percentile'
      ];
      entity_ident := COALESCE(NEW.cve_id, OLD.cve_id);
      -- vulnerabilities uses cve_id as primary key, not id
      entity_pk := COALESCE(NEW.cve_id, OLD.cve_id);

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
      entity_pk,
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
      changed_fields, source
    ) VALUES (
      TG_TABLE_NAME,
      entity_pk,
      entity_ident,
      'deleted',
      '{}',
      OLD.source
    );
    RETURN OLD;
  END IF;

  -- Handle UPDATE - only log if tracked fields changed
  FOREACH field_name IN ARRAY tracked_fields
  LOOP
    BEGIN
      EXECUTE format('SELECT to_jsonb(($1).%I)', field_name) INTO old_val USING OLD;
      EXECUTE format('SELECT to_jsonb(($1).%I)', field_name) INTO new_val USING NEW;

      IF old_val IS DISTINCT FROM new_val THEN
        changes := changes || jsonb_build_object(
          field_name, jsonb_build_object('old', old_val, 'new', new_val)
        );
      END IF;
    EXCEPTION WHEN undefined_column THEN
      -- Field doesn't exist in this table, skip
      NULL;
    END;
  END LOOP;

  -- Only create changelog entry if something actually changed
  IF changes != '{}' THEN
    INSERT INTO entity_changelog (
      entity_type, entity_id, entity_identifier, change_type,
      changed_fields, source
    ) VALUES (
      TG_TABLE_NAME,
      entity_pk,
      entity_ident,
      'updated',
      changes,
      NEW.source
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
