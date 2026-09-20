-- Migration: Group profiles - ATT&CK techniques, tools and leak sites
-- Drafted: September 20, 2026
--
-- "Which groups use this technique?" had almost no answer: 11 ransomware groups had
-- any TTPs and actor_techniques held 15 rows. ransomware.live's /v2/groups returns
-- ATT&CK tactics/techniques (61 groups), categorised tooling (70 groups) and leak-site
-- addresses (889) in one daily request.
--
-- Only facts are stored (technique IDs and the source's per-group note, tool names,
-- onion addresses, aliases); the source's written group descriptions are not copied.
-- Rows carry source = 'ransomware.live' for attribution.
--
-- Profiles attach to actors Vigil already tracks; unknown groups are counted, not
-- created, so this reference feed cannot inflate the actor list.

CREATE TABLE IF NOT EXISTS public.actor_tools (
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  source text,
  first_seen date NOT NULL DEFAULT current_date,
  last_seen date NOT NULL DEFAULT current_date,
  PRIMARY KEY (actor_id, tool_name, category)
);
CREATE INDEX IF NOT EXISTS idx_actor_tools_name ON public.actor_tools (lower(tool_name));
ALTER TABLE public.actor_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_tools_public_read ON public.actor_tools;
CREATE POLICY actor_tools_public_read ON public.actor_tools FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.actor_sites (
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  fqdn text NOT NULL,
  enabled boolean,
  available boolean,
  source text,
  first_seen date NOT NULL DEFAULT current_date,
  last_seen date NOT NULL DEFAULT current_date,
  PRIMARY KEY (actor_id, fqdn)
);
CREATE INDEX IF NOT EXISTS idx_actor_sites_fqdn ON public.actor_sites (fqdn);
ALTER TABLE public.actor_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_sites_public_read ON public.actor_sites;
CREATE POLICY actor_sites_public_read ON public.actor_sites FOR SELECT TO anon, authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_actor_techniques ON public.actor_techniques (actor_id, technique_id);

CREATE OR REPLACE FUNCTION public.upsert_group_profiles(p_groups jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  g jsonb; tac jsonb; t jsonb; tool_cat record; tool text;
  target uuid; k text;
  matched int := 0; unknown int := 0; techs int := 0; skipped int := 0; tools int := 0; sites int := 0;
BEGIN
  IF jsonb_typeof(p_groups) <> 'array' THEN
    RAISE EXCEPTION 'upsert_group_profiles expects a JSON array';
  END IF;

  FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    k := actor_key(g->>'name');
    CONTINUE WHEN k = '';
    target := NULL;

    SELECT a.id INTO target FROM threat_actors a
    WHERE actor_key(a.name) = k ORDER BY canonical_rank(a), a.created_at LIMIT 1;

    IF target IS NULL AND coalesce(g->>'altname', 'None') <> 'None' THEN
      SELECT a.id INTO target FROM threat_actors a
      WHERE actor_key(a.name) = actor_key(g->>'altname') ORDER BY canonical_rank(a), a.created_at LIMIT 1;
    END IF;

    IF target IS NULL THEN
      SELECT m.canonical_id INTO target FROM archive.threat_actors_merged_20260919 m
      JOIN threat_actors t2 ON t2.id = m.canonical_id WHERE actor_key(m.name) = k LIMIT 1;
    END IF;

    IF target IS NULL THEN
      unknown := unknown + 1;
      CONTINUE;
    END IF;
    matched := matched + 1;

    -- aliases from the source's alternate name
    IF coalesce(g->>'altname', 'None') <> 'None' THEN
      UPDATE threat_actors a SET aliases = coalesce((
        SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(a.aliases, '{}') || ARRAY[g->>'altname']) x
        WHERE x IS NOT NULL AND x <> '' AND x <> a.name), '{}')
      WHERE a.id = target;
    END IF;

    -- ATT&CK techniques (skip ids not in the local catalogue: deprecated or tactic ids)
    FOR tac IN SELECT value FROM jsonb_array_elements(coalesce(g->'ttps', '[]'::jsonb)) LOOP
      FOR t IN SELECT value FROM jsonb_array_elements(coalesce(tac->'techniques', '[]'::jsonb)) LOOP
        IF EXISTS (SELECT 1 FROM techniques x WHERE x.id = t->>'technique_id') THEN
          INSERT INTO actor_techniques (actor_id, technique_id, confidence, source, notes, first_seen, last_seen)
          VALUES (target, t->>'technique_id', 'medium', 'ransomware.live',
                  nullif(t->>'technique_details', ''), current_date, current_date)
          ON CONFLICT (actor_id, technique_id) DO UPDATE
          SET last_seen = current_date,
              notes = coalesce(nullif(excluded.notes, ''), actor_techniques.notes)
          WHERE actor_techniques.notes IS DISTINCT FROM excluded.notes
             OR actor_techniques.last_seen IS DISTINCT FROM current_date;
          techs := techs + 1;
        ELSE
          skipped := skipped + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- tools, grouped by category in the source payload
    FOR tool_cat IN
      SELECT kv.key AS cat, kv.value AS names
      FROM jsonb_array_elements(coalesce(g->'tools', '[]'::jsonb)) AS e(entry),
           LATERAL jsonb_each(e.entry) AS kv(key, value)
    LOOP
      FOR tool IN SELECT jsonb_array_elements_text(tool_cat.names) LOOP
        INSERT INTO actor_tools (actor_id, tool_name, category, source, last_seen)
        VALUES (target, tool, tool_cat.cat, 'ransomware.live', current_date)
        ON CONFLICT (actor_id, tool_name, category) DO UPDATE SET last_seen = current_date
        WHERE actor_tools.last_seen IS DISTINCT FROM current_date;
        tools := tools + 1;
      END LOOP;
    END LOOP;

    -- leak-site addresses
    FOR t IN SELECT value FROM jsonb_array_elements(coalesce(g->'locations', '[]'::jsonb)) LOOP
      CONTINUE WHEN coalesce(t->>'fqdn', '') = '';
      INSERT INTO actor_sites (actor_id, fqdn, enabled, available, source, last_seen)
      VALUES (target, t->>'fqdn', (t->>'enabled')::boolean, (t->>'available')::boolean, 'ransomware.live', current_date)
      ON CONFLICT (actor_id, fqdn) DO UPDATE
      SET enabled = excluded.enabled, available = excluded.available, last_seen = current_date;
      sites := sites + 1;
    END LOOP;

    -- keep the actor's ttps array in step for quick display
    UPDATE threat_actors a SET ttps = coalesce((
      SELECT array_agg(DISTINCT technique_id ORDER BY technique_id)
      FROM actor_techniques at WHERE at.actor_id = target), '{}')
    WHERE a.id = target
      AND a.ttps IS DISTINCT FROM (SELECT array_agg(DISTINCT technique_id ORDER BY technique_id)
                                   FROM actor_techniques at WHERE at.actor_id = target);
  END LOOP;

  RETURN jsonb_build_object('matched', matched, 'unknown_groups', unknown,
    'techniques', techs, 'techniques_skipped', skipped, 'tools', tools, 'sites', sites);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_group_profiles(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_group_profiles(jsonb) TO service_role;
