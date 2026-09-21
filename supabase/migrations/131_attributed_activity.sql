-- 131: activity a government attributed, which ransomware leak sites cannot show
--
-- THE HOLE THIS FILLS
--
-- All 39,534 incidents Vigil holds come from three ransomware leak-site
-- trackers. That means Vigil can only record an attack if the attacker chose
-- to publish it for extortion.
--
-- The consequence is visible on the map. Vigil holds 60 threat actors
-- attributed to Iran - APT33, APT35, APT39, APT42, Charming Kitten - and
-- fifty-nine of them have zero incidents. The only one with any is Moses
-- Staff, with 16, because Moses Staff posts to leak sites. Every Iranian group
-- that behaves like a state actor is invisible, however much credible
-- reporting exists about it.
--
-- CISA, FBI, NSA and their partners publish joint advisories naming
-- state-affiliated activity against named sectors. AA26-097A, 6 April 2026,
-- updated 22 July: "Iranian-Affiliated Cyber Actors Exploit Programmable Logic
-- Controllers Across US Critical Infrastructure" - Water and Wastewater,
-- Energy, Government Facilities. That is public domain, authoritative, and
-- nowhere in this database.
--
-- WHY A SEPARATE TABLE
--
-- A leak-site post and a government advisory are not the same kind of claim.
-- One says "we breached this named company on this date" and is made by the
-- attacker. The other says "these actors are targeting this sector" and is
-- made by a government that has investigated. They differ in subject,
-- specificity, and who is asserting.
--
-- Putting them in one table would force every query to treat them alike, which
-- is the conflation this project refuses everywhere else. So they sit apart and
-- the map draws them as separate layers.
--
-- ATTRIBUTION IS QUOTED, NOT INFERRED
--
-- Vigil does not decide that an advisory is about Iran. CISA says so, in the
-- title, and Vigil records what CISA said along with the words it used.
--
-- The words matter, and flattening them to a country code would destroy the
-- distinction the advisories are careful to draw:
--
--   Iranian-Affiliated Cyber Actors          affiliated
--   Russian State-Sponsored / State-Supported state
--   China-Nexus Covert Networks               nexus
--   Pro-Russia Hacktivists                    aligned - explicitly not state
--
-- "Pro-Russia hacktivists" and "Russian state-sponsored actors" are different
-- assertions about different people. attribution_phrase keeps the source's own
-- wording; attribution_strength records which of those four it is; and
-- attributed_country is a convenience for the map, never the whole claim.

begin;

create table if not exists public.attributed_activity (
  id uuid primary key default gen_random_uuid(),

  -- The advisory itself. Facts, as published.
  advisory_id text not null unique,          -- AA26-097A
  title text not null,
  summary text,
  published date not null,
  url text not null,
  source text not null default 'cisa',
  source_type text not null default 'government_advisory',

  -- What the source says about who, in its own words.
  attributed_country text,                   -- IR
  attribution_phrase text,                   -- 'Iranian-Affiliated Cyber Actors'
  attribution_strength text
    check (attribution_strength in ('state', 'affiliated', 'nexus', 'aligned', 'criminal')),

  -- What the source says about where and what.
  target_countries text[],
  target_sectors text[],

  raw jsonb default '{}'::jsonb,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists idx_attributed_activity_country
  on public.attributed_activity (attributed_country);
create index if not exists idx_attributed_activity_published
  on public.attributed_activity (published desc);

alter table public.attributed_activity enable row level security;

-- Government advisories are public information and Vigil publishes the
-- ransomware claims alongside them, so this is readable by anyone.
drop policy if exists attributed_activity_read on public.attributed_activity;
create policy attributed_activity_read on public.attributed_activity
  for select to anon, authenticated using (true);

grant select on public.attributed_activity to anon, authenticated;

/**
 * Record advisories. Upserts by advisory_id; an advisory that is updated keeps
 * its row and moves last_seen.
 */
create or replace function public.apply_attributed_activity(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int := 0;
  v_attributed int := 0;
begin
  with incoming as (
    select x.advisory_id, x.title, x.summary, x.published::date as published, x.url,
           x.attributed_country, x.attribution_phrase, x.attribution_strength,
           x.target_countries, x.target_sectors
    from jsonb_to_recordset(p_rows) as x(
      advisory_id text, title text, summary text, published text, url text,
      attributed_country text, attribution_phrase text, attribution_strength text,
      target_countries text[], target_sectors text[]
    )
    where x.advisory_id is not null and x.title is not null and x.published is not null
  ),
  upserted as (
    insert into attributed_activity
      (advisory_id, title, summary, published, url, attributed_country,
       attribution_phrase, attribution_strength, target_countries, target_sectors)
    select advisory_id, title, summary, published, url, attributed_country,
           attribution_phrase, attribution_strength, target_countries, target_sectors
    from incoming
    on conflict (advisory_id) do update
      set title = excluded.title,
          summary = excluded.summary,
          attributed_country = excluded.attributed_country,
          attribution_phrase = excluded.attribution_phrase,
          attribution_strength = excluded.attribution_strength,
          target_countries = excluded.target_countries,
          target_sectors = excluded.target_sectors,
          last_seen = now()
    returning (xmax = 0) as inserted, attributed_country
  )
  select count(*) filter (where inserted),
         count(*) filter (where attributed_country is not null)
    into v_new, v_attributed
  from upserted;

  return jsonb_build_object(
    'source', 'cisa',
    'advisories_new', v_new,
    'with_attribution', v_attributed
  );
end;
$$;

revoke execute on function public.apply_attributed_activity(jsonb) from public, anon, authenticated;
grant execute on function public.apply_attributed_activity(jsonb) to service_role;

/**
 * What a country is implicated in, by a government, with the wording used.
 *
 * Deliberately separate from anything counting ransomware victims: these are
 * not comparable quantities and a single "attacks by country" number that
 * mixed them would be meaningless.
 */
create or replace view public.attributed_activity_by_country
with (security_invoker = true) as
select attributed_country as country_code,
       count(*) as advisories,
       count(*) filter (where attribution_strength = 'state') as state_attributed,
       min(published) as earliest,
       max(published) as latest,
       array_agg(distinct attribution_phrase) as phrases_used
from public.attributed_activity
where attributed_country is not null
group by attributed_country
order by count(*) desc;

grant select on public.attributed_activity_by_country to anon, authenticated;

commit;
