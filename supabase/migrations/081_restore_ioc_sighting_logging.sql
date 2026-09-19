-- Migration: Restore IOC sighting history in the changelog
-- Applied: September 19, 2026
--
-- 078 stopped logging IOC first_seen/last_seen changes as "noise". They are
-- sightings: the IOC row keeps only the first and last, so gaps and reactivations
-- (infrastructure pattern-of-life) exist only in the changelog. This restores the
-- 078 function with first_seen/last_seen tracked for IOCs again. IOC creation stays
-- unlogged (iocs.created_at already records it).
--
-- trim_entity_changelog() (080) remains defined but is not scheduled: the worker no
-- longer calls it. Only ~6,000 of the oldest rows (17 Jan 2026) were trimmed, in tests.

CREATE OR REPLACE FUNCTION public.log_entity_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  changes JSONB := '{}';
  entity_ident TEXT;
  tracked_fields TEXT[];
  field_name TEXT;
  old_val JSONB;
  new_val JSONB;
BEGIN
  -- Skip vulnerabilities for now (uses TEXT primary key, not UUID)
  IF TG_TABLE_NAME = 'vulnerabilities' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- IOC creation is already recorded on the IOC itself (created_at)
  IF TG_TABLE_NAME = 'iocs' AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

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
      -- first_seen/last_seen changes record sightings over time
      tracked_fields := ARRAY['type', 'confidence', 'first_seen', 'last_seen', 'tags', 'source'];
      entity_ident := COALESCE(NEW.value, OLD.value);

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
      changed_fields, source
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
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
      NULL;
    END;
  END LOOP;

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
END;
$function$;
