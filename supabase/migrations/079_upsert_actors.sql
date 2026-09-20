-- Migration: Identity-aware actor upsert for ingestion feeds
-- Drafted: September 19, 2026
--
-- The MISP, Malpedia, MITRE and ransomlook feeds upserted threat_actors on the exact
-- name, which (1) overwrote merged records (alias lists replaced, actor_type reset to
-- 'unknown') and (2) re-created merged-away spellings every day. Feeds now call
-- upsert_actors(), which:
--   * matches an existing actor by normalised name (actor_key), or by a name that was
--     merged away (archive.threat_actors_merged_20260919 -> canonical_id);
--   * never matches through alias lists (MISP folds distinct groups together);
--   * merges non-destructively: aliases/sectors/countries/ttps unioned, description
--     only filled when empty, actor_type only replaced when unknown, dates widened;
--     arrays are kept sorted so re-importing unchanged data changes nothing;
--   * inserts genuinely new actors;
--   * returns [{name, id}] so feeds can link incidents to the right actor.

CREATE INDEX IF NOT EXISTS idx_threat_actors_actor_key ON public.threat_actors (public.actor_key(name));

CREATE OR REPLACE FUNCTION public.jsonb_text_array(j jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'array'
              THEN ARRAY(SELECT x FROM jsonb_array_elements_text(j) x WHERE x IS NOT NULL AND x <> '')
              ELSE '{}'::text[] END
$$;

CREATE OR REPLACE FUNCTION public.safe_date(t text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
  RETURN left(t, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

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
                                 first_seen, last_seen, target_sectors, target_countries, metadata)
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
              coalesce(e->'metadata', '{}'::jsonb))
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
        metadata = coalesce(t.metadata, '{}'::jsonb) || coalesce(e->'metadata', '{}'::jsonb)
      WHERE t.id = target;
    END IF;

    result := result || jsonb_build_array(jsonb_build_object('name', e->>'name', 'id', target));
  END LOOP;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_actors(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_actors(jsonb) TO service_role;
