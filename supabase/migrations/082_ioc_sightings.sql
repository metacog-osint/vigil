-- Migration: IOC sightings (pattern-of-life for infrastructure)
-- Drafted: September 19, 2026
--
-- An IOC row keeps only its first and last sighting, so gaps and reactivations
-- ("active 3-9 Aug, dormant, back 2 Sep") were recorded only as bulky JSON rows in
-- entity_changelog. This adds a compact, queryable history:
--   ioc_sightings: one row per IOC, per day seen, per source
--   a trigger on iocs that records a sighting whenever an IOC is created or its
--   seen-dates move (repeat sightings on the same day are no-ops)
--   two chunked backfill functions, driven by a script in small calls (the API
--   has an 8s statement limit; the busiest changelog day alone took 22s):
--     backfill_ioc_sightings_chunk: changelog history back to 17 Jan 2026
--     backfill_ioc_endpoints_chunk: each IOC's current first/last/created dates
-- Nothing is deleted; entity_changelog is left as it is.

CREATE TABLE IF NOT EXISTS public.ioc_sightings (
  ioc_id uuid NOT NULL REFERENCES public.iocs(id) ON DELETE CASCADE,
  seen_on date NOT NULL,
  source text NOT NULL DEFAULT '',
  PRIMARY KEY (ioc_id, seen_on, source)
);
CREATE INDEX IF NOT EXISTS idx_ioc_sightings_seen_on ON public.ioc_sightings (seen_on);

-- Public threat data, same as iocs: readable by anyone, written only by the system
ALTER TABLE public.ioc_sightings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ioc_sightings_public_read ON public.ioc_sightings;
CREATE POLICY ioc_sightings_public_read ON public.ioc_sightings
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Live capture
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_ioc_sighting() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO ioc_sightings (ioc_id, seen_on, source)
  SELECT NEW.id, d, coalesce(NEW.source, '')
  FROM (VALUES
    (NEW.last_seen_at::date),
    (NEW.last_seen::date),
    (CASE WHEN TG_OP = 'INSERT' THEN NEW.first_seen::date END),
    (CASE WHEN TG_OP = 'INSERT' THEN NEW.first_seen_at::date END),
    (CASE WHEN TG_OP = 'INSERT' THEN current_date END)
  ) v(d)
  WHERE d IS NOT NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_ioc_sighting_insert ON public.iocs;
CREATE TRIGGER trg_record_ioc_sighting_insert
  AFTER INSERT ON public.iocs
  FOR EACH ROW EXECUTE FUNCTION public.record_ioc_sighting();

DROP TRIGGER IF EXISTS trg_record_ioc_sighting_update ON public.iocs;
CREATE TRIGGER trg_record_ioc_sighting_update
  AFTER UPDATE OF last_seen, last_seen_at ON public.iocs
  FOR EACH ROW
  WHEN (OLD.last_seen IS DISTINCT FROM NEW.last_seen OR OLD.last_seen_at IS DISTINCT FROM NEW.last_seen_at)
  EXECUTE FUNCTION public.record_ioc_sighting();

-- ---------------------------------------------------------------------------
-- Backfill from history in fixed-size chunks with a (created_at, id) cursor.
-- Many changelog rows share a created_at (batch upserts), hence the id tiebreak.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_ioc_sightings_chunk(
  p_after_ts timestamptz, p_after_id uuid, p_limit int DEFAULT 5000
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE added int; last_ts timestamptz; last_id uuid; n int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _chunk (entity_id uuid, change_type text, changed_fields jsonb,
                                          source text, created_at timestamptz, id uuid) ON COMMIT DROP;
  TRUNCATE _chunk;
  INSERT INTO _chunk
  SELECT entity_id, change_type, changed_fields, coalesce(source, ''), created_at, id
  FROM entity_changelog
  WHERE entity_type = 'iocs' AND (created_at, id) > (p_after_ts, p_after_id)
  ORDER BY created_at, id
  LIMIT least(greatest(p_limit, 1), 20000);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN jsonb_build_object('done', true);
  END IF;
  SELECT created_at, id INTO last_ts, last_id FROM _chunk ORDER BY created_at DESC, id DESC LIMIT 1;

  WITH days AS (
    SELECT entity_id, created_at::date AS d, source FROM _chunk WHERE change_type = 'created'
    UNION SELECT entity_id, safe_date(changed_fields->'last_seen'->>'new'), source FROM _chunk
    UNION SELECT entity_id, safe_date(changed_fields->'last_seen'->>'old'), source FROM _chunk
    UNION SELECT entity_id, safe_date(changed_fields->'first_seen'->>'new'), source FROM _chunk
    UNION SELECT entity_id, safe_date(changed_fields->'first_seen'->>'old'), source FROM _chunk
  )
  INSERT INTO ioc_sightings (ioc_id, seen_on, source)
  SELECT d.entity_id, d.d, d.source FROM days d
  WHERE d.d IS NOT NULL AND EXISTS (SELECT 1 FROM iocs i WHERE i.id = d.entity_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;

  RETURN jsonb_build_object('done', false, 'rows', n, 'added', added, 'next_ts', last_ts, 'next_id', last_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_ioc_endpoints_chunk(p_after_id uuid, p_limit int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  -- Only the date columns are read; copying whole IOC rows (large JSON fields) was ~5x slower
  WITH batch AS (
    SELECT id, source, first_seen, first_seen_at, last_seen, last_seen_at, created_at
    FROM iocs WHERE id > p_after_id ORDER BY id LIMIT least(greatest(p_limit, 1), 50000)
  ), ins AS (
    INSERT INTO ioc_sightings (ioc_id, seen_on, source)
    SELECT b.id, v.d, coalesce(b.source, '') FROM batch b
    CROSS JOIN LATERAL (VALUES
      (b.first_seen::date), (b.first_seen_at::date), (b.last_seen::date), (b.last_seen_at::date), (b.created_at::date)
    ) v(d)
    WHERE v.d IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT CASE WHEN count(*) = 0 THEN jsonb_build_object('done', true)
              ELSE jsonb_build_object('done', false, 'rows', count(*),
                                      'added', (SELECT count(*) FROM ins),
                                      'next_id', max(id::text)::uuid) END
  INTO result FROM batch;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_ioc_sightings_chunk(timestamptz, uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_ioc_endpoints_chunk(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_ioc_sightings_chunk(timestamptz, uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_ioc_endpoints_chunk(uuid, int) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_ioc_sighting() FROM PUBLIC, anon, authenticated;
