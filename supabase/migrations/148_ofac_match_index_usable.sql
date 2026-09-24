-- 148. Make the OFAC actor match index-usable
--
-- STATUS WHEN WRITTEN: NOT APPLIED. See "why this is not applied yet" below.
--
-- WHAT IS BROKEN
--
-- upsert_sanctioned_addresses fails with "canceling statement due to statement
-- timeout". ofac-sdn is the only feed in feed_expectations marked critical, and
-- it is the one that is failing. ingestion_is_healthy() returns true anyway,
-- because it trips on state in ('stale','never') and ofac-sdn is still only
-- 'late' -- so the sanctions feed can error on every attempt without the health
-- check saying so, until it goes stale. Whether that is the right threshold is
-- a separate question; this migration only makes the function finish.
--
-- WHY IT IS SLOW
--
-- Not volume. sanctioned_addresses holds 1,043 rows and threat_actors 4,504.
-- It is the join that builds _matches:
--
--   JOIN threat_actors a
--     ON actor_key(a.name) = actor_key(e.entity_name)
--     OR EXISTS (SELECT 1 FROM unnest(e.aliases) x
--                WHERE actor_key(x) = actor_key(a.name) AND length(actor_key(x)) > 3)
--
-- actor_key is IMMUTABLE and idx_threat_actors_actor_key already indexes
-- actor_key(name), so the equality half could be an index lookup. The OR makes
-- that impossible: a disjunction containing a correlated subquery cannot be
-- answered from an index, so the planner falls back to a nested loop and
-- evaluates the whole predicate per pair. EXPLAIN, 24 September 2026:
--
--   Aggregate  (cost=3838612.12..3838612.13)
--     -> Nested Loop  (cost=89.14..3838026.47 rows=234260)
--          Join Filter: ((actor_key(a.name) = actor_key(e.entity_name))
--                        OR EXISTS(SubPlan 1))
--          -> Index Only Scan using idx_actors_name on threat_actors a (rows=4504)
--          -> Materialize (rows=104)
--          SubPlan 1
--            -> Function Scan on unnest x
--
-- 4,504 actors x 104 entities = 468,416 executions of SubPlan 1, each unnesting
-- an alias array and calling actor_key on every element. The index that exists
-- for exactly this purpose is never touched.
--
-- THE CHANGE
--
-- Expand the aliases before the join rather than inside a correlated EXISTS, so
-- both halves become equality joins the index can answer, and UNION them --
-- which also de-duplicates the pair an actor matching both ways would produce.
--
-- Nothing else changes. The short-payload guard, the delisting behaviour, the
-- applied/queued split and the withdrawal DELETE are untouched, and _matches
-- keeps the same columns and the same GROUP BY, so exact_name and matched_alias
-- are computed exactly as before over the same alias arrays.
--
-- WHY THIS IS NOT APPLIED YET
--
-- This function decides which tracked actors are linked to OFAC-designated
-- entities. A wrong link here is the most consequential claim in the database,
-- and rule 7 of CLAUDE.md applies: do not guess a judgment, and do not assume an
-- optimisation preserves one. The rewrite is intended to be exactly equivalent
-- and that equivalence was NOT verified by execution -- the direct Postgres
-- connection timed out for the entire window in which this was written, while
-- PostgREST stayed up.
--
-- Run tools/verify_148_equivalence.sql first. It returns in_old_only and
-- in_new_only. If either is non-zero, do not apply this.

CREATE OR REPLACE FUNCTION public.upsert_sanctioned_addresses(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- CHANGED. Aliases are expanded before the join, so both halves are equality
  -- joins that idx_threat_actors_actor_key can answer. The previous OR'd
  -- correlated EXISTS forced a 468,416-iteration nested loop. See the header.
  CREATE TEMP TABLE _matches ON COMMIT DROP AS
  WITH ent AS (
    SELECT DISTINCT entity_uid, entity_name, programs, aliases
    FROM _sdn WHERE entity_uid IS NOT NULL
  ),
  pair AS (
    SELECT a.id AS actor_id, a.name AS actor_name,
           e.entity_uid, e.entity_name, e.programs, e.aliases
    FROM ent e
    JOIN threat_actors a ON actor_key(a.name) = actor_key(e.entity_name)
    UNION
    SELECT a.id, a.name, e.entity_uid, e.entity_name, e.programs, e.aliases
    FROM ent e
    CROSS JOIN LATERAL unnest(coalesce(e.aliases, '{}')) AS x
    JOIN threat_actors a ON actor_key(a.name) = actor_key(x)
    WHERE length(actor_key(x)) > 3
  )
  SELECT p.actor_id, p.actor_name, actor_key(p.actor_name) AS a_key,
         p.entity_uid, p.entity_name, p.programs,
         bool_or(actor_key(p.actor_name) = actor_key(p.entity_name)) AS exact_name,
         min(al) FILTER (WHERE actor_key(al) = actor_key(p.actor_name)) AS matched_alias
  FROM pair p
  LEFT JOIN LATERAL unnest(coalesce(p.aliases, '{}')) AS al ON TRUE
  GROUP BY p.actor_id, p.actor_name, p.entity_uid, p.entity_name, p.programs;

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
$function$;
