-- 129: a second source for victim country, and a record of where it came from
--
-- WHY
--
-- ransomware.live was the only source that ever supplied victim_country -
-- 11,256 of 11,317 - and it stopped on 29 May 2026. ransomlook, which has run
-- since and holds 7,153 incidents, returns no country field at all: /api/recent
-- and /api/posts were both checked, and the other endpoints 404. So the field
-- did not decay, its single supplier went away, and 28,217 incidents have no
-- country at all.
--
-- That same supplier is the one whose free tier is personal-use only, so the
-- gap and the licence problem were one problem.
--
-- THE SOURCE
--
-- ThreatCluster's Ransomware-Intel (github.com/Jam0k/Ransomware-Intel), a
-- daily CSV marked TLP:CLEAR - "free to use, redistribute, and integrate.
-- Attribution appreciated." That is the thing ransomware.live is not.
--
-- Measured before building any of this:
--
--   country coverage           91% over 90 days, 86% over 365
--   format                     ISO-2, the same as this column
--   matches our missing rows   85%, plain normalised-name join, no fuzzing
--   agrees with what we hold   99% - 916 of 922 overlapping victims
--   cost                       one 1.4 MB fetch, no key, no money
--
-- The 99% matters more than the 91%. It is independently crawled - 705 of
-- 2,898 rows in the 90-day file are first_party=yes from their own crawler -
-- and it still concords with ransomware.live on 922 victims we can check
-- against. A second opinion that agrees is worth more than a first opinion.
--
-- WHAT THIS DOES NOT DO
--
-- It does not overwrite. Where an incident already carries a country and the
-- new source disagrees, the row is left exactly as it is and the disagreement
-- is queued as a finding. Six showed up in the sample, and several look like
-- the new source is the better one - Cablematic Dos Mil SLU is an *SLU*, a
-- Spanish company form, so ES is more likely right than our FR. That is a
-- judgment call, which means it is not one this function gets to make.
--
-- It also does not turn a claim into a confirmation. This is a leak-site
-- aggregator and it says so itself: "Everything is the group's claim, not a
-- confirmed breach." Country is now better sourced; the claim is unchanged.
--
-- PROVENANCE
--
-- victim_country_source records which feed supplied the country, because
-- "where did this come from" stops being answerable the moment two sources
-- write the same column.

begin;

-- The same normalisation actor_key uses, under a name that says what it is
-- being applied to. Victim names arrive with punctuation, case and the odd
-- flag emoji - "TOWILL 🇺🇸" and "TOWILL" are the same company.
create or replace function public.victim_key(n text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g')
$$;

create index if not exists idx_incidents_victim_key
  on public.incidents (public.victim_key(victim_name));

alter table public.incidents
  add column if not exists victim_country_source text;

-- Everything already here came from ransomware.live; it was the only supplier.
update public.incidents
set victim_country_source = 'ransomware.live'
where victim_country is not null and victim_country_source is null;

/**
 * Apply victim countries from a source that is not the only one any more.
 *
 * p_rows: [{ victim, country, source, first_party }]
 *
 * Fills a country only where there is none. Disagreements are recorded, never
 * applied. Returns what it did, so the feed logs a count rather than a shrug.
 */
create or replace function public.apply_victim_countries(p_rows jsonb, p_source text default 'threatcluster')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filled int := 0;
  v_disagreed int := 0;
  v_considered int := 0;
  r record;
begin
  create temp table _incoming on commit drop as
  select victim_key(x.victim) as vkey,
         upper(btrim(x.country)) as country,
         coalesce(x.first_party, false) as first_party
  from jsonb_to_recordset(p_rows) as x(victim text, country text, first_party boolean)
  where x.victim is not null
    and x.country is not null
    and btrim(x.country) <> ''
    and length(btrim(x.country)) = 2;

  select count(*) into v_considered from _incoming;

  -- One country per victim. A first-hand reading beats an aggregated one; if
  -- both are first-hand and they differ, take neither and let it be noticed.
  create temp table _resolved on commit drop as
  select vkey, min(country) as country
  from (
    select vkey, country
    from _incoming i
    where first_party or not exists (
      select 1 from _incoming f where f.vkey = i.vkey and f.first_party
    )
  ) best
  group by vkey
  having count(distinct country) = 1;

  -- Anything this source disagrees with us about, recorded before anything is
  -- written. A victim can appear on several incidents, so this is by victim.
  create temp table _contested on commit drop as
  select distinct inc.victim_name, inc.victim_country as held, res.country as offered, res.vkey
  from public.incidents inc
  join _resolved res on victim_key(inc.victim_name) = res.vkey
  where inc.victim_country is not null
    and inc.victim_country <> res.country;

  -- A contested victim is left alone completely - including its incidents that
  -- have no country yet. Filling those would give one victim two countries
  -- across two rows, which is the product contradicting itself rather than
  -- reporting a disagreement. Queue it and wait for a verdict.
  delete from _resolved res
  using _contested c
  where res.vkey = c.vkey;

  -- Fill what is empty and uncontested.
  -- The alias must not be `r`: that is the loop record below, and PL/pgSQL
  -- resolves the variable before the table, which fails at runtime rather
  -- than at create time.
  with filled as (
    update public.incidents inc
    set victim_country = fill.country,
        victim_country_source = p_source,
        updated_at = now()
    from _resolved fill
    where inc.victim_country is null
      and victim_key(inc.victim_name) = fill.vkey
    returning 1
  )
  select count(*) into v_filled from filled;

  -- Record what disagrees. No row was touched for any of these.
  for r in select victim_name, held, offered from _contested limit 200
  loop
    v_disagreed := v_disagreed + 1;
    perform record_finding(
      'victim_country_disagreement',
      r.victim_name || ': ' || r.held || ' or ' || r.offered,
      'info',
      'open',
      jsonb_build_object(
        'question', 'Which country is right for this victim?',
        'held', r.held,
        'held_source', 'ransomware.live',
        'offered', r.offered,
        'offered_source', p_source,
        'note', 'Neither was applied. The incident still carries the country it had.',
        'why_it_is_close', 'The two sources agree on 99% of the victims both name, so a disagreement is worth reading rather than averaging.'
      )
    );
  end loop;

  return jsonb_build_object(
    'source', p_source,
    'considered', v_considered,
    'filled', v_filled,
    'disagreements_queued', v_disagreed
  );
end;
$$;

-- Following 125: PUBLIC gets EXECUTE by default and anon is a member of it.
-- This writes; only the worker runs it.
revoke execute on function public.apply_victim_countries(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_victim_countries(jsonb, text) to service_role;

commit;

-- VERIFY
--
--   select victim_country_source, count(*) from incidents
--   where victim_country is not null group by victim_country_source;
--
--   select * from country_coverage where dataset = 'incidents';
