-- Migration: Hourly check proposes family->group candidates and refreshes links
-- Drafted: September 19, 2026
--
-- Adds two steps to run_data_quality_checks: propose malware-family -> group
-- candidates for review (never auto-linked, same rule as actor aliases), and refresh
-- the materialised ioc_actor_links table. Otherwise identical to 080.

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
  family_candidates int := 0;
  links_result jsonb;
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

  -- (g) Propose new malware-family -> group candidates (reviewed, never auto-linked)
  FOR r IN
    SELECT DISTINCT f.malware_family, actor_key(f.malware_family) AS fk, a.id AS actor_id, a.name
    FROM (SELECT DISTINCT malware_family FROM iocs WHERE malware_family IS NOT NULL AND malware_family <> '') f
    JOIN threat_actors a ON actor_key(a.name) = actor_key(f.malware_family)
    WHERE EXISTS (SELECT 1 FROM incidents i WHERE i.actor_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM malware_family_actor_map m
                      WHERE m.family_key = actor_key(f.malware_family) AND m.actor_id = a.id)
  LOOP
    INSERT INTO malware_family_actor_map (family_key, actor_id, family_label, relation, confidence, rationale, decided_by)
    VALUES (r.fk, r.actor_id, r.malware_family, 'unreviewed', 'low',
            'Name match with a group that has victims; needs a decision', 'auto-detected')
    ON CONFLICT DO NOTHING;
    family_candidates := family_candidates + 1;
  END LOOP;
  FOR r IN SELECT family_label, (SELECT name FROM threat_actors WHERE id = actor_id) grp
           FROM malware_family_actor_map WHERE relation = 'unreviewed' LOOP
    PERFORM record_finding('family_actor_review', r.family_label || ' / ' || coalesce(r.grp, '?'), 'warning', 'open',
      jsonb_build_object('family', r.family_label, 'group', r.grp));
  END LOOP;

  -- (h) Refresh the materialised indicator -> group links
  links_result := refresh_ioc_actor_links();

  -- (i) Recompute trends
  trends := apply_actor_trends();

  RETURN jsonb_build_object('auto_merged_groups', auto_merged, 'decisions_applied', decisions_applied,
    'queued_for_review', queued, 'orphans_linked', linked, 'trends', trends,
    'family_candidates_queued', family_candidates, 'links', links_result,
    'open_findings', (SELECT count(*) FROM data_quality_findings WHERE status = 'open'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_data_quality_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_quality_checks() TO service_role;
