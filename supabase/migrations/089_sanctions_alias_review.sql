-- Migration: review alias-based sanctions matches instead of asserting them
-- Drafted: September 20, 2026
--
-- 088 linked a designated entity to a tracked actor whenever the actor's name matched
-- the entity name OR any of the entity's aliases. The alias path is analyst judgment:
-- OFAC lists "HYDRA" as an alias of HYDRA MARKET, and Vigil tracks an actor called
-- "Hydra" that may be something else entirely. Saying an actor is OFAC-designated when
-- it is not is a serious claim to get wrong.
--
-- So an exact name match is applied, and an alias match is queued as a data-quality
-- finding and applied only once a recorded verdict confirms it - the same
-- detect / auto-fix-safe / queue-judgment split the hourly checks use.

CREATE TABLE IF NOT EXISTS public.sanctions_match_decisions (
  actor_key text NOT NULL,
  entity_uid text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('confirmed', 'rejected', 'unreviewed')),
  rationale text,
  decided_by text,
  decided_at timestamptz DEFAULT now(),
  PRIMARY KEY (actor_key, entity_uid)
);
ALTER TABLE public.sanctions_match_decisions ENABLE ROW LEVEL SECURITY;

-- OFAC publishes TEMP.HERMIT among LAZARUS GROUP's own aliases, so this one follows
-- the source rather than interpreting it.
INSERT INTO public.sanctions_match_decisions (actor_key, entity_uid, verdict, rationale, decided_by)
VALUES (public.actor_key('TEMP.Hermit'), '27307', 'confirmed',
        'OFAC lists TEMP.HERMIT as an aka of LAZARUS GROUP; Vigil tracks the same DPRK cluster under that name',
        'source-published alias')
ON CONFLICT (actor_key, entity_uid) DO NOTHING;

CREATE OR REPLACE FUNCTION public.upsert_sanctioned_addresses(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted int := 0; refreshed int := 0; delisted int := 0; relisted int := 0;
  linked int := 0; queued int := 0; total int;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'upsert_sanctioned_addresses expects a JSON array';
  END IF;

  CREATE TEMP TABLE _sdn ON COMMIT DROP AS
  SELECT DISTINCT ON (address) *
  FROM jsonb_to_recordset(p_rows) AS x(
    address text, currency text, entity_name text, entity_uid text,
    programs text[], aliases text[])
  WHERE coalesce(address, '') <> '' AND coalesce(entity_name, '') <> ''
  ORDER BY address;

  SELECT count(*) INTO total FROM _sdn;
  -- A short payload means a truncated download, not a mass delisting.
  IF total < 100 THEN
    RAISE EXCEPTION 'refusing to apply a suspiciously short SDN payload (% rows)', total;
  END IF;

  SELECT count(*) INTO relisted FROM _sdn n
  JOIN sanctioned_addresses s ON s.address = n.address
  WHERE s.delisted_at IS NOT NULL;

  WITH up AS (
    INSERT INTO sanctioned_addresses AS s
      (address, currency, entity_name, entity_uid, programs, aliases, last_seen, delisted_at)
    SELECT address, currency, entity_name, entity_uid,
           coalesce(programs, '{}'), coalesce(aliases, '{}'), current_date, NULL
    FROM _sdn
    ON CONFLICT (address) DO UPDATE
    SET currency = excluded.currency, entity_name = excluded.entity_name,
        entity_uid = excluded.entity_uid, programs = excluded.programs,
        aliases = excluded.aliases, last_seen = current_date, delisted_at = NULL
    RETURNING (xmax = 0) AS is_new
  )
  SELECT count(*) FILTER (WHERE is_new), count(*) FILTER (WHERE NOT is_new)
  INTO inserted, refreshed FROM up;

  -- Addresses no longer on the list keep their row and gain a delisting date.
  WITH gone AS (
    UPDATE sanctioned_addresses s SET delisted_at = current_date
    WHERE s.source = 'ofac-sdn' AND s.delisted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM _sdn n WHERE n.address = s.address)
    RETURNING 1)
  SELECT count(*) INTO delisted FROM gone;

  CREATE TEMP TABLE _matches ON COMMIT DROP AS
  WITH ent AS (SELECT DISTINCT entity_uid, entity_name, programs, aliases FROM _sdn WHERE entity_uid IS NOT NULL)
  SELECT a.id AS actor_id, a.name AS actor_name, actor_key(a.name) AS a_key,
         e.entity_uid, e.entity_name, e.programs,
         bool_or(actor_key(a.name) = actor_key(e.entity_name)) AS exact_name,
         min(al) FILTER (WHERE actor_key(al) = actor_key(a.name)) AS matched_alias
  FROM ent e
  JOIN threat_actors a
    ON actor_key(a.name) = actor_key(e.entity_name)
    OR EXISTS (SELECT 1 FROM unnest(coalesce(e.aliases, '{}')) x
               WHERE actor_key(x) = actor_key(a.name) AND length(actor_key(x)) > 3)
  LEFT JOIN LATERAL unnest(coalesce(e.aliases, '{}')) AS al ON TRUE
  GROUP BY a.id, a.name, e.entity_uid, e.entity_name, e.programs;

  -- Applied: exact name matches, plus alias matches a recorded verdict confirms.
  WITH ins AS (
    INSERT INTO actor_sanctions (actor_id, entity_uid, entity_name, programs, match_basis, last_seen)
    SELECT m.actor_id, m.entity_uid, m.entity_name, coalesce(m.programs, '{}'),
           CASE WHEN m.exact_name THEN 'name' ELSE 'alias_reviewed' END, current_date
    FROM _matches m
    LEFT JOIN sanctions_match_decisions d ON d.actor_key = m.a_key AND d.entity_uid = m.entity_uid
    WHERE m.exact_name OR coalesce(d.verdict, 'unreviewed') = 'confirmed'
    ON CONFLICT (actor_id, entity_uid) DO UPDATE
    SET entity_name = excluded.entity_name, programs = excluded.programs,
        match_basis = excluded.match_basis, last_seen = current_date
    RETURNING 1)
  SELECT count(*) INTO linked FROM ins;

  -- Queued: alias matches with no verdict, recorded for an analyst rather than applied.
  WITH q AS (
    SELECT m.*, d.verdict FROM _matches m
    LEFT JOIN sanctions_match_decisions d ON d.actor_key = m.a_key AND d.entity_uid = m.entity_uid
    WHERE NOT m.exact_name AND coalesce(d.verdict, 'unreviewed') = 'unreviewed'
  ), rec AS (
    SELECT record_finding('sanctions_alias_match',
             q.actor_name || ' = ' || q.entity_name, 'warning', 'open',
             jsonb_build_object('actor_id', q.actor_id, 'actor_key', q.a_key,
               'entity_uid', q.entity_uid, 'entity_name', q.entity_name,
               'matched_alias', q.matched_alias, 'programs', q.programs,
               'question', 'Is this tracked actor the OFAC-designated entity, or a different group sharing the name?'))
    FROM q)
  SELECT count(*) INTO queued FROM rec;

  -- Withdraw links that a verdict has since rejected, or that were applied on an
  -- alias before this review step existed.
  DELETE FROM actor_sanctions s
  USING _matches m
  LEFT JOIN sanctions_match_decisions d ON d.actor_key = m.a_key AND d.entity_uid = m.entity_uid
  WHERE s.actor_id = m.actor_id AND s.entity_uid = m.entity_uid
    AND NOT m.exact_name AND coalesce(d.verdict, 'unreviewed') <> 'confirmed';

  RETURN jsonb_build_object('addresses', total, 'new', inserted, 'refreshed', refreshed,
    'relisted', relisted, 'delisted', delisted, 'actors_linked', linked,
    'alias_matches_queued', queued);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_sanctioned_addresses(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_sanctioned_addresses(jsonb) TO service_role;
