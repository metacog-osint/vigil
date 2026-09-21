-- 136: which source may be sold, recorded as data rather than as memory
--
-- WHY THIS EXISTS NOW
--
-- Vigil is about to ingest ETDA/ThaiCERT's Threat Group Cards, which would
-- raise actor country coverage from 10.7% to about 14.9% - 188 actors that
-- currently say nothing. It is published under CC BY-NC-SA 4.0.
--
-- NonCommercial. That is the same class of constraint as ransomware.live,
-- which already supplies every group profile and 11,256 victim countries and
-- already has to be replaced before Vigil is sold. Taking a second one on
-- without a way to remove it would double a problem that is already the
-- largest commercial risk in the project.
--
-- The owner's condition for accepting ETDA was precise: "we just need to be
-- able to cut it from paid access when the time comes." This migration is that
-- ability, and it is built before the data arrives rather than after.
--
-- HOW THE CUT WORKS
--
-- Every attributed value already records which source produced it -
-- threat_actors.origin_source, attributed_activity.source, incidents.source.
-- What was missing is what each of those sources permits. That is a fact about
-- the world, it changes when a licence changes, and it was living in a
-- markdown table and in people's heads.
--
-- So: source_licences holds it, `commercial_use` is the switch, and
-- actor_origins_commercial is the view a paid tier reads instead of the table.
-- Cutting ETDA out is then one UPDATE, not an audit.
--
-- WHAT IS DELIBERATELY NOT DONE HERE
--
-- Nothing is hidden from the current product. Vigil today is not sold, so
-- every row stays visible and the view sits unused beside the table. Removing
-- data that is lawfully usable today, on the chance of a sale later, would
-- make the product worse now for no gain.
--
-- `checked_on` is null for sources nobody has verified. An unchecked licence
-- is not a permissive one, and a blank is more honest than a guess - the same
-- rule DATA_SOURCES.md already states.

begin;

create table if not exists public.source_licences (
  source_id text primary key,
  display_name text not null,
  licence text not null,
  licence_url text,

  -- The switch. False means: exclude from anything sold.
  commercial_use boolean not null,

  -- CC BY and OGL both require it; recording it here means a new view that
  -- shows located data cannot forget.
  attribution_required boolean not null default false,

  -- Null means nobody has read the terms. Not the same as unrestricted.
  checked_on date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.source_licences is
  'What each data source permits. commercial_use = false means the values it '
  'produced must be excluded from paid access; see actor_origins_commercial.';
comment on column public.source_licences.checked_on is
  'Null means the terms have not been read. An unchecked licence is not a '
  'permissive one.';

alter table public.source_licences enable row level security;

drop policy if exists source_licences_read on public.source_licences;
create policy source_licences_read on public.source_licences
  for select to anon, authenticated using (true);

grant select on public.source_licences to anon, authenticated;

-- What is known on 21 September 2026. Checked directly where checked_on is
-- set; the rest are carried from the project's own records and are marked
-- unchecked rather than assumed.
insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('etda', 'ETDA / ThaiCERT Threat Group Cards',
   'CC BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
   false, true, '2026-09-21',
   'NonCommercial. Read from the licence field of the API response itself. '
     || '503 actors, 366 with a real country. Accepted on the condition that it '
     || 'can be cut from paid access, which is what this table is for.'),

  ('ransomware.live', 'Ransomware.live',
   'Free tier: personal use only', 'https://www.ransomware.live/',
   false, true, null,
   'Carried from the project records, not re-checked. Supplies all group '
     || 'profiles and 11,256 victim countries, so this is the largest '
     || 'commercial exposure in the project.'),

  ('cisa', 'CISA advisories', 'US public domain',
   'https://www.cisa.gov/', true, false, '2026-09-21',
   'A work of the US government. No restriction.'),

  ('ncsc-uk', 'NCSC-UK', 'Open Government Licence v3.0',
   'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
   true, true, '2026-09-21',
   'Free to use and redistribute including commercially, provided the source '
     || 'is acknowledged. Every row stores the advisory URL and the source.'),

  ('sec-edgar', 'SEC EDGAR', 'US public domain',
   'https://www.sec.gov/', true, false, '2026-09-21',
   'A work of the US government. No restriction.'),

  ('ofac', 'OFAC SDN list', 'US public domain',
   'https://ofac.treasury.gov/', true, false, '2026-09-21',
   'A work of the US government. No restriction.'),

  ('threatcluster', 'ThreatCluster Ransomware-Intel', 'TLP:CLEAR',
   'https://github.com/Jam0k/Ransomware-Intel', true, true, '2026-09-21',
   'Free to use, redistribute and integrate. Attribution appreciated and given.'),

  ('db-ip', 'DB-IP indicator location', 'CC BY 4.0',
   'https://db-ip.com/', true, true, null,
   'Attribution required wherever located data is shown - currently the IOC '
     || 'search page and the Help methodology.'),

  ('misp-galaxy', 'MISP Galaxy', 'unchecked', null, true, true, null,
   'Widely published as CC0 but NOT verified against the source. Supplies most '
     || 'of the actor origin countries Vigil holds, so this is worth checking '
     || 'properly before anything is sold.'),

  ('mitre-attack', 'MITRE ATT&CK', 'unchecked',
   'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/',
   true, true, null,
   'MITRE permits use with attribution; the exact terms have not been read '
     || 'against this use.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      attribution_required = excluded.attribution_required,
      checked_on = excluded.checked_on,
      notes = excluded.notes,
      updated_at = now();

/**
 * May values from this source be sold?
 *
 * Unknown sources return false. A source nobody has registered is a source
 * nobody has checked, and the safe answer to "may we sell this" is no.
 */
create or replace function public.source_allows_commercial_use(p_source text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select commercial_use from source_licences where source_id = p_source),
    false
  );
$$;

grant execute on function public.source_allows_commercial_use(text) to anon, authenticated;

/**
 * Actor origin, restricted to what may be sold.
 *
 * This is the switch the owner asked for. A paid tier reads this instead of
 * threat_actors.origin_country; cutting a source out is one UPDATE to
 * source_licences and nothing else.
 *
 * An actor whose only attribution came from a NonCommercial source appears
 * here with a null country rather than being dropped - the actor is still
 * real, and "we cannot tell you where this one is from" is the honest thing
 * to show, not a missing row.
 */
create or replace view public.actor_origins_commercial
with (security_invoker = true) as
select
  ta.id as actor_id,
  ta.name,
  case when source_allows_commercial_use(ta.origin_source)
       then ta.origin_country end as origin_country,
  case when source_allows_commercial_use(ta.origin_source)
       then ta.origin_confidence end as origin_confidence,
  case when source_allows_commercial_use(ta.origin_source)
       then ta.origin_source end as origin_source,
  -- So a caller can tell "no attribution exists" from "attribution exists but
  -- may not be sold". Those are different answers and the product should not
  -- collapse them.
  (ta.origin_country is not null
     and not source_allows_commercial_use(ta.origin_source)) as origin_withheld_for_licence
from public.threat_actors ta;

grant select on public.actor_origins_commercial to anon, authenticated;

commit;
