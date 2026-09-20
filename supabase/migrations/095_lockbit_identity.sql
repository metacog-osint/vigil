-- Migration: resolve LockBit's identity, and stop counting a police operation as victims
-- Reviewed: September 20, 2026
--
-- LockBit was seven separate actors: LockBit, lockbit2, Lockbit3, lockbit3_fs,
-- lockbit3_cronos, lockbit4 and lockbit5. 4,275 incidents were split across them, so
-- the record named "LockBit" showed 5 incidents and INACTIVE while the group's live
-- activity accrued to "lockbit5".
--
-- Evidence that these are one operation, not seven groups: the date ranges are
-- contiguous and do not overlap -
--
--   LockBit          2020-10-21 .. 2021-08-23      5 incidents
--   lockbit2         2021-09-09 .. 2022-06-28  1,217
--   Lockbit3         2022-06-29 .. 2025-12-05  2,366
--   lockbit3_fs      2024-01-01 .. 2024-02-24    112   (mirror during the takedown)
--   lockbit4              no incidents            0
--   lockbit5         2025-12-07 .. 2026-09-18    552   (current)
--
-- Each name is a version of one ransomware brand publishing on one leak
-- infrastructure, which is identity, not lineage and not shared tooling. The
-- canonical record is the MISP-galaxy "LockBit" entry, which carries the group
-- profile: 54 indicators, 26 ATT&CK techniques.
--
-- lockbit3_cronos is different, and merging it blindly would have made Vigil wrong in
-- public. Its 23 "victims", all dated 20-21 February 2024, are the NCA and FBI notices
-- posted on the seized leak site during Operation Cronos: "Who is LockbitSupp?",
-- "US Indictments", "Arrest in Poland", "Lockbit Decryption Keys", "Rewards for
-- Reporting". An incident row asserts that a group claimed a victim. These assert the
-- opposite, so they are moved out of incidents rather than attributed to LockBit -
-- kept, because the takedown is part of the group's history, but no longer counted.

-- ---------------------------------------------------------------------------
-- 1. Somewhere for leak-site content that is not a victim claim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leak_site_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.threat_actors(id) ON DELETE SET NULL,
  title text NOT NULL,
  posted_on date,
  kind text NOT NULL,
  note text,
  source text,
  source_url text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leak_site_notices_actor ON public.leak_site_notices (actor_id);
CREATE INDEX IF NOT EXISTS idx_leak_site_notices_posted ON public.leak_site_notices (posted_on DESC);

ALTER TABLE public.leak_site_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leak_site_notices_public_read ON public.leak_site_notices;
CREATE POLICY leak_site_notices_public_read ON public.leak_site_notices
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.leak_site_notices IS
  'Content published on a leak site that is not a victim claim - seizure notices, press releases, recruitment';

-- ---------------------------------------------------------------------------
-- 2. Move the Operation Cronos notices out of incidents
-- ---------------------------------------------------------------------------
WITH cronos AS (
  SELECT i.* FROM incidents i
  JOIN threat_actors a ON a.id = i.actor_id
  WHERE actor_key(a.name) = 'lockbit3cronos'
), moved AS (
  INSERT INTO leak_site_notices (actor_id, title, posted_on, kind, note, source, source_url, raw_data)
  SELECT c.actor_id, c.victim_name, c.discovered_date, 'law_enforcement_seizure',
         'Posted by the NCA and FBI on the seized LockBit leak site during Operation Cronos, February 2024',
         c.source, c.source_url, c.raw_data
  FROM cronos c
  RETURNING 1
)
DELETE FROM incidents WHERE id IN (SELECT id FROM cronos);

-- ---------------------------------------------------------------------------
-- 3. Record the verdict, then merge into the canonical record
-- ---------------------------------------------------------------------------
INSERT INTO public.actor_relationship_decisions (key_a, key_b, relation, rationale, decided_by)
SELECT least(public.actor_key('LockBit'), public.actor_key(v)),
       greatest(public.actor_key('LockBit'), public.actor_key(v)),
       'same_entity',
       'Successive versions of one ransomware brand on one leak infrastructure; incident date ranges are contiguous and non-overlapping',
       'owner review 2026-09-20'
FROM (VALUES ('lockbit2'), ('Lockbit3'), ('lockbit3_fs'), ('lockbit3_cronos'), ('lockbit4'), ('lockbit5')) AS t(v)
ON CONFLICT (key_a, key_b) DO UPDATE
SET relation = EXCLUDED.relation, rationale = EXCLUDED.rationale, decided_by = EXCLUDED.decided_by;

-- Merged explicitly rather than through run_data_quality_checks: canonical_rank picks
-- the record with the most incidents, which would make "Lockbit3" the group's name.
-- The version-neutral MISP-galaxy entry is the right canonical record.
DO $$
DECLARE canon uuid; dup record; merged int := 0;
BEGIN
  SELECT id INTO canon FROM threat_actors
  WHERE actor_key(name) = 'lockbit' AND source IN ('misp-galaxy', 'misp_galaxy')
  ORDER BY created_at LIMIT 1;

  IF canon IS NULL THEN
    RAISE EXCEPTION 'canonical LockBit record not found';
  END IF;

  FOR dup IN
    SELECT id, name FROM threat_actors
    WHERE actor_key(name) LIKE 'lockbit%' AND id <> canon
  LOOP
    PERFORM merge_actor(dup.id, canon,
      'reviewed decision: LockBit version variant (' || dup.name || ')');
    merged := merged + 1;
  END LOOP;

  UPDATE threat_actors SET
    aliases = coalesce((
      SELECT array_agg(DISTINCT x ORDER BY x)
      FROM unnest(coalesce(aliases, '{}') || ARRAY[
        'LockBit 2.0', 'LockBit 3.0', 'LockBit Black', 'LockBit 4.0', 'LockBit 5.0', 'LockBitSupp'
      ]) x
      WHERE x IS NOT NULL AND x <> '' AND x <> name), '{}')
  WHERE id = canon;

  -- leak_site_notices.actor_id is ON DELETE SET NULL, so the notices moved above
  -- were orphaned the moment their original actor was merged away.
  UPDATE leak_site_notices SET actor_id = canon
  WHERE actor_id IS NULL AND kind = 'law_enforcement_seizure';

  RAISE NOTICE 'merged % LockBit records', merged;
END $$;

SELECT public.apply_actor_trends();
