-- Migration: repair merge_actor after the storage reclaim, and stop it losing profiles
-- Drafted: September 20, 2026
--
-- Two faults in merge_actor, both found by dry-running the LockBit merge rather than
-- in production.
--
-- 1. It archived displaced duplicate incidents into
--    archive.incidents_duplicates_20260919, which migration 093 released. The next
--    merge would have failed - including the hourly data-quality job, which merges
--    reviewed decisions. The undo log is now a standing table whose name does not
--    expire.
--
-- 2. It folded techniques and vulnerabilities into the canonical actor but predates
--    actor_tools and actor_sites (migration 087), so every merge silently cascade-
--    deleted the dup's tooling and leak-site addresses. This had already cost 4 sites
--    and 5 tools in the merges applied earlier today; re-running the profile feed
--    restored them.
--
-- Also: jsonb_populate_record writes an explicit NULL for any column missing from the
-- json, which overrides a column default, so superseded_at is supplied explicitly.

CREATE TABLE IF NOT EXISTS archive.incidents_superseded (
  LIKE public.incidents INCLUDING DEFAULTS,
  keep_id uuid,
  superseded_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.merge_actor(p_dup uuid, p_canonical uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  d threat_actors%ROWTYPE;
  moved int := 0; archived int := 0;
BEGIN
  IF p_dup = p_canonical THEN RETURN jsonb_build_object('skipped', 'same id'); END IF;
  SELECT * INTO d FROM threat_actors WHERE id = p_dup;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM threat_actors WHERE id = p_canonical) THEN
    RETURN jsonb_build_object('skipped', 'missing actor');
  END IF;

  UPDATE threat_actors c SET
    aliases = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.aliases, '{}') || ARRAY[d.name] || coalesce(d.aliases, '{}')) x
               WHERE x IS NOT NULL AND x <> c.name),
    ttps = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.ttps, '{}') || coalesce(d.ttps, '{}')) x WHERE x IS NOT NULL),
    target_sectors = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.target_sectors, '{}') || coalesce(d.target_sectors, '{}')) x WHERE x IS NOT NULL),
    target_countries = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.target_countries, '{}') || coalesce(d.target_countries, '{}')) x WHERE x IS NOT NULL),
    first_seen = LEAST(c.first_seen, d.first_seen),
    last_seen = GREATEST(c.last_seen, d.last_seen),
    description = coalesce(c.description, d.description),
    actor_type = CASE WHEN d.actor_type = 'ransomware' THEN 'ransomware' ELSE c.actor_type END
  WHERE c.id = p_canonical;

  WITH gone AS (
    DELETE FROM incidents i
    WHERE i.actor_id = p_dup AND EXISTS (
      SELECT 1 FROM incidents k WHERE k.actor_id = p_canonical
        AND k.victim_name = i.victim_name AND k.discovered_date IS NOT DISTINCT FROM i.discovered_date)
    RETURNING i.*
  )
  INSERT INTO archive.incidents_superseded
  SELECT (jsonb_populate_record(NULL::archive.incidents_superseded,
            to_jsonb(g) || jsonb_build_object('keep_id', p_canonical, 'superseded_at', now()))).*
  FROM gone g;
  GET DIAGNOSTICS archived = ROW_COUNT;

  UPDATE incidents SET actor_id = p_canonical WHERE actor_id = p_dup;
  GET DIAGNOSTICS moved = ROW_COUNT;

  INSERT INTO actor_techniques (actor_id, technique_id)
  SELECT p_canonical, technique_id FROM actor_techniques WHERE actor_id = p_dup ON CONFLICT DO NOTHING;
  INSERT INTO actor_vulnerabilities (actor_id, cve_id, confidence, source, first_seen)
  SELECT p_canonical, cve_id, confidence, source, first_seen FROM actor_vulnerabilities WHERE actor_id = p_dup
  ON CONFLICT DO NOTHING;

  -- Group profile rows (migration 087), or the dup's tooling and leak sites are
  -- cascade-deleted along with it.
  INSERT INTO actor_tools (actor_id, tool_name, category, source, first_seen, last_seen)
  SELECT p_canonical, tool_name, category, source, first_seen, last_seen
  FROM actor_tools WHERE actor_id = p_dup ON CONFLICT DO NOTHING;
  INSERT INTO actor_sites (actor_id, fqdn, enabled, available, source, first_seen, last_seen)
  SELECT p_canonical, fqdn, enabled, available, source, first_seen, last_seen
  FROM actor_sites WHERE actor_id = p_dup ON CONFLICT DO NOTHING;

  INSERT INTO archive.threat_actors_merged_20260919
  SELECT (jsonb_populate_record(NULL::archive.threat_actors_merged_20260919,
            to_jsonb(d) || jsonb_build_object('canonical_id', p_canonical))).*;
  DELETE FROM threat_actors WHERE id = p_dup;

  PERFORM record_finding('actor_merged', d.name || ' -> ' || (SELECT name FROM threat_actors WHERE id = p_canonical),
    'info', 'auto_resolved', jsonb_build_object('reason', p_reason, 'incidents_moved', moved, 'duplicates_archived', archived));
  RETURN jsonb_build_object('merged', d.name, 'moved', moved, 'archived', archived);
END;
$$;
