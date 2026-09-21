-- 128: the countries each dataset can actually be filtered by
--
-- WHY VIEWS RATHER THAN A DISTINCT QUERY
--
-- A filter dropdown should offer what the data contains, not a list of 195
-- countries most of which return nothing. PostgREST cannot GROUP BY, so
-- deriving the list client-side would mean either reading every row or
-- offering options that match nothing.
--
-- THREE GEOGRAPHIES, THREE VIEWS
--
-- Vigil keeps infrastructure, origin and victim apart on purpose - conflating
-- them is the fault migration 096 and the actor-origin work exist to prevent,
-- and the feed that once wrote origin into target_countries is why the rule is
-- written down. So there is no single "countries" list. Each view names which
-- geography it describes, and the filters built on them are labelled to match:
--
--   incident_victim_countries   where the victim was       (incidents.victim_country)
--   actor_origin_countries      where the group is from    (threat_actors.origin_country)
--   actor_target_countries      where a group attacks      (threat_actors.target_countries)
--
-- Indicator infrastructure already has its own path through search_iocs and
-- ioc_geo (migration 114), so it is not repeated here.
--
-- COVERAGE IS PART OF THE ANSWER
--
-- These are thin, and a filter that silently drops most of the data would be
-- the product overstating itself. As of 21 September:
--
--   victim_country   11,317 of 39,533 incidents   29%, and nothing since 29 May
--   origin_country      483 of  4,504 actors      11%
--   target_countries    146 of  4,504 actors       3%
--
-- So each view carries the covered count alongside the total, and the pages
-- built on them say so rather than presenting a filtered view as the whole.
--
-- security_invoker so the underlying policies still apply: incidents and
-- threat_actors are public-read, and these views must not widen that.

begin;

create or replace view public.incident_victim_countries
with (security_invoker = true) as
select victim_country as country_code,
       count(*) as incidents,
       max(discovered_date) as most_recent
from public.incidents
where victim_country is not null and btrim(victim_country) <> ''
group by victim_country
order by count(*) desc;

create or replace view public.actor_origin_countries
with (security_invoker = true) as
select origin_country as country_code,
       count(*) as actors,
       count(*) filter (where status = 'active') as active_actors
from public.threat_actors
where origin_country is not null and btrim(origin_country) <> ''
group by origin_country
order by count(*) desc;

create or replace view public.actor_target_countries
with (security_invoker = true) as
select country_code,
       count(*) as actors
from public.threat_actors,
     lateral unnest(target_countries) as country_code
where target_countries is not null
group by country_code
order by count(*) desc;

-- How much of each dataset a country filter can see at all. One row, read by
-- the pages so the coverage they state comes from the database rather than a
-- number typed into a component and left to rot.
create or replace view public.country_coverage
with (security_invoker = true) as
select 'incidents' as dataset,
       'victim' as geography,
       count(*) filter (where victim_country is not null) as with_country,
       count(*) as total,
       max(discovered_date) filter (where victim_country is not null) as most_recent
from public.incidents
union all
select 'threat_actors', 'origin',
       count(*) filter (where origin_country is not null),
       count(*),
       (max(last_seen) filter (where origin_country is not null))::date
from public.threat_actors
union all
select 'threat_actors', 'target',
       count(*) filter (where target_countries is not null and array_length(target_countries, 1) > 0),
       count(*),
       (max(last_seen) filter (where target_countries is not null))::date
from public.threat_actors;

grant select on public.incident_victim_countries to anon, authenticated;
grant select on public.actor_origin_countries to anon, authenticated;
grant select on public.actor_target_countries to anon, authenticated;
grant select on public.country_coverage to anon, authenticated;

commit;
