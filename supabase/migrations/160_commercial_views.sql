-- 160. What may be resold, for claims and group profiles as well as origins
--
-- STATUS: NOT YET APPLIED.
--
-- WHY
--
-- 136 built the switch for actor origins: source_licences records what each
-- source permits, and actor_origins_commercial blanks any origin a source does
-- not let us sell. Origins were the only data it covered. Measured 26 October
-- 2026, ransomware.live - non-commercial use only, and commercial use only with
-- its owner's written approval (T&C updated 19 August 2026) - supplies far
-- more than origins:
--
--   * 15,204 of 40,886 incidents have it as their only source;
--   * 11,317 victim countries;
--   * every group profile row: 1,718 technique links (62 groups), 842 tools
--     (71 groups) and 998 leak-site addresses (389 groups).
--
-- Nothing stopped any of that from reaching a resold product. This migration
-- extends the switch to all of it. It deletes nothing: the free product keeps
-- every row, and the views below are what anything sold reads instead.
--
-- THE LICENCES, READ ON 26 OCTOBER 2026
--
--   ransomlook       data and API responses CC BY 4.0, per the repository
--                    README. Supplies every claim since 29 May 2026.
--   ransomwatch      Unlicense. Archived 3 March 2026.
--   malpedia         CC BY-NC-SA 3.0. NonCommercial. 1,101 actor rows, names
--                    only. Treated as ETDA is, by the owner's decision of
--                    26 October 2026: kept in the free product, cut from
--                    anything sold.
--   mitre-attack     royalty-free, including commercial use, provided MITRE's
--                    copyright notice and the licence travel with any copy.
--                    Was registered unchecked; now checked.
--   misp-galaxy      dual-licensed CC0 1.0 or 2-clause BSD. Was registered
--                    unchecked; now checked.
--   alienvault-otx   not read. Registered so it is visible, as not for sale.
--
-- Unregistered sources still read as not for sale, which is the point of 136.
-- Registering RansomLook and Ransomwatch is what makes their rows sellable.
--
-- SOURCE IDS ARE SPELT TWO WAYS
--
-- threat_actors.source holds both 'misp-galaxy' (1,079 rows) and 'misp_galaxy'
-- (2,037), and 'alienvault_otx'. source_allows_commercial_use() matched the id
-- exactly, so 2,037 MISP Galaxy actors read as an unknown source. It now
-- compares a normalised id: lower case, underscores as hyphens.
--
-- FIELDS WHOSE SOURCE IS NOT RECORDED
--
-- An incident's victim_country carries its own source. Its sector, website,
-- status and source URL do not: on a row that ransomware.live and RansomLook
-- both reported, nothing says which of them supplied the sector. So those
-- fields are shown only when every source on the row may be sold, and
-- detail_withheld says when they were held back. raw_data is never exposed;
-- it is one source's own record.
--
-- A ransomware.live country is withheld even where ThreatCluster states the
-- same country, because apply_victim_countries (129) fills only empty values
-- and does not keep the agreeing value. Recording it is the refill step in
-- the replacement plan, not this migration.
--
-- WHAT THE VIEWS SHOW TODAY
--
-- Dry run against live data, 26 October 2026, rolled back:
--
--   incidents_commercial       25,686 claims. 7,015 carry a country, 61 have
--                              one withheld, 9,524 have detail withheld.
--   threat_actors_commercial   3,327 of 4,606 actors: 3,326 listed by a
--                              sellable source, 1 by its claims alone.
--   profile views              empty.
--
-- The profile views are empty, because ransomware.live supplied all of it.
-- That is the honest state: a resold product has no technique profiles until
-- ATT&CK and CISA's #StopRansomware advisories are loaded under their own
-- source ids, at which point they appear here with no further change.
--
-- GRANTS
--
-- Revoke everything, then grant read (154, 156): the views are read-only
-- windows onto tables anon can already read.

-- ------------------------------------------------------------------
-- 1. The licences
-- ------------------------------------------------------------------

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('ransomlook', 'RansomLook',
   'CC BY 4.0 (data and API responses)', 'https://github.com/RansomLook/RansomLook',
   true, true, '2026-10-26',
   'The licence is stated in the repository README for content from ransomlook.io, '
     || 'including API responses and datasets. The code is GPL/AGPL, which governs the '
     || 'software, not the data. Supplies every leak-site claim since 29 May 2026.'),
  ('ransomwatch', 'Ransomwatch',
   'Unlicense', 'https://github.com/joshhighet/ransomwatch',
   true, false, '2026-10-26',
   'Archived 3 March 2026. Its rows stay; nothing new arrives. Asks commercial users '
     || 'to consider sponsoring, which is a request, not a term.'),
  ('malpedia', 'Malpedia (Fraunhofer FKIE)',
   'CC BY-NC-SA 3.0', 'https://malpedia.caad.fkie.fraunhofer.de/usage/tos',
   false, true, '2026-10-26',
   'NonCommercial. Supplies 1,101 actor rows, names only: no origins, descriptions or '
     || 'claims. Treated as ETDA is, by the owner''s decision of 26 October 2026: kept in '
     || 'the free product, cut from anything sold.'),
  ('alienvault-otx', 'AlienVault OTX',
   'unchecked', 'https://otx.alienvault.com/',
   false, true, null,
   'Supplies 117 actor rows. Terms not read; registered so the source is visible, and '
     || 'not for sale until someone reads them.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      attribution_required = excluded.attribution_required,
      checked_on = excluded.checked_on,
      notes = excluded.notes,
      updated_at = now();

update public.source_licences
set licence = 'Non-commercial use with attribution. Commercial use only with the owner''s '
      || 'prior written approval. Raw data may not be re-served by API, file or otherwise.',
    licence_url = 'https://www.ransomware.live/t&c',
    checked_on = '2026-10-26',
    notes = 'Terms updated 19 August 2026 (sections 4 to 6). Measured 26 October 2026: '
      || 'sole source of 15,204 incidents, 11,317 victim countries, and every group '
      || 'profile row (techniques, tools, leak sites). The replacement route is kept '
      || 'outside this repository.',
    updated_at = now()
where source_id = 'ransomware.live';

update public.source_licences
set licence = 'ATT&CK Terms of Use: royalty-free, including commercial use; MITRE''s '
      || 'copyright notice and the licence must be reproduced in any copy',
    checked_on = '2026-10-26',
    notes = 'Read 26 October 2026. Anything resold that carries ATT&CK content carries '
      || 'MITRE''s copyright designation with it.',
    updated_at = now()
where source_id = 'mitre-attack';

update public.source_licences
set licence = 'Dual: CC0 1.0 Universal, or 2-clause BSD',
    licence_url = 'https://github.com/MISP/misp-galaxy',
    checked_on = '2026-10-26',
    notes = 'Read 26 October 2026 from the repository licence section. Supplies most of '
      || 'the actor origins Vigil holds.',
    updated_at = now()
where source_id = 'misp-galaxy';

-- ------------------------------------------------------------------
-- 2. One spelling of a source id
-- ------------------------------------------------------------------

create or replace function public.licence_source_id(p_source text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(replace(btrim(coalesce(p_source, '')), '_', '-')), '');
$$;

comment on function public.licence_source_id(text) is
  'The source_licences id for a source as data spells it: lower case, underscores '
  'as hyphens. See migration 160.';

create or replace function public.source_allows_commercial_use(p_source text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select commercial_use from source_licences
     where source_id = licence_source_id(p_source)),
    false
  );
$$;

grant execute on function public.licence_source_id(text) to anon, authenticated, service_role;
grant execute on function public.source_allows_commercial_use(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------
-- 3. The views anything resold reads
-- ------------------------------------------------------------------
--
-- The two large views do not call source_allows_commercial_use() per row. A
-- SQL function with SET search_path is never inlined, and calling it a few
-- times for each of 40,886 incidents took 13.9 s to count the view in the dry
-- run, past PostgREST's 8 s limit. Instead each view reads the sellable ids
-- once (the `licence` CTE) and normalises ids inline, exactly as
-- licence_source_id() does. Dry run on 26 October 2026: a page of 50 in
-- 145 ms, a full count in 2.3 s, the actors view in 0.9 s.

-- A claim appears when at least one source that reported it may be sold.
-- incidents.source is a comma-joined list, e.g. 'ransomwatch, ransomware.live'.
create or replace view public.incidents_commercial
with (security_invoker = true) as
with licence as (
  select source_id from public.source_licences where commercial_use
)
select
  i.id as incident_id,
  i.actor_id,
  i.victim_name,
  i.incident_date,
  i.discovered_date,
  i.claim_date,
  s.sellable as sources,
  case when c.ok then i.victim_country end as victim_country,
  case when c.ok then i.victim_country_source end as victim_country_source,
  (i.victim_country is not null and not c.ok) as victim_country_withheld,
  case when s.all_sellable then i.victim_sector end as victim_sector,
  case when s.all_sellable then i.victim_website end as victim_website,
  case when s.all_sellable then i.status end as status,
  case when s.all_sellable then i.source_url end as source_url,
  (not s.all_sellable
     and (i.victim_sector is not null or i.victim_website is not null
          or i.status is not null or i.source_url is not null)) as detail_withheld
from public.incidents i
cross join lateral (
  select coalesce(array_agg(t.src order by t.src) filter (where t.ok), '{}') as sellable,
         coalesce(bool_and(t.ok), false) as all_sellable
  from (
    select distinct btrim(x) as src,
           lower(replace(btrim(x), '_', '-')) in (select source_id from licence) as ok
    from unnest(string_to_array(coalesce(i.source, ''), ',')) as x
    where btrim(x) <> ''
  ) t
) s
cross join lateral (
  select coalesce(
    lower(replace(btrim(i.victim_country_source), '_', '-')) in (select source_id from licence),
    false) as ok
) c
where cardinality(s.sellable) > 0;

comment on view public.incidents_commercial is
  'Leak-site claims at least one sellable source reported, with fields of '
  'unrecorded provenance held back unless every source may be sold. See 160.';

create or replace view public.actor_techniques_commercial
with (security_invoker = true) as
select actor_id, technique_id, confidence, first_seen, last_seen, source
from public.actor_techniques
where source_allows_commercial_use(source);

create or replace view public.actor_tools_commercial
with (security_invoker = true) as
select actor_id, tool_name, category, first_seen, last_seen, source
from public.actor_tools
where source_allows_commercial_use(source);

create or replace view public.actor_sites_commercial
with (security_invoker = true) as
select actor_id, fqdn, enabled, available, first_seen, last_seen, source
from public.actor_sites
where source_allows_commercial_use(source);

-- An actor appears when a sellable source lists it, or when a sellable source
-- reports a claim by it. An actor only a NonCommercial source names is left
-- out: its name is that source's work.
create or replace view public.threat_actors_commercial
with (security_invoker = true) as
with licence as (
  select source_id from public.source_licences where commercial_use
), claimed as (
  select distinct i.actor_id
  from public.incidents i
  where i.actor_id is not null
    and exists (
      select 1 from unnest(string_to_array(coalesce(i.source, ''), ',')) as x
      where lower(replace(btrim(x), '_', '-')) in (select source_id from licence)
    )
)
select
  ta.id as actor_id,
  ta.name,
  case when lower(replace(btrim(coalesce(ta.source, '')), '_', '-')) in (select source_id from licence)
       then 'source' else 'claims' end as listed_by
from public.threat_actors ta
where lower(replace(btrim(coalesce(ta.source, '')), '_', '-')) in (select source_id from licence)
   or ta.id in (select actor_id from claimed);

comment on view public.threat_actors_commercial is
  'Actors a sellable source lists, or that a sellable source reports a claim '
  'by. listed_by says which. See migration 160.';

revoke all on public.incidents_commercial from anon, authenticated;
revoke all on public.actor_techniques_commercial from anon, authenticated;
revoke all on public.actor_tools_commercial from anon, authenticated;
revoke all on public.actor_sites_commercial from anon, authenticated;
revoke all on public.threat_actors_commercial from anon, authenticated;

grant select on public.incidents_commercial to anon, authenticated, service_role;
grant select on public.actor_techniques_commercial to anon, authenticated, service_role;
grant select on public.actor_tools_commercial to anon, authenticated, service_role;
grant select on public.actor_sites_commercial to anon, authenticated, service_role;
grant select on public.threat_actors_commercial to anon, authenticated, service_role;
