-- 162. threat_actors_commercial answers a lookup by checking only the actors asked for
--
-- STATUS: NOT YET APPLIED.
--
-- WHAT BROKE
--
-- /api/feed (PR #81) returned 503 on its first request after deploy, at
-- 18:11:53 UTC on 31 October 2026 (1:11 p.m. CDT). Postgres logged "canceling
-- statement due to statement timeout": the feed reads as anon, which Supabase
-- cuts off at 3 seconds, and the query was
--
--   threat_actors_commercial?select=actor_id,name&actor_id=in.(...33 ids...)
--
-- 160 decided "listed by its claims" with an uncorrelated subquery: the set of
-- every actor that has at least one claim from a sellable source. Postgres
-- builds that set lazily, only when a row needs it, so a lookup where every
-- actor has a sellable source of its own was quick. One actor without one was
-- enough to build the whole set: a pass over all 41,053 claims, unnesting each
-- comma-joined source list.
--
-- Measured on 31 October, with every page already in memory, for the feed's
-- real list of 33 actors (one without a sellable source of its own):
--
--   160:  2,767 ms, 15,666 buffers
--   162:  0.44 ms, 85 buffers
--
-- Any page read from disk on top of the 160 figure goes past 3 seconds.
--
-- WHAT CHANGES
--
-- The claims test becomes a correlated EXISTS: for an actor whose own source
-- may not be sold, look at that actor's claims (idx_incidents_actor) and stop
-- at the first one a sellable source reported. A lookup by id checks only the
-- ids asked for; the whole view drops from about 900 ms to 16 ms, because the
-- 1,293 actors without a sellable source mostly have no claims at all.
--
-- The rows are identical: the dry run compared all 3,338 (actor_id, listed_by)
-- pairs before and after.
--
-- supabase/tests/commercialViews.test.js holds the rule and the plan shape.
--
-- GRANTS
--
-- CREATE OR REPLACE keeps a view's grants. They are restated so this file
-- stands on its own (154, 156).

create or replace view public.threat_actors_commercial
with (security_invoker = true) as
with licence as (
  select source_id from public.source_licences where commercial_use
)
select
  ta.id as actor_id,
  ta.name,
  case when lower(replace(btrim(coalesce(ta.source, '')), '_', '-')) in (select source_id from licence)
       then 'source' else 'claims' end as listed_by
from public.threat_actors ta
where lower(replace(btrim(coalesce(ta.source, '')), '_', '-')) in (select source_id from licence)
   or exists (
     select 1
     from public.incidents i
     where i.actor_id = ta.id
       and exists (
         select 1 from unnest(string_to_array(coalesce(i.source, ''), ',')) as x
         where lower(replace(btrim(x), '_', '-')) in (select source_id from licence)
       )
   );

comment on view public.threat_actors_commercial is
  'Actors a sellable source lists, or that a sellable source reports a claim '
  'by. listed_by says which. A lookup by id checks only those ids. See 160, 162.';

revoke all on public.threat_actors_commercial from anon, authenticated;
grant select on public.threat_actors_commercial to anon, authenticated, service_role;
