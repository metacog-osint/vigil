-- Migration: where a group comes from, kept apart from where it attacks
-- Drafted: September 20, 2026
--
-- MISP galaxy publishes an attributed country of origin for 482 of the groups Vigil
-- tracks, with an attribution-confidence score. Vigil already ingested both and put
-- them in metadata, where nothing reads them - and fell back to writing the origin
-- into target_countries whenever victim data was missing.
--
-- It was missing every time. All 482 actors with an origin have target_countries set
-- to exactly that origin, and not one actor has more than a single target country. So
-- Vigil was stating that the Equation Group targets the United States, Gamaredon
-- targets Russia and Infy targets Iran: origin relabelled as targeting, which is the
-- opposite claim.
--
-- Origin now has its own columns and carries its own confidence, because attribution
-- is a claim rather than a fact. target_countries is cleared only where it holds
-- nothing but the origin; anything that could have come from victim data is left
-- alone.

ALTER TABLE public.threat_actors
  ADD COLUMN IF NOT EXISTS origin_country text,
  ADD COLUMN IF NOT EXISTS origin_confidence int,
  ADD COLUMN IF NOT EXISTS origin_source text;

CREATE INDEX IF NOT EXISTS idx_threat_actors_origin ON public.threat_actors (origin_country);

COMMENT ON COLUMN public.threat_actors.origin_country IS
  'Attributed country of origin (ISO-2). Attribution is a claim: see origin_confidence';
COMMENT ON COLUMN public.threat_actors.origin_confidence IS
  'Attribution confidence as published by the source, 0-100';

-- Promote what was already ingested; no refetch needed.
UPDATE public.threat_actors
SET origin_country = upper(btrim(metadata->>'origin_country')),
    origin_confidence = nullif(btrim(metadata->>'attribution_confidence'), '')::int,
    origin_source = coalesce(source, 'misp-galaxy')
WHERE metadata->>'origin_country' IS NOT NULL
  AND btrim(metadata->>'origin_country') <> ''
  AND origin_country IS NULL;

-- Remove the origin from the targeting field it was never about.
UPDATE public.threat_actors
SET target_countries = '{}'
WHERE origin_country IS NOT NULL
  AND target_countries = ARRAY[metadata->>'origin_country'];

-- ---------------------------------------------------------------------------
-- upsert_actors names its columns, so the new ones are added to it. Everything
-- else below is migration 079's function unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_actors(p_actors jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  e jsonb;
  k text;
  target uuid;
  result jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_actors) <> 'array' THEN
    RAISE EXCEPTION 'upsert_actors expects a JSON array';
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_actors) LOOP
    k := actor_key(e->>'name');
    CONTINUE WHEN k = '';
    target := NULL;

    -- 1. Same normalised name
    SELECT a.id INTO target FROM threat_actors a
    WHERE actor_key(a.name) = k ORDER BY canonical_rank(a), a.created_at LIMIT 1;

    -- 2. A spelling that was merged away earlier
    IF target IS NULL THEN
      SELECT m.canonical_id INTO target
      FROM archive.threat_actors_merged_20260919 m
      JOIN threat_actors t ON t.id = m.canonical_id
      WHERE actor_key(m.name) = k LIMIT 1;
    END IF;

    IF target IS NULL THEN
      INSERT INTO threat_actors (name, aliases, actor_type, status, source, description,
                                 first_seen, last_seen, target_sectors, target_countries, metadata,
                                 origin_country, origin_confidence, origin_source)
      VALUES (e->>'name',
              jsonb_text_array(e->'aliases'),
              coalesce(e->>'actor_type', 'unknown'),
              coalesce(e->>'status', 'active'),
              e->>'source',
              e->>'description',
              safe_date(e->>'first_seen'),
              safe_date(e->>'last_seen'),
              jsonb_text_array(e->'target_sectors'),
              jsonb_text_array(e->'target_countries'),
              coalesce(e->'metadata', '{}'::jsonb),
              upper(nullif(btrim(coalesce(e->>'origin_country', '')), '')),
              nullif(btrim(coalesce(e->>'origin_confidence', '')), '')::int,
              nullif(btrim(coalesce(e->>'origin_source', '')), ''))
      RETURNING id INTO target;
    ELSE
      UPDATE threat_actors t SET
        -- coalesce: array_agg over nothing is NULL, which would count as a change
        aliases = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(
                     coalesce(t.aliases, '{}') || jsonb_text_array(e->'aliases') || ARRAY[e->>'name']) x
                   WHERE x IS NOT NULL AND x <> '' AND x <> t.name), '{}'),
        target_sectors = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(t.target_sectors, '{}') || jsonb_text_array(e->'target_sectors')) x), '{}'),
        target_countries = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(t.target_countries, '{}') || jsonb_text_array(e->'target_countries')) x), '{}'),
        description = coalesce(t.description, e->>'description'),
        actor_type = CASE WHEN t.actor_type IS NULL OR t.actor_type = 'unknown'
                          THEN coalesce(e->>'actor_type', t.actor_type) ELSE t.actor_type END,
        first_seen = LEAST(t.first_seen, safe_date(e->>'first_seen')),
        last_seen = GREATEST(t.last_seen, safe_date(e->>'last_seen')),
        metadata = coalesce(t.metadata, '{}'::jsonb) || coalesce(e->'metadata', '{}'::jsonb),
        -- Origin is filled where unknown and never overwritten: a reviewed
        -- attribution should not be replaced by a feed's default.
        origin_country = coalesce(t.origin_country,
                                  upper(nullif(btrim(coalesce(e->>'origin_country', '')), ''))),
        origin_confidence = coalesce(t.origin_confidence,
                                     nullif(btrim(coalesce(e->>'origin_confidence', '')), '')::int),
        origin_source = coalesce(t.origin_source, nullif(btrim(coalesce(e->>'origin_source', '')), ''))
      WHERE t.id = target;
    END IF;

    result := result || jsonb_build_array(jsonb_build_object('name', e->>'name', 'id', target));
  END LOOP;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_actors(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_actors(jsonb) TO service_role;
