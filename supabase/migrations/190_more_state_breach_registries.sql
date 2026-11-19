-- 190. Five more state breach registries, every notice's scope recorded, old notices not queued
--
-- STATUS: APPLIED 19 Nov 2026, about 05:00 UTC, as 190_more_state_breach_registries. Backfill
-- 05:07 UTC: VT 564, MT 6,638, SC 912, ID 262, DE 295; 56 skipped with no reported date.
--
-- WHY
--
-- Tom asked for every state that publishes a list (the 19 Nov 2026 plan, item 3).
-- A survey on 19 Nov 2026 (C:\Users\PSRA User 4\vigil-data\state-ag-survey\SURVEY.md)
-- found five more that publish a plain HTML table like California's, Washington's
-- and Oregon's, each the whole list on one page:
--
--   Vermont         566 notices, 17 Apr - 18 Nov 2026; VT residents; data categories
--   Montana       6,689 notices, May 2015 - Oct 2026; MT residents; breach start date
--   South Carolina  915 notices, Jan 2015 - Nov 2026; SC residents
--   Idaho           262 notices, Jan 2021 - Nov 2026; no count published
--   Delaware        322 notices, Jan 2021 - Jul 2025 (not updated since); DE residents
--
-- Not added: Hawaii (55 notices, none since Apr 2024, mixed date formats),
-- Maryland (anonymous SharePoint lists per year, none for 2026 found), Iowa and
-- Wisconsin (cards and free text, not tables), Texas (Salesforce, unverified
-- without a browser); Maine, New Hampshire and Massachusetts block scripted
-- clients (403); the rest publish PDFs only or no list.
--
-- WHAT CHANGES
--
-- 1. The five are registered in source_licences (apply_breach_notices refuses
--    an unregistered source).
-- 2. apply_breach_notices takes persons_affected_scope from each row. 144 set
--    the scope once, so every notice since has had none: on 19 Nov 2026, 39
--    Washington and 47 Oregon notices carried a count with no scope and fell out
--    of breach_notices_by_state's totals. They are filled in here, and a new
--    row now carries its registry's scope from the Edge Function.
-- 3. Three Oregon names were stored with an entity left in them
--    (Ameriprise "&#160;", L&#205;LL&#201;baby, The North Face&#174;). The Edge
--    Function now decodes numeric entities, so the next run would write them
--    again under a new accession. They are corrected here, accession and all,
--    so the next run updates them instead.
-- 4. The candidate queue (166) asks a person whether a notice is the victim's
--    own account of a claim, for every new notice within 90 days of a claim.
--    Loading 8,700 notices back to 2015 would ask that for years-old matches
--    (the first three states gave 385 open cards). New notices filed in the last
--    90 days are still queued; older ones are stored and not queued. Tom
--    agreed on 19 Nov 2026 ("Ship item 3", with this as the stated default).
-- 5. A notice listed with no reported date is counted and left out
--    (filed_date is required), instead of failing the state's whole batch.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('vt-ag', 'Vermont Attorney General security breach notices', 'US state government public record',
   'https://ago.vermont.gov/categories/security-breach-notices', true, true, '2026-11-19',
   'Number of Vermont residents affected and the categories of data breached. The page holds notices from 17 Apr 2026 on. 190.'),
  ('mt-ag', 'Montana DOJ reported data breaches', 'US state government public record',
   'https://dojmt.gov/office-of-consumer-protection/reported-data-breaches/', true, true, '2026-11-19',
   'Breach start and end dates and the number of Montanans affected; about 6,700 notices from 2015, one page. 190.'),
  ('sc-ag', 'South Carolina Department of Consumer Affairs security breach notices', 'US state government public record',
   'https://consumer.sc.gov/identity-theft-unit/security-breach-notices', true, true, '2026-11-19',
   'Date reported and the number of South Carolina residents affected (sometimes blank). 190.'),
  ('id-ag', 'Idaho Attorney General security breach notifications', 'US state government public record',
   'https://www.ag.idaho.gov/consumer-protection/security-breaches/', true, true, '2026-11-19',
   'Entity and notification date only; no count published. 190.'),
  ('de-ag', 'Delaware Attorney General security breach notification database', 'US state government public record',
   'https://attorneygeneral.delaware.gov/fraud/cpu/securitybreachnotification/database/', true, true, '2026-11-19',
   'Breach dates, reported date and potentially affected Delaware residents. No notice after 11 Jul 2025 on 19 Nov 2026. 190.')
on conflict (source_id) do nothing;

-- 2. The scope of every count already held.
update public.victim_disclosures
set persons_affected_scope = case source when 'wa-ag' then 'state_residents' when 'or-ag' then 'total' end
where source in ('wa-ag', 'or-ag') and persons_affected is not null and persons_affected_scope is null;

-- 3. The three Oregon names, decoded as the Edge Function now decodes them.
update public.victim_disclosures v
set company_name = x.fixed,
    accession = 'or-ag:' || actor_key(x.fixed) || ':'
      || coalesce(v.incident_date::text, 'na') || ':' || coalesce(v.filed_date::text, 'na')
from (values
  ('Ameriprise Financial, Inc.&#160;', 'Ameriprise Financial, Inc.'),
  ('L&#205;LL&#201;baby', 'LÍLLÉbaby'),
  ('VF Outdoor, LLC doing business as The North Face&#174;', 'VF Outdoor, LLC doing business as The North Face®')
) as x(stored, fixed)
where v.source = 'or-ag' and v.company_name = x.stored;

create or replace function public.apply_breach_notices(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new int := 0;
  v_total int := 0;
  v_state text;
  v_earliest date;
  v_latest date;
  v_skipped int := 0;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'unregistered disclosure source: %', coalesce(p_source, '<null>');
  end if;

  -- filed_date is required. A notice the registry lists with no reported date
  -- (2 in Vermont, 26 in Montana, 2 in South Carolina, 26 in Delaware on
  -- 19 Nov 2026) is counted and left out rather than failing the whole batch.
  select count(*) into v_skipped
  from jsonb_to_recordset(p_rows) as x(company_name text, reported_date text)
  where nullif(btrim(x.company_name), '') is not null and nullif(btrim(x.reported_date), '') is null;

  with incoming as (
    select distinct on (accession) * from (
      select
        p_source || ':' || actor_key(x.company_name) || ':'
          || coalesce(x.incident_date, 'na') || ':' || coalesce(x.reported_date, 'na') as accession,
        btrim(x.company_name) as company_name,
        upper(nullif(btrim(x.state), '')) as state,
        nullif(btrim(x.incident_date), '')::date as incident_date,
        nullif(btrim(x.reported_date), '')::date as reported_date,
        nullif(btrim(x.discovered_date), '')::date as discovered_date,
        x.persons_affected,
        case when x.persons_affected is null then null
             when x.persons_affected_scope in ('state_residents', 'total') then x.persons_affected_scope
        end as persons_affected_scope,
        x.data_types,
        x.url
      from jsonb_to_recordset(p_rows) as x(
        company_name text, state text, incident_date text, reported_date text,
        discovered_date text, persons_affected bigint, persons_affected_scope text,
        data_types text[], url text
      )
      where nullif(btrim(x.company_name), '') is not null
        and nullif(btrim(x.reported_date), '') is not null
    ) c
  ),
  upserted as (
    insert into victim_disclosures
      (accession, company_name, state, filed_date, incident_date, discovered_date,
       persons_affected, persons_affected_scope, data_types, form, filing_url, source, match_status)
    select accession, company_name, state, reported_date, incident_date, discovered_date,
           persons_affected, persons_affected_scope, data_types, 'breach-notice', url, p_source, 'unreviewed'
    from incoming
    on conflict (accession) do update
      set company_name = excluded.company_name,
          state = excluded.state,
          filed_date = excluded.filed_date,
          incident_date = excluded.incident_date,
          discovered_date = excluded.discovered_date,
          persons_affected = coalesce(victim_disclosures.persons_affected, excluded.persons_affected),
          persons_affected_scope = coalesce(victim_disclosures.persons_affected_scope, excluded.persons_affected_scope),
          data_types = coalesce(victim_disclosures.data_types, excluded.data_types)
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) into v_new, v_total from upserted;

  select min(filed_date), max(filed_date), max(state)
    into v_earliest, v_latest, v_state
  from victim_disclosures where source = p_source;

  return jsonb_build_object(
    'source', p_source,
    'state', v_state,
    'seen', v_total,
    'new', v_new,
    'skipped_no_reported_date', v_skipped,
    'earliest_reported', v_earliest,
    'latest_reported', v_latest,
    'held_total', (select count(*) from victim_disclosures where source = p_source)
  );
end;
$function$;

revoke execute on function public.apply_breach_notices(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_breach_notices(jsonb, text) to service_role;

-- 4. Queue only notices filed in the last 90 days.
create or replace function public.breach_notices_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform queue_breach_notice_candidates(
      (select coalesce(array_agg(id), '{}') from new_rows
        where source <> 'sec-edgar'
          and filed_date >= current_date - 90));
  exception when others then
    perform record_finding('breach_notice_candidate_failed', 'queue_breach_notice_candidates on new notices',
      'warning', 'open', jsonb_build_object('error', sqlerrm, 'at', now()::text));
  end;
  return null;
end;
$function$;

comment on function public.breach_notices_inserted() is
  'Queues a candidate card for a new breach notice filed in the last 90 days that names a claimed victim. '
  'Older notices are stored, not queued. Migration 190.';

revoke execute on function public.breach_notices_inserted() from public, anon, authenticated;

commit;
