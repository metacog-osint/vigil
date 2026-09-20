-- Migration: Changelog retention and IOC logging noise
-- Drafted: September 19, 2026
--
-- entity_changelog held 2.74M rows (1.2 GB, the largest table): 95% were IOC
-- rows recording a new IOC or a moved last_seen/first_seen on each re-sighting,
-- which duplicate data already on the IOC itself.
--   1. Stop logging IOC creation and first/last-seen changes. Changes to an IOC's
--      type, confidence, tags or source are still logged.
--   2. Keep 90 days of changelog: run_data_quality_checks() trims 3,000 older rows
--      per hourly run (a 20,000-row delete took 10.5s and a full run with 5,000
--      took 5.1s; the API limit is 8s, and a timeout would also roll back trends).

-- ---------------------------------------------------------------------------
-- 1. Logging trigger function (same as before except the IOC rules)
-- ---------------------------------------------------------------------------
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
      -- first_seen/last_seen move on every re-sighting; not worth a changelog row
      tracked_fields := ARRAY['type', 'confidence', 'tags', 'source'];
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

-- ---------------------------------------------------------------------------
-- 2. Review process with changelog retention added as step (g)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_data_quality_checks() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  r record;
  canon uuid;
  auto_merged int := 0;
  decisions_applied int := 0;
  queued int := 0;
  linked int := 0;
  trends jsonb;
  n bigint;
  trimmed int := 0;
BEGIN
  -- (a) Auto-merge: names identical after normalising case/spacing/punctuation (>= 3 chars)
  FOR r IN
    SELECT actor_key(name) AS k FROM threat_actors
    GROUP BY 1 HAVING count(*) > 1 AND length(actor_key(name)) >= 3
  LOOP
    SELECT a.id INTO canon FROM threat_actors a WHERE actor_key(a.name) = r.k ORDER BY canonical_rank(a), a.created_at, a.id LIMIT 1;
    PERFORM merge_actor(a.id, canon, 'name variant (case/spacing/punctuation)')
    FROM threat_actors a WHERE actor_key(a.name) = r.k AND a.id <> canon;
    auto_merged := auto_merged + 1;
  END LOOP;

  -- (b) Apply reviewed same_entity decisions
  FOR r IN SELECT * FROM actor_relationship_decisions WHERE relation = 'same_entity' LOOP
    SELECT a.id INTO canon FROM threat_actors a WHERE actor_key(a.name) IN (r.key_a, r.key_b)
      ORDER BY canonical_rank(a), a.created_at, a.id LIMIT 1;
    IF canon IS NOT NULL AND (SELECT count(*) FROM threat_actors WHERE actor_key(name) IN (r.key_a, r.key_b)) > 1 THEN
      PERFORM merge_actor(a.id, canon, 'reviewed decision: ' || coalesce(r.rationale, 'same entity'))
      FROM threat_actors a WHERE actor_key(a.name) IN (r.key_a, r.key_b) AND a.id <> canon;
      UPDATE actor_relationship_decisions SET applied_at = now() WHERE id = r.id;
      decisions_applied := decisions_applied + 1;
    END IF;
  END LOOP;

  -- (c) Queue alias matches for review (only where a side has incidents; never auto-merged)
  FOR r IN
    SELECT DISTINCT least(actor_key(a1.name), actor_key(a2.name)) AS ka,
                    greatest(actor_key(a1.name), actor_key(a2.name)) AS kb,
                    a1.name AS n1, a2.name AS n2
    FROM threat_actors a1
    JOIN threat_actors a2 ON a1.id <> a2.id
    JOIN LATERAL unnest(a2.aliases) al ON actor_key(al) = actor_key(a1.name)
    WHERE length(actor_key(a1.name)) >= 3 AND actor_key(a1.name) <> actor_key(a2.name)
      AND (EXISTS (SELECT 1 FROM incidents i WHERE i.actor_id = a1.id)
           OR EXISTS (SELECT 1 FROM incidents i WHERE i.actor_id = a2.id))
  LOOP
    INSERT INTO actor_relationship_decisions (key_a, key_b, relation, rationale, decided_by)
    VALUES (r.ka, r.kb, 'unreviewed', 'Alias-list match: ' || r.n1 || ' / ' || r.n2, 'auto-detected')
    ON CONFLICT (key_a, key_b) DO NOTHING;
    IF FOUND THEN queued := queued + 1; END IF;
  END LOOP;
  FOR r IN SELECT * FROM actor_relationship_decisions WHERE relation = 'unreviewed' LOOP
    PERFORM record_finding('actor_alias_review', r.key_a || ' / ' || r.key_b, 'warning', 'open',
      jsonb_build_object('rationale', r.rationale));
  END LOOP;

  -- (d) Link incidents that have no actor, by the group name stored with them
  WITH links AS (
    SELECT DISTINCT ON (i.id) i.id, a.id AS actor_id
    FROM incidents i JOIN threat_actors a ON actor_key(a.name) = actor_key(i.raw_data->>'group_name')
    WHERE i.actor_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM incidents k WHERE k.actor_id = a.id AND k.victim_name = i.victim_name
                        AND k.discovered_date IS NOT DISTINCT FROM i.discovered_date)
    ORDER BY i.id, canonical_rank(a)
  )
  UPDATE incidents i SET actor_id = l.actor_id FROM links l WHERE i.id = l.id;
  GET DIAGNOSTICS linked = ROW_COUNT;

  SELECT count(*) INTO n FROM incidents WHERE actor_id IS NULL;
  PERFORM record_finding('orphaned_incidents', 'incidents without an actor',
    CASE WHEN n > 0 THEN 'warning' ELSE 'info' END, CASE WHEN n > 0 THEN 'open' ELSE 'resolved' END,
    jsonb_build_object('count', n, 'linked_this_run', linked));

  -- (e) Junk victims seen in the last day (flagged automatically; reported for visibility)
  SELECT count(*) INTO n FROM incidents WHERE data_quality = 'placeholder' AND created_at > now() - interval '1 day';
  IF n > 0 THEN
    PERFORM record_finding('placeholder_victims', to_char(current_date, 'YYYY-MM-DD'), 'info', 'auto_resolved',
      jsonb_build_object('count', n));
  END IF;

  -- (f) Recompute trends, then verify they are fresh
  trends := apply_actor_trends();

  -- (g) Changelog retention: keep 90 days, trimmed in small batches so each run
  --     stays well inside the API's 8-second statement timeout
  DELETE FROM entity_changelog WHERE id IN (
    SELECT id FROM entity_changelog WHERE created_at < now() - interval '90 days'
    ORDER BY created_at LIMIT 3000);
  GET DIAGNOSTICS trimmed = ROW_COUNT;

  RETURN jsonb_build_object('auto_merged_groups', auto_merged, 'decisions_applied', decisions_applied,
    'queued_for_review', queued, 'orphans_linked', linked, 'trends', trends,
    'changelog_rows_trimmed', trimmed,
    'open_findings', (SELECT count(*) FROM data_quality_findings WHERE status = 'open'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_data_quality_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_quality_checks() TO service_role;
