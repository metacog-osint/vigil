-- Migration: Materialise ioc_actor_links
-- Drafted: September 19, 2026
--
-- As a view, "show me this group's indicators" hash-joined all 568k IOCs and took
-- ~6s (over the API's limits): the expression index on actor_key(malware_family)
-- can't serve that join. There are only ~1,000 links, so they are materialised into
-- a small indexed table refreshed by the hourly check. Lookups by value stay fast and
-- lookups by group become fast.

DROP VIEW IF EXISTS public.ioc_actor_links;

CREATE TABLE IF NOT EXISTS public.ioc_actor_links (
  ioc_id uuid NOT NULL REFERENCES public.iocs(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  type text,
  value text NOT NULL,
  malware_family text,
  ioc_source text,
  actor_name text NOT NULL,
  relation text NOT NULL,
  confidence text NOT NULL,
  rationale text,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ioc_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_ioc_actor_links_value ON public.ioc_actor_links (value);
CREATE INDEX IF NOT EXISTS idx_ioc_actor_links_actor ON public.ioc_actor_links (actor_id);
CREATE INDEX IF NOT EXISTS idx_ioc_actor_links_actor_name ON public.ioc_actor_links (actor_name);
CREATE INDEX IF NOT EXISTS idx_ioc_actor_links_type ON public.ioc_actor_links (type);

ALTER TABLE public.ioc_actor_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ioc_actor_links_public_read ON public.ioc_actor_links;
CREATE POLICY ioc_actor_links_public_read ON public.ioc_actor_links
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_ioc_actor_links() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  CREATE TEMP TABLE _links ON COMMIT DROP AS
  SELECT i.id AS ioc_id, m.actor_id, i.type, i.value, i.malware_family, i.source AS ioc_source,
         a.name AS actor_name, m.relation, m.confidence, m.rationale
  FROM malware_family_actor_map m
  JOIN threat_actors a ON a.id = m.actor_id
  JOIN iocs i ON actor_key(i.malware_family) = m.family_key
  WHERE m.relation IN ('ransomware_brand', 'used_by');

  DELETE FROM ioc_actor_links l WHERE NOT EXISTS (
    SELECT 1 FROM _links t WHERE t.ioc_id = l.ioc_id AND t.actor_id = l.actor_id);

  INSERT INTO ioc_actor_links (ioc_id, actor_id, type, value, malware_family, ioc_source,
                               actor_name, relation, confidence, rationale, refreshed_at)
  SELECT ioc_id, actor_id, type, value, malware_family, ioc_source, actor_name, relation,
         confidence, rationale, now()
  FROM _links
  ON CONFLICT (ioc_id, actor_id) DO UPDATE
  SET actor_name = EXCLUDED.actor_name, relation = EXCLUDED.relation,
      confidence = EXCLUDED.confidence, rationale = EXCLUDED.rationale,
      malware_family = EXCLUDED.malware_family, ioc_source = EXCLUDED.ioc_source,
      refreshed_at = now()
  WHERE ioc_actor_links.relation IS DISTINCT FROM EXCLUDED.relation
     OR ioc_actor_links.confidence IS DISTINCT FROM EXCLUDED.confidence
     OR ioc_actor_links.actor_name IS DISTINCT FROM EXCLUDED.actor_name;

  SELECT count(*) INTO n FROM ioc_actor_links;
  RETURN jsonb_build_object('ioc_actor_links', n);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_ioc_actor_links() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ioc_actor_links() TO service_role;

SELECT public.refresh_ioc_actor_links();
