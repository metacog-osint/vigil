-- Migration: Merge case-variant duplicate threat actors; link orphaned incidents
-- Drafted: September 19, 2026
--
-- Why: the same group was stored once per source spelling, e.g. 'akira' (ransomlook)
-- and 'Akira' (MITRE ATT&CK), or 'ransomhouse' / 'RansomHouse' / 'Ransomhouse'.
-- Live DB: 4,806 actors, 4,583 distinct names, 220 names duplicated (223 extra rows).
-- A group's victims and its ATT&CK techniques landed on different records, and the
-- worker could not pick one, so 6,548 ransomlook incidents (719 in the last 30 days)
-- have no actor at all.
--
-- What it does:
--   1. Picks one canonical actor per lower(trim(name)): MITRE ATT&CK first, then MISP
--      Galaxy (richer metadata), then the record with the most incidents, then oldest.
--   2. Folds the other records into it: names become aliases; ttps, sectors,
--      countries and aliases are unioned; first/last seen widened; description kept.
--   3. Re-points incidents, techniques and vulnerabilities to the canonical actor.
--      Incidents that would collide with uq_incidents_actor_victim_date are true
--      duplicates and are archived, as in 075.
--   4. Archives merged-away actor rows in archive.threat_actors_merged_20260919.
--   5. Links orphaned incidents by their stored raw_data->>'group_name'.
-- actor_trend_history rows for merged-away actors cascade away; trends are recomputed.

SET statement_timeout = '15min';

-- Run as a single DO block: an earlier multi-statement version of this script
-- failed once through the Supabase SQL connector while this form passed a full
-- dry run (2026-09-19): actors 4,806 -> 4,583, orphaned incidents 6,548 -> 0,
-- 4,753 cross-spelling duplicate incidents archived.
DO $m$
BEGIN
  -- 1. Canonical actor per lower(trim(name))
  CREATE TEMP TABLE actor_map ON COMMIT DROP AS
  WITH ranked AS (
    SELECT a.id, lower(trim(a.name)) AS key,
           row_number() OVER (PARTITION BY lower(trim(a.name))
             ORDER BY CASE WHEN a.source = 'mitre-attack' THEN 1
                           WHEN a.source IN ('misp-galaxy', 'misp_galaxy') THEN 2
                           ELSE 3 END,
                      (SELECT count(*) FROM public.incidents i WHERE i.actor_id = a.id) DESC,
                      a.created_at, a.id) AS rn
    FROM public.threat_actors a
    WHERE lower(trim(a.name)) IN (
      SELECT lower(trim(name)) FROM public.threat_actors GROUP BY 1 HAVING count(*) > 1)
  )
  SELECT d.id AS dup_id, c.id AS canonical_id
  FROM ranked d JOIN ranked c ON c.key = d.key AND c.rn = 1
  WHERE d.rn > 1;

  -- 2. Fold duplicate attributes into the canonical record
  UPDATE public.threat_actors c
  SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.aliases, '{}') || m.names || m.aliases) x
                 WHERE x IS NOT NULL AND x <> c.name),
      ttps = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.ttps, '{}') || m.ttps) x WHERE x IS NOT NULL),
      target_sectors = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.target_sectors, '{}') || m.sectors) x WHERE x IS NOT NULL),
      target_countries = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.target_countries, '{}') || m.countries) x WHERE x IS NOT NULL),
      first_seen = LEAST(c.first_seen, m.first_seen),
      last_seen = GREATEST(c.last_seen, m.last_seen),
      description = coalesce(c.description, m.description),
      updated_at = now()
  FROM (
    SELECT am.canonical_id, array_agg(d.name) AS names,
           coalesce(array_agg(al) FILTER (WHERE al IS NOT NULL), '{}') AS aliases,
           coalesce(array_agg(t) FILTER (WHERE t IS NOT NULL), '{}') AS ttps,
           coalesce(array_agg(s) FILTER (WHERE s IS NOT NULL), '{}') AS sectors,
           coalesce(array_agg(co) FILTER (WHERE co IS NOT NULL), '{}') AS countries,
           min(d.first_seen) AS first_seen, max(d.last_seen) AS last_seen,
           (array_agg(d.description) FILTER (WHERE d.description IS NOT NULL))[1] AS description
    FROM actor_map am
    JOIN public.threat_actors d ON d.id = am.dup_id
    LEFT JOIN LATERAL unnest(d.aliases) al ON true
    LEFT JOIN LATERAL unnest(d.ttps) t ON true
    LEFT JOIN LATERAL unnest(d.target_sectors) s ON true
    LEFT JOIN LATERAL unnest(d.target_countries) co ON true
    GROUP BY am.canonical_id
  ) m
  WHERE c.id = m.canonical_id;

  -- 3. Re-point incidents; archive ones that duplicate an incident on the canonical actor
  CREATE TEMP TABLE incident_moves ON COMMIT DROP AS
  SELECT i.id, am.canonical_id,
         EXISTS (SELECT 1 FROM public.incidents k
                 WHERE k.actor_id = am.canonical_id AND k.victim_name = i.victim_name
                   AND k.discovered_date IS NOT DISTINCT FROM i.discovered_date) AS collides
  FROM public.incidents i JOIN actor_map am ON am.dup_id = i.actor_id;

  INSERT INTO archive.incidents_duplicates_20260919
  SELECT i.*, NULL::uuid FROM public.incidents i JOIN incident_moves mv ON mv.id = i.id WHERE mv.collides;
  DELETE FROM public.incidents i USING incident_moves mv WHERE i.id = mv.id AND mv.collides;

  -- Two duplicates of one actor may hold the same victim/date: keep one
  DELETE FROM public.incidents i USING (
    SELECT id FROM (
      SELECT mv.id, row_number() OVER (
               PARTITION BY mv.canonical_id, x.victim_name, x.discovered_date ORDER BY x.created_at, x.id) rn
      FROM incident_moves mv JOIN public.incidents x ON x.id = mv.id WHERE NOT mv.collides
    ) r WHERE rn > 1
  ) extra
  WHERE i.id = extra.id;

  UPDATE public.incidents i SET actor_id = mv.canonical_id
  FROM incident_moves mv WHERE i.id = mv.id AND NOT mv.collides;

  INSERT INTO public.actor_techniques (actor_id, technique_id)
  SELECT am.canonical_id, t.technique_id FROM public.actor_techniques t
  JOIN actor_map am ON am.dup_id = t.actor_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.actor_vulnerabilities (actor_id, cve_id, confidence, source, first_seen)
  SELECT am.canonical_id, v.cve_id, v.confidence, v.source, v.first_seen FROM public.actor_vulnerabilities v
  JOIN actor_map am ON am.dup_id = v.actor_id
  ON CONFLICT DO NOTHING;

  -- 4. Archive and remove merged-away actors (dependent rows cascade)
  CREATE TABLE IF NOT EXISTS archive.threat_actors_merged_20260919 AS
  SELECT a.*, NULL::uuid AS canonical_id FROM public.threat_actors a WITH NO DATA;
  INSERT INTO archive.threat_actors_merged_20260919
  SELECT a.*, am.canonical_id FROM public.threat_actors a JOIN actor_map am ON am.dup_id = a.id;
  DELETE FROM public.threat_actors a USING actor_map am WHERE a.id = am.dup_id;

  -- 5. Link orphaned incidents by stored group name; archive any that would duplicate
  CREATE TEMP TABLE orphan_links ON COMMIT DROP AS
  SELECT i.id, a.id AS actor_id,
         row_number() OVER (PARTITION BY a.id, i.victim_name, i.discovered_date ORDER BY i.created_at, i.id) AS rn,
         EXISTS (SELECT 1 FROM public.incidents k
                 WHERE k.actor_id = a.id AND k.victim_name = i.victim_name
                   AND k.discovered_date IS NOT DISTINCT FROM i.discovered_date) AS collides
  FROM public.incidents i
  JOIN public.threat_actors a ON lower(trim(a.name)) = lower(trim(i.raw_data->>'group_name'))
  WHERE i.actor_id IS NULL;

  INSERT INTO archive.incidents_duplicates_20260919
  SELECT i.*, NULL::uuid FROM public.incidents i JOIN orphan_links o ON o.id = i.id WHERE o.collides OR o.rn > 1;
  DELETE FROM public.incidents i USING orphan_links o WHERE i.id = o.id AND (o.collides OR o.rn > 1);
  UPDATE public.incidents i SET actor_id = o.actor_id
  FROM orphan_links o WHERE i.id = o.id AND NOT o.collides AND o.rn = 1;
END $m$;

ANALYZE public.threat_actors;
ANALYZE public.incidents;
RESET statement_timeout;
