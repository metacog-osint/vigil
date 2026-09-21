-- 132: more than one government, and a queue for the ones we cannot read
--
-- WHAT 131 ASSUMED
--
-- `apply_attributed_activity` hard-codes CISA. The table has a `source`
-- column defaulting to 'cisa', the function never sets it, and the result
-- object says `'source', 'cisa'` regardless. That was fine when CISA was the
-- only government publishing into this table. It no longer is.
--
-- WHICH GOVERNMENTS ARE ACTUALLY WORTH READING
--
-- The coverage analysis written on 21 September named four national CERTs as
-- the cheapest remaining work — NCSC-UK, CERT-EU, ACSC and CCCS — on the
-- grounds that they publish the same shape of RSS as CISA. Every one of those
-- four was checked before this migration was written, and the claim was
-- mostly wrong:
--
--   NCSC-UK    https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml
--              20 items: 13 blogs, 6 news, 1 guidance. The six news items
--              include four attributions, among them "UK and partners expose
--              Russian state-supported actors for new 'zero-click' phishing
--              campaign" and "UK and allies expose spyware used by Iranian
--              state actors". This one is real, and it is now ingested.
--
--   CERT-EU    security-advisories-rss returns ten items, all of the form
--              "2026-012: Critical Vulnerabilities in Check Point Products".
--              Vulnerability notices. No attribution, in any of them.
--              threat-intelligence-rss returns monthly "Cyber Brief"
--              round-ups, each covering dozens of unrelated events. Filing a
--              monthly digest as one attributed event would be a category
--              error, so CERT-EU is deliberately NOT ingested here.
--
--   CCCS       cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en
--              works, and is entirely vendor patch notices: "SolarWinds
--              security advisory (AV26-941)". No attribution.
--
--   ACSC       cyber.gov.au refused every request. Feed not located.
--
--   JPCERT     jpcert.or.jp/rss/jpcert.rdf works, 29 items, Japanese-language
--              vulnerability alerts. No attribution.
--
-- So of five, one carries government attribution. The earlier note said the
-- first two were the cheapest work available; the fetch had been verified but
-- not the content. Recorded here because the same mistake is easy to repeat:
-- a feed returning 200 and ten items is not a feed that says who did it.
--
-- WHAT GETS QUEUED INSTEAD OF GUESSED
--
-- NCSC writes "Iranian cyber targeting of dissidents, activists and
-- journalists". That names a country and does not say what its relationship
-- to the actors is — not state, not affiliated, not aligned. There is no
-- honest value in attribution_strength for it, so the row is stored with no
-- attribution at all and a finding is queued for a person to rule on.
--
-- The alternative was to invent a mapping, which is what produced the false
-- "Pro-Russia Hacktivists -> state" reading that 131's header describes. The
-- queue exists precisely so that this class of call is made by someone.

begin;

-- Where a row came from. 'cisa' stays the default so 131's ten rows keep
-- their meaning without a backfill.
alter table public.attributed_activity
  drop constraint if exists attributed_activity_source_check;
alter table public.attributed_activity
  add constraint attributed_activity_source_check
  check (source in ('cisa', 'ncsc-uk'));

create index if not exists idx_attributed_activity_source
  on public.attributed_activity (source);

/**
 * Record advisories from a named government source.
 *
 * Upserts by advisory_id. An advisory that is updated keeps its row and moves
 * last_seen. `p_source` is required now: a row whose origin is unknown cannot
 * be judged, and every caller knows which feed it read.
 */
create or replace function public.apply_attributed_activity(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int := 0;
  v_attributed int := 0;
  v_queued int := 0;
begin
  if p_source is null or p_source not in ('cisa', 'ncsc-uk') then
    raise exception 'unknown attributed-activity source: %', coalesce(p_source, '<null>');
  end if;

  with incoming as (
    select x.advisory_id, x.title, x.summary, x.published::date as published, x.url,
           x.attributed_country, x.attribution_phrase, x.attribution_strength,
           x.target_countries, x.target_sectors, x.unresolved_country
    from jsonb_to_recordset(p_rows) as x(
      advisory_id text, title text, summary text, published text, url text,
      attributed_country text, attribution_phrase text, attribution_strength text,
      target_countries text[], target_sectors text[], unresolved_country text
    )
    where x.advisory_id is not null and x.title is not null and x.published is not null
  ),
  upserted as (
    insert into attributed_activity
      (advisory_id, title, summary, published, url, source, attributed_country,
       attribution_phrase, attribution_strength, target_countries, target_sectors)
    select advisory_id, title, summary, published, url, p_source, attributed_country,
           attribution_phrase, attribution_strength, target_countries, target_sectors
    from incoming
    on conflict (advisory_id) do update
      set title = excluded.title,
          summary = excluded.summary,
          source = excluded.source,
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

  -- An advisory that names a country without saying what its relationship to
  -- the actors is. Stored unattributed above; queued here so a person decides
  -- rather than a regular expression.
  select count(*) into v_queued
  from jsonb_to_recordset(p_rows) as x(unresolved_country text)
  where x.unresolved_country is not null;

  perform record_finding(
    'attribution_unstated',
    x.advisory_id,
    'info',
    'open',
    jsonb_build_object(
      'source', p_source,
      'title', x.title,
      'url', x.url,
      'country_named', x.unresolved_country,
      'question',
      'The title names a country but not the actors'' relationship to it. '
        || 'Is this state, affiliated, nexus, aligned, or none of them?'
    )
  )
  from jsonb_to_recordset(p_rows) as x(
    advisory_id text, title text, url text, unresolved_country text
  )
  where x.unresolved_country is not null;

  return jsonb_build_object(
    'source', p_source,
    'advisories_new', v_new,
    'with_attribution', v_attributed,
    'queued_for_review', v_queued
  );
end;
$$;

revoke execute on function public.apply_attributed_activity(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_attributed_activity(jsonb, text) to service_role;

-- The single-argument form from 131 is gone: leaving it in place would let a
-- caller write a row whose source silently defaulted to CISA when it came
-- from NCSC, which is the kind of quiet wrong answer this project is about.
drop function if exists public.apply_attributed_activity(jsonb);

/**
 * Which government said it, alongside what it said.
 *
 * The 131 view aggregated by country alone. With two sources that hides the
 * thing a reader most needs: whether two governments independently named the
 * same country, or whether one did twice.
 */
create or replace view public.attributed_activity_by_country
with (security_invoker = true) as
-- New columns go last: create-or-replace cannot insert one in the middle of
-- an existing view, and the frontend selects these by name anyway.
select attributed_country as country_code,
       count(*) as advisories,
       count(*) filter (where attribution_strength = 'state') as state_attributed,
       min(published) as earliest,
       max(published) as latest,
       array_agg(distinct attribution_phrase) as phrases_used,
       count(distinct source) as sources,
       array_agg(distinct source) as sources_used
from public.attributed_activity
where attributed_country is not null
group by attributed_country
order by count(*) desc;

grant select on public.attributed_activity_by_country to anon, authenticated;

commit;
