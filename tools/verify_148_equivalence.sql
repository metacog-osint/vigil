-- Run this BEFORE applying migration 148.
--
-- 148 rewrites the _matches join inside upsert_sanctioned_addresses so it can
-- use idx_threat_actors_actor_key. The rewrite is intended to be exactly
-- equivalent. This checks that against the live data rather than taking the
-- claim on trust, because the function decides which tracked actors are linked
-- to OFAC-designated entities.
--
-- Expected result: in_old_only = 0 AND in_new_only = 0.
-- Anything else means the rewrite changes which actors are matched. Do not
-- apply 148.
--
-- It stands in sanctioned_addresses for the _sdn temp table the function builds
-- from its payload. That is the same shape and the same columns; what it cannot
-- cover is an entity present in a fresh SDN download but not yet in the table,
-- so re-run it after the first successful ofac-sdn run as well.
--
-- NOTE ON RUNNING IT: the "old" half is the slow one -- it is the query that
-- times out in production. If this statement is cancelled, that is a result of
-- a kind: it confirms the diagnosis, but it does not confirm equivalence. Raise
-- statement_timeout for the session and run it again:
--
--   SET statement_timeout = '10min';

WITH ent AS (
  SELECT DISTINCT entity_uid, entity_name, programs, aliases
  FROM sanctioned_addresses
  WHERE entity_uid IS NOT NULL
),
old AS (
  SELECT a.id AS actor_id, a.name AS actor_name, e.entity_uid, e.entity_name,
         bool_or(actor_key(a.name) = actor_key(e.entity_name)) AS exact_name,
         min(al) FILTER (WHERE actor_key(al) = actor_key(a.name)) AS matched_alias
  FROM ent e
  JOIN threat_actors a
    ON actor_key(a.name) = actor_key(e.entity_name)
    OR EXISTS (SELECT 1 FROM unnest(coalesce(e.aliases, '{}')) x
               WHERE actor_key(x) = actor_key(a.name) AND length(actor_key(x)) > 3)
  LEFT JOIN LATERAL unnest(coalesce(e.aliases, '{}')) AS al ON TRUE
  GROUP BY a.id, a.name, e.entity_uid, e.entity_name, e.programs
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
),
new AS (
  SELECT p.actor_id, p.actor_name, p.entity_uid, p.entity_name,
         bool_or(actor_key(p.actor_name) = actor_key(p.entity_name)) AS exact_name,
         min(al) FILTER (WHERE actor_key(al) = actor_key(p.actor_name)) AS matched_alias
  FROM pair p
  LEFT JOIN LATERAL unnest(coalesce(p.aliases, '{}')) AS al ON TRUE
  GROUP BY p.actor_id, p.actor_name, p.entity_uid, p.entity_name, p.programs
)
SELECT (SELECT count(*) FROM old) AS old_rows,
       (SELECT count(*) FROM new) AS new_rows,
       (SELECT count(*) FROM (SELECT * FROM old EXCEPT SELECT * FROM new) d) AS in_old_only,
       (SELECT count(*) FROM (SELECT * FROM new EXCEPT SELECT * FROM old) d) AS in_new_only;
