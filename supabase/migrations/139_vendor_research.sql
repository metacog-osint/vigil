-- 139: what a vendor published, and the questions it raises, kept apart
--
-- WHY THIS IS NOT attributed_activity
--
-- Migration 131 argued that a leak-site post and a government advisory are
-- different kinds of claim and belong in different tables, because putting
-- them together forces every query to treat them alike. The same argument
-- applies here and points the same way.
--
-- A CISA advisory is an investigation by a government that can subpoena, and
-- it states its attribution in the title, precisely, because that is where the
-- care goes. A vendor blog post is research by a company with commercial
-- interests, and its attribution - where it exists at all - is three
-- paragraphs in and hedged. Both are worth having. Filing them in one table
-- would mean the map's footer reading "8 of 296 advisories name a country"
-- where the honest figure for governments is 8 of 16.
--
-- WHY NOTHING HERE IS PARSED FOR ATTRIBUTION
--
-- Measured on 21 September across 279 titles from eight vendor feeds - Unit
-- 42, Talos, Microsoft, Securelist, SentinelOne, ESET, Check Point and
-- GreyNoise - **zero** carried attribution a parser could read. Six named a
-- nationality, and all six named a victim or a language:
--
--   "NightEagle targets Russian companies"        Russia is the target
--   "targeted spyware campaign in Pakistan"       Pakistan is the target
--   "a Chinese-speaking actor turned Brazilian
--    government sites into an SEO weapon"         a language, Brazil is target
--
-- A nationality regex over vendor titles would have been wrong six times out
-- of six. So this table stores reports and queues questions. It never writes
-- an attribution, and there is no code path here that can.
--
-- WHAT IS MATCHED, AND THE ONE THAT NEARLY WENT WRONG
--
-- Vendor titles do carry the actor's name reliably - "Mustang Panda targets
-- India's government and energy sectors" - and Vigil already knows Mustang
-- Panda is CN. Event from the vendor, country from the actor record: that join
-- is how a vendor report becomes country-attributed activity without the
-- vendor having named a country.
--
-- Matching every actor name was tried first and is unsafe. Vigil holds
-- ransomware brands named "global", "Russian", "storm", "payload" and "snake",
-- and on the sample titles:
--
--   "An AI-Orchestrated Global Campaign"   matched an actor named "global"
--   "NightEagle targets Russian companies" matched an actor named "Russian"
--
-- The second is the dangerous one: a report about Russian *victims* linking to
-- an actor called "Russian". So matching is restricted to actors that are
-- named groups - an APT or nation-state type, or one carrying an origin from
-- MITRE, MISP or ETDA - which removes both, and drops the candidate set from
-- 5,498 names to 2,322.
--
-- One common English word survives that filter: "karma", a ransomware brand
-- ETDA attributes to Iran. It is stopped by name below. That list is expected
-- to grow by one entry at a time, and growing it is cheap because a bad match
-- produces a queued question rather than a recorded fact.

begin;

-- `linguistic`: weaker than everything already in the scale.
--
-- GreyNoise on 21 September: "This MCA is a suspected Chinese speaker possibly
-- working in UTC+8 based on the operational timeline and copious amounts of
-- Chinese language comments contained within their custom tools and scripts."
--
-- That is a claim about what language someone writes code comments in. It is
-- not `state`, not `affiliated`, not `nexus`, and not even `aligned` - which
-- at least asserts sympathy with a country. A Chinese speaker in UTC+8 may be
-- in China, Taiwan, Singapore, Malaysia, the Philippines or Western Australia,
-- or in the diaspora anywhere.
--
-- Recording that as CN would be a worse error than the "Pro-Russia Hacktivists
-- -> state" reading this project already caught, because that one at least had
-- Russia in it. The value exists so the claim can be recorded at its true
-- weight once a person rules on it, and so the map can draw it as visibly
-- weaker than the rest.
alter table public.attributed_activity
  drop constraint if exists attributed_activity_attribution_strength_check;
alter table public.attributed_activity
  add constraint attributed_activity_attribution_strength_check
  check (attribution_strength in
    ('state', 'affiliated', 'nexus', 'aligned', 'criminal', 'linguistic'));

create table if not exists public.vendor_reports (
  id uuid primary key default gen_random_uuid(),

  source text not null,
  url text not null unique,
  title text not null,
  summary text,
  published date,

  -- Never written by ingestion. A person may set these through the review
  -- queue after reading the report; until then the honest value is null.
  attributed_country text,
  attribution_strength text
    check (attribution_strength is null or attribution_strength in
      ('state', 'affiliated', 'nexus', 'aligned', 'criminal', 'linguistic')),
  attribution_phrase text,
  attribution_decided_by text,
  attribution_decided_at timestamptz,

  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

comment on table public.vendor_reports IS
  'Threat research published by vendors. Attribution columns are never written '
  'by ingestion: vendor attribution lives in prose and is queued for a person. '
  'See migration 139.';

create index if not exists idx_vendor_reports_source on public.vendor_reports (source);
create index if not exists idx_vendor_reports_published on public.vendor_reports (published desc);

alter table public.vendor_reports enable row level security;

drop policy if exists vendor_reports_read on public.vendor_reports;
create policy vendor_reports_read on public.vendor_reports
  for select to anon, authenticated using (true);

grant select on public.vendor_reports to anon, authenticated;

-- A candidate link between a report and an actor Vigil already knows. Proposed
-- by name matching, never applied: `confirmed` stays null until a person says.
create table if not exists public.vendor_report_actors (
  report_id uuid not null references public.vendor_reports(id) on delete cascade,
  actor_id uuid not null references public.threat_actors(id) on delete cascade,
  matched_name text not null,
  confirmed boolean,
  decided_by text,
  decided_at timestamptz,
  first_seen timestamptz not null default now(),
  primary key (report_id, actor_id)
);

alter table public.vendor_report_actors enable row level security;

drop policy if exists vendor_report_actors_read on public.vendor_report_actors;
create policy vendor_report_actors_read on public.vendor_report_actors
  for select to anon, authenticated using (true);

grant select on public.vendor_report_actors to anon, authenticated;

-- Single-word actor names that are ordinary English and would match prose.
-- Only names that survive the named-group filter need to be here.
create table if not exists public.actor_name_stoplist (
  name_key text primary key,
  reason text not null
);

insert into public.actor_name_stoplist (name_key, reason) values
  (actor_key('karma'),
   'A ransomware brand ETDA attributes to Iran, and an ordinary English word. '
     || 'Would match prose like "karma catches up with" in any vendor title.')
on conflict (name_key) do nothing;

grant select on public.actor_name_stoplist to anon, authenticated;
alter table public.actor_name_stoplist enable row level security;
drop policy if exists actor_name_stoplist_read on public.actor_name_stoplist;
create policy actor_name_stoplist_read on public.actor_name_stoplist
  for select to anon, authenticated using (true);

-- Vendor blog content is the vendor's copyright. Vigil stores the title, the
-- URL, a short RSS summary and its own findings - standard feed aggregation -
-- and never the article body. None of these terms has been read against that
-- use, so all are registered unchecked and NOT sellable, which is the safe
-- default source_allows_commercial_use already applies to anything unknown.
insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('greynoise', 'GreyNoise Labs research', 'Vendor copyright; RSS metadata only',
   'https://www.greynoise.io/blog', false, true, null,
   'The research blog, not the API. api.greynoise.io returns an IP''s classification and geolocation - where the box is, not who rented it.'),
  ('acronis', 'Acronis Threat Research Unit', 'Vendor copyright; RSS metadata only',
   'https://www.acronis.com/en-us/tru/', false, true, null,
   'Named "Red Heron", which GreyNoise then cited. Feed is mixed with MSP product posts, so many items carry no research at all.'),
  ('eset', 'ESET WeLiveSecurity', 'Vendor copyright; RSS metadata only',
   'https://www.welivesecurity.com/', false, true, null, 'Largest archive of the eight checked.'),
  ('unit42', 'Palo Alto Unit 42', 'Vendor copyright; RSS metadata only',
   'https://unit42.paloaltonetworks.com/', false, true, null, null),
  ('talos', 'Cisco Talos', 'Vendor copyright; RSS metadata only',
   'https://blog.talosintelligence.com/', false, true, null, null),
  ('microsoft-security', 'Microsoft Security Blog', 'Vendor copyright; RSS metadata only',
   'https://www.microsoft.com/en-us/security/blog/', false, true, null, null),
  ('securelist', 'Kaspersky Securelist', 'Vendor copyright; RSS metadata only',
   'https://securelist.com/', false, true, null, null),
  ('checkpoint', 'Check Point Research', 'Vendor copyright; RSS metadata only',
   'https://research.checkpoint.com/', false, true, null, null)
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      notes = excluded.notes,
      updated_at = now();

/**
 * Record vendor research, and queue every judgment it raises.
 *
 * Writes no attribution under any circumstances. Returns what it stored and
 * what it asked.
 */
create or replace function public.apply_vendor_research(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int := 0;
  v_actor_links int := 0;
  v_attr_candidates int := 0;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'unregistered vendor source: %', coalesce(p_source, '<null>');
  end if;

  -- The ids come out of the upsert itself. Re-finding them afterwards with a
  -- "last_seen within a minute" filter would be a clock-dependent guess that
  -- silently misses rows on a slow run. CREATE TABLE AS needs a SELECT, so the
  -- data-modifying statement is a CTE and the SELECT reads from it.
  create temp table _touched on commit drop as
  with incoming as (
    select x.url, x.title, x.summary,
           nullif(btrim(x.published), '')::date as published
    from jsonb_to_recordset(p_rows) as x(
      url text, title text, summary text, published text
    )
    where x.url is not null and x.title is not null
  ),
  upserted as (
    insert into vendor_reports (source, url, title, summary, published)
    select p_source, url, title, summary, published from incoming
    on conflict (url) do update
      set title = excluded.title,
          summary = excluded.summary,
          last_seen = now()
    returning id as report_id, url, (xmax = 0) as inserted
  )
  select * from upserted;

  select count(*) filter (where inserted) into v_new from _touched;

  -- Actors worth matching: named groups, not ransomware brand words. See the
  -- header for the two false positives this filter removes.
  create temp table _named_actors on commit drop as
  select id as actor_id, name from threat_actors
  where (actor_type in ('apt', 'nation-state')
         or origin_country is not null
         or origin_source in ('mitre-attack', 'misp-galaxy', 'etda'))
    and length(name) >= 5
    and actor_key(name) not in (select name_key from actor_name_stoplist)
  union
  select ta.id, a from threat_actors ta, unnest(coalesce(ta.aliases, '{}')) a
  where (ta.actor_type in ('apt', 'nation-state')
         or ta.origin_country is not null
         or ta.origin_source in ('mitre-attack', 'misp-galaxy', 'etda'))
    and length(a) >= 5
    and actor_key(a) not in (select name_key from actor_name_stoplist);

  with candidates as (
    select t.report_id, na.actor_id, na.name as matched_name
    from _touched t
    join vendor_reports vr on vr.id = t.report_id
    join _named_actors na
      on vr.title ~* ('\m' || regexp_replace(na.name, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M')
  ),
  linked as (
    insert into vendor_report_actors (report_id, actor_id, matched_name)
    select report_id, actor_id, matched_name from candidates
    on conflict (report_id, actor_id) do nothing
    returning 1
  )
  select count(*) into v_actor_links from linked;

  -- A report whose title or summary carries wording that might be attribution.
  -- The phrase is quoted exactly; nothing infers a country from it.
  perform record_finding(
    'vendor_attribution_candidate',
    vr.url,
    'info',
    'open',
    jsonb_build_object(
      'source', p_source,
      'title', vr.title,
      'url', vr.url,
      -- The phrase the parser actually matched, not the whole summary, so a
      -- reviewer sees what triggered the question.
      'phrase', x.attribution_phrase,
      'question',
      'This report may attribute the activity it describes. Read it and decide '
        || 'whether it names a country, and at what strength - state, '
        || 'affiliated, nexus, aligned, criminal, or linguistic. A language or '
        || 'timezone observation is linguistic, not a country.'
    )
  )
  from vendor_reports vr
  join jsonb_to_recordset(p_rows) as x(url text, attribution_phrase text)
    on x.url = vr.url
  where x.attribution_phrase is not null;

  select count(*) into v_attr_candidates
  from jsonb_to_recordset(p_rows) as x(attribution_phrase text)
  where x.attribution_phrase is not null;

  return jsonb_build_object(
    'source', p_source,
    'reports_new', v_new,
    'actor_links_proposed', v_actor_links,
    'attribution_candidates_queued', v_attr_candidates
  );
end;
$$;

revoke execute on function public.apply_vendor_research(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_vendor_research(jsonb, text) to service_role;

commit;
