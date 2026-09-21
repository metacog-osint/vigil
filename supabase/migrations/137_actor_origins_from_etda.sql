-- 137: where a threat actor is from, from a source that actually says
--
-- THE GAP
--
-- 483 of 4,504 threat actors have an origin country. 10.7%. Three hundred and
-- seventy-five actors that have posted real incidents say nothing at all about
-- where they are from, and the map's Attackers layer draws only the tenth that
-- do.
--
-- Everything Vigil holds today comes from two sources - MISP Galaxy and MITRE
-- ATT&CK - and neither is trying to be an attribution register.
--
-- WHAT ETDA ADDS, MEASURED BEFORE IT WAS BUILT
--
-- ETDA/ThaiCERT's "Threat Group Cards" is 503 actors with 1,788 names, each
-- name recording who gave it - CrowdStrike, Microsoft, MITRE, SecureWorks,
-- Kaspersky. Matched against Vigil's 4,504 actors on exact normalised name or
-- alias:
--
--   188  would fill a null origin_country      (+39% on the 483 held today)
--   253  already had one, and AGREED
--     1  already had one and DISAGREED         -> queued, never applied
--   124  matched an entry ETDA marks [Unknown] -> stays null, deliberately
--
-- 253 agreements against 1 disagreement is the same kind of check that
-- justified ThreatCluster in 129, and it matters more than the coverage: the
-- two corpora were built independently and they concur.
--
-- The one disagreement is OnionDog - Vigil says North Korea, ETDA says South
-- Korea. That is a real dispute in the public reporting, not a parsing error,
-- and it is exactly what the review queue is for.
--
-- [Unknown] IS AN ANSWER, AND IT IS KEPT
--
-- 137 of ETDA's 503 entries record the country as "[Unknown]". That is the
-- source declining to guess, and 124 of them match an actor Vigil holds.
-- Writing anything into origin_country for those - even a blank string - would
-- convert someone's honest refusal into Vigil's silence. They stay null, which
-- is what null already means here.
--
-- CONFIDENCE STAYS NULL
--
-- origin_confidence is documented as "attribution confidence as published by
-- the source". ETDA publishes none. MISP's rows carry 50 because MISP said 50.
-- Writing 50 here because it looks consistent would be inventing a number and
-- then rendering it in a tooltip as though a source had said it.
--
-- LICENCE
--
-- CC BY-NC-SA 4.0. NonCommercial, read from the API response's own licence
-- field, and registered in source_licences (136) with commercial_use = false.
-- Every row this writes carries origin_source = 'etda', so
-- actor_origins_commercial excludes it from paid access with no audit needed.

begin;

/**
 * Fill actor origin countries from a named source.
 *
 * Only ever fills a null. An origin already recorded - by another source or by
 * a person - is never overwritten; a different answer is queued instead.
 */
create or replace function public.apply_actor_origins(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filled int := 0;
  v_agreed int := 0;
  v_disagreed int := 0;
  v_unmatched int := 0;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    -- A source with no registered licence cannot be judged for resale, so it
    -- does not get to write attribution. See 136.
    raise exception 'unregistered attribution source: %', coalesce(p_source, '<null>');
  end if;

  create temp table _incoming on commit drop as
  select x.etda_actor,
         upper(nullif(btrim(x.country), '')) as country,
         x.url,
         actor_key(n) as name_key
  from jsonb_to_recordset(p_rows) as x(
    etda_actor text, country text, url text, names text[]
  )
  cross join lateral unnest(x.names) as n
  where nullif(btrim(x.country), '') is not null
    and actor_key(n) <> '';

  create index on _incoming (name_key);

  -- Flatten every name Vigil knows an actor by - its own and each alias - into
  -- one indexed lookup. The obvious version of this join put the alias unnest
  -- in a correlated subquery, which made it O(actors x incoming) across 4,504
  -- actors and 1,788 names, and it hit the statement timeout at 11 seconds.
  create temp table _actor_names on commit drop as
  select ta.id as actor_id, actor_key(ta.name) as name_key from threat_actors ta
  where actor_key(ta.name) <> ''
  union
  select ta.id, actor_key(a)
  from threat_actors ta, unnest(coalesce(ta.aliases, '{}')) a
  where actor_key(a) <> '';

  create index on _actor_names (name_key);
  analyze _actor_names;
  analyze _incoming;

  -- One row per actor: a group with five aliases must not count five times,
  -- and an actor two entries claim with two different countries is refused.
  create temp table _matched on commit drop as
  select ta.id as actor_id,
         ta.name as actor_name,
         ta.origin_country as existing_country,
         min(i.country) as country,
         count(distinct i.country) as distinct_countries,
         min(i.etda_actor) as etda_actor,
         min(i.url) as url
  from _actor_names an
  join _incoming i on i.name_key = an.name_key
  join threat_actors ta on ta.id = an.actor_id
  group by ta.id, ta.name, ta.origin_country;

  -- Fill only what is empty, and only where the source is unambiguous.
  with applied as (
    update threat_actors ta
       set origin_country = m.country,
           origin_source = p_source,
           -- Deliberately null: ETDA publishes no confidence, and this column
           -- means "confidence as published by the source".
           origin_confidence = null,
           updated_at = now()
      from _matched m
     where ta.id = m.actor_id
       and ta.origin_country is null
       and m.distinct_countries = 1
    returning 1
  )
  select count(*) into v_filled from applied;

  -- Both counts ignore ambiguous matches. When an actor matches entries naming
  -- two different countries, min(country) and min(etda_actor) come from
  -- different rows, so the pair is incoherent - Sandworm was reported as "held
  -- RU, proposed IR, entry Energetic Bear/Dragonfly", which is three
  -- unrelated facts. Those are the ambiguous case and are queued as such.
  select count(*) filter (where distinct_countries = 1 and existing_country is not null and existing_country = country),
         count(*) filter (where distinct_countries = 1 and existing_country is not null and existing_country <> country)
    into v_agreed, v_disagreed
  from _matched;

  -- A country Vigil already holds, contradicted. Never applied; asked.
  perform record_finding(
    'actor_origin_disagreement',
    m.actor_name,
    'warning',
    'open',
    jsonb_build_object(
      'actor', m.actor_name,
      'held', m.existing_country,
      'proposed', m.country,
      'proposed_by', p_source,
      'source_entry', m.etda_actor,
      'url', m.url,
      'question',
      'Vigil records this actor as ' || m.existing_country || ' and ' || p_source
        || ' records it as ' || m.country || '. Which is right, or is it both?'
    )
  )
  from _matched m
  where m.distinct_countries = 1
    and m.existing_country is not null
    and m.existing_country <> m.country;

  -- One actor claimed by two entries with two different countries.
  perform record_finding(
    'actor_origin_ambiguous',
    m.actor_name,
    'warning',
    'open',
    jsonb_build_object(
      'actor', m.actor_name,
      'proposed_by', p_source,
      'distinct_countries', m.distinct_countries,
      'question',
      p_source || ' matches this actor through more than one entry, and those '
        || 'entries name different countries. Which entry is this actor?'
    )
  )
  from _matched m
  where m.distinct_countries > 1;

  select count(*) into v_unmatched
  from threat_actors where origin_country is null;

  return jsonb_build_object(
    'source', p_source,
    'filled', v_filled,
    'agreed', v_agreed,
    'queued_disagreement', v_disagreed,
    'still_without_origin', v_unmatched
  );
end;
$$;

revoke execute on function public.apply_actor_origins(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_actor_origins(jsonb, text) to service_role;

commit;
