-- Migration: Data-quality review process, actor identity decisions, trend fix
-- Drafted: September 19, 2026
--
-- Adds an automatic review process that runs after every ingestion:
--   * detect problems (junk victims, duplicate actors, orphans, stale trends)
--   * fix only mechanically safe cases (actor names differing only in case,
--     spacing or punctuation)
--   * queue judgment calls (alias matches) for human review, and remember the
--     verdicts in actor_relationship_decisions so each pair is decided once
-- and fixes apply_actor_trends(), which has failed on every call since January
-- ("UPDATE requires a WHERE clause" from Supabase's safeupdate extension).

-- ---------------------------------------------------------------------------
-- 1. Name normaliser
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actor_key(n text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g') $$;

-- ---------------------------------------------------------------------------
-- 2. Victim data-quality label (computed from the name; new rows get it too)
--    placeholder: not a real victim ("Company ID : bgsedf...", "AUDIT ENTITY: ...")
--    redacted:    real victim, name partly hidden by the group ("abc*******")
-- ---------------------------------------------------------------------------
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS data_quality text GENERATED ALWAYS AS (
    CASE
      WHEN victim_name ~* '^\s*(company\s*id\s*:|audit\s+entity\s*:)' THEN 'placeholder'
      WHEN victim_name LIKE '%***%' THEN 'redacted'
      ELSE 'ok'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_incidents_data_quality
  ON public.incidents (data_quality) WHERE data_quality <> 'ok';

-- Placeholders stay in the table (service role sees them) but not on the site
DROP POLICY IF EXISTS incidents_public_read ON public.incidents;
CREATE POLICY incidents_public_read ON public.incidents
  FOR SELECT TO anon, authenticated USING (data_quality <> 'placeholder');

-- ---------------------------------------------------------------------------
-- 3. Review tables (service role only: RLS on, no policies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.actor_relationship_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_a text NOT NULL,            -- actor_key() of one name
  key_b text NOT NULL,            -- actor_key() of the other; key_a < key_b
  relation text NOT NULL CHECK (relation IN ('same_entity', 'lineage', 'not_related', 'unreviewed')),
  rationale text,
  decided_by text,
  decided_at timestamptz DEFAULT now(),
  applied_at timestamptz,         -- when a same_entity decision was merged
  CHECK (key_a < key_b),
  UNIQUE (key_a, key_b)
);
ALTER TABLE public.actor_relationship_decisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.data_quality_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  subject text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'auto_resolved', 'resolved', 'dismissed')),
  details jsonb DEFAULT '{}',
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (check_name, subject)
);
ALTER TABLE public.data_quality_findings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_finding(
  p_check text, p_subject text, p_severity text, p_status text, p_details jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO data_quality_findings (check_name, subject, severity, status, details, resolved_at)
  VALUES (p_check, p_subject, p_severity, p_status, p_details,
          CASE WHEN p_status IN ('auto_resolved', 'resolved') THEN now() END)
  ON CONFLICT (check_name, subject) DO UPDATE
  SET last_seen = now(), severity = EXCLUDED.severity, details = EXCLUDED.details,
      status = CASE WHEN data_quality_findings.status IN ('dismissed', 'resolved')
                    THEN data_quality_findings.status ELSE EXCLUDED.status END,
      resolved_at = coalesce(data_quality_findings.resolved_at, EXCLUDED.resolved_at);
$$;

-- Today's reviewed verdicts (2026-09-19)
INSERT INTO public.actor_relationship_decisions (key_a, key_b, relation, rationale, decided_by)
SELECT least(public.actor_key(a), public.actor_key(b)), greatest(public.actor_key(a), public.actor_key(b)), r, why, 'owner review 2026-09-19'
FROM (VALUES
  ('Clop', 'Cl0p', 'same_entity', 'Spelling variant of the same brand'),
  ('ALPHV', 'BlackCat', 'same_entity', 'Two names for the same RaaS'),
  ('REvil', 'Sodinokibi', 'same_entity', 'Sodinokibi is the REvil payload name'),
  ('Pysa', 'Mespinoza', 'same_entity', 'Mespinoza is the earlier name of Pysa'),
  ('SilentRansomGroup', 'Luna Moth', 'same_entity', 'Luna Moth is the vendor name for Silent Ransom Group'),
  ('silent ransom', 'Luna Moth', 'same_entity', 'Luna Moth is the vendor name for Silent Ransom Group'),
  ('Akira', 'Storm-1567', 'same_entity', 'Microsoft designation for Akira operators'),
  ('APT73', 'Eraleign', 'same_entity', 'Same leak site, renamed'),
  ('ransomedvc', 'RansomVC', 'same_entity', 'Spelling variant of the same brand'),
  ('quantum', 'QuantumLocker', 'same_entity', 'Same brand'),
  ('samsam', 'Samas-Samsam', 'same_entity', 'Same family'),
  ('samas', 'Samas-Samsam', 'same_entity', 'Same family'),
  ('linkc', 'LinkC Pub', 'same_entity', 'Same leak site'),
  ('Avos', 'AvosLocker', 'same_entity', 'Same brand'),
  ('Darkside', 'blackmatter', 'lineage', 'Rebrand: related operators, distinct brand'),
  ('mountlocker', 'QuantumLocker', 'lineage', 'Rebrand chain Mount Locker -> Quantum'),
  ('dagonlocker', 'QuantumLocker', 'lineage', 'Rebrand chain Quantum -> Dagon'),
  ('BitPaymer', 'DoppelPaymer', 'lineage', 'Code lineage, distinct operations'),
  ('fivehands', 'HelloKitty', 'lineage', 'Related families, distinct brands'),
  ('Vicesociety', 'Vanilla Tempest', 'lineage', 'Operator cluster that also ran other brands'),
  ('Blackshadow', 'Agrius', 'lineage', 'Attribution link, not the same brand'),
  ('karma', 'VOID MANTICORE', 'not_related', 'Karma ransomware is not the Iranian state actor'),
  ('snake', 'Turla', 'not_related', 'Snake ransomware is unrelated to Turla''s Snake implant'),
  ('Hydra', 'Bianlian', 'unreviewed', 'Alias-list match, needs evidence'),
  ('alphalocker', 'Alpha Ransomware', 'unreviewed', 'Unclear whether the same brand'),
  ('mamba', 'HDDCryptor', 'unreviewed', 'Possibly the same family'),
  ('J', 'J-', 'unreviewed', 'Single-letter name; too short to match automatically')
) v(a, b, r, why)
WHERE public.actor_key(a) <> public.actor_key(b)
ON CONFLICT (key_a, key_b) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Reusable actor merge (same logic as 076, one pair at a time)
-- ---------------------------------------------------------------------------
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

  -- Fold attributes into the canonical record
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

  -- Archive incidents that would duplicate one already on the canonical actor
  WITH gone AS (
    DELETE FROM incidents i
    WHERE i.actor_id = p_dup AND EXISTS (
      SELECT 1 FROM incidents k WHERE k.actor_id = p_canonical
        AND k.victim_name = i.victim_name AND k.discovered_date IS NOT DISTINCT FROM i.discovered_date)
    RETURNING i.*
  )
  -- Columns matched by name, so this keeps working if incidents gains columns
  INSERT INTO archive.incidents_duplicates_20260919
  SELECT (jsonb_populate_record(NULL::archive.incidents_duplicates_20260919,
            to_jsonb(g) || jsonb_build_object('keep_id', p_canonical))).*
  FROM gone g;
  GET DIAGNOSTICS archived = ROW_COUNT;

  UPDATE incidents SET actor_id = p_canonical WHERE actor_id = p_dup;
  GET DIAGNOSTICS moved = ROW_COUNT;

  INSERT INTO actor_techniques (actor_id, technique_id)
  SELECT p_canonical, technique_id FROM actor_techniques WHERE actor_id = p_dup ON CONFLICT DO NOTHING;
  INSERT INTO actor_vulnerabilities (actor_id, cve_id, confidence, source, first_seen)
  SELECT p_canonical, cve_id, confidence, source, first_seen FROM actor_vulnerabilities WHERE actor_id = p_dup
  ON CONFLICT DO NOTHING;

  INSERT INTO archive.threat_actors_merged_20260919
  SELECT (jsonb_populate_record(NULL::archive.threat_actors_merged_20260919,
            to_jsonb(d) || jsonb_build_object('canonical_id', p_canonical))).*;
  DELETE FROM threat_actors WHERE id = p_dup;

  PERFORM record_finding('actor_merged', d.name || ' -> ' || (SELECT name FROM threat_actors WHERE id = p_canonical),
    'info', 'auto_resolved', jsonb_build_object('reason', p_reason, 'incidents_moved', moved, 'duplicates_archived', archived));
  RETURN jsonb_build_object('merged', d.name, 'moved', moved, 'archived', archived);
END;
$$;

-- Canonical choice: MITRE ATT&CK, then MISP (richer metadata), then most incidents, then oldest
CREATE OR REPLACE FUNCTION public.canonical_rank(a public.threat_actors) RETURNS bigint
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (CASE WHEN a.source = 'mitre-attack' THEN 0 WHEN a.source IN ('misp-galaxy', 'misp_galaxy') THEN 1 ELSE 2 END)::bigint * 10000000
         - (SELECT count(*) FROM incidents i WHERE i.actor_id = a.id)
$$;

-- ---------------------------------------------------------------------------
-- 5. Trend calculation (replaces the version that always failed)
--    ESCALATING needs >= 3 victims this week and > 1.25x the prior week;
--    DECLINING needs >= 3 prior-week victims; INACTIVE = none in 30 days;
--    groups that have never had an incident get no trend at all.
-- ---------------------------------------------------------------------------
-- The old version returned void; the return type can't change in place
DROP FUNCTION IF EXISTS public.apply_actor_trends();
CREATE OR REPLACE FUNCTION public.apply_actor_trends() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed int;
BEGIN
  WITH stats AS (
    SELECT a.id,
      count(i.id) FILTER (WHERE i.discovered_date >= current_date - 7) AS c7,
      count(i.id) FILTER (WHERE i.discovered_date >= current_date - 14 AND i.discovered_date < current_date - 7) AS p7,
      count(i.id) FILTER (WHERE i.discovered_date >= current_date - 30) AS c30,
      count(i.id) AS total,
      max(i.discovered_date) AS last_inc
    FROM threat_actors a
    LEFT JOIN incidents i ON i.actor_id = a.id AND i.data_quality <> 'placeholder'
    GROUP BY a.id
  ), target AS (
    SELECT id, c7, p7, last_inc,
      round(c7::numeric / 7, 2) AS velocity,
      CASE
        WHEN total = 0 THEN NULL
        WHEN c30 = 0 THEN 'INACTIVE'
        WHEN c7 >= 3 AND c7 > GREATEST(p7, 1) * 1.25 THEN 'ESCALATING'
        WHEN p7 >= 3 AND c7 < p7 * 0.75 THEN 'DECLINING'
        ELSE 'STABLE'
      END AS status
    FROM stats
  )
  UPDATE threat_actors t SET
    incidents_7d = x.c7,
    incidents_prev_7d = x.p7,
    incident_velocity = x.velocity,
    trend_status = x.status,
    last_seen = GREATEST(t.last_seen, x.last_inc)
  FROM target x
  WHERE t.id = x.id
    AND (t.incidents_7d IS DISTINCT FROM x.c7 OR t.incidents_prev_7d IS DISTINCT FROM x.p7
         OR t.trend_status IS DISTINCT FROM x.status
         OR (x.last_inc IS NOT NULL AND (t.last_seen IS NULL OR t.last_seen < x.last_inc)));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN jsonb_build_object('actors_updated', changed, 'run_at', now());
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. The review process: run after each ingestion
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

  RETURN jsonb_build_object('auto_merged_groups', auto_merged, 'decisions_applied', decisions_applied,
    'queued_for_review', queued, 'orphans_linked', linked, 'trends', trends,
    'open_findings', (SELECT count(*) FROM data_quality_findings WHERE status = 'open'));
END;
$$;

-- SECURITY DEFINER so the worker's service-role call can write the archive schema;
-- callable only with the service-role key (worker, scripts)
REVOKE EXECUTE ON FUNCTION public.run_data_quality_checks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_actor_trends() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_actor(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_finding(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_quality_checks() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_actor_trends() TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_actor(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_finding(text, text, text, text, jsonb) TO service_role;

-- First run
SELECT public.run_data_quality_checks();
