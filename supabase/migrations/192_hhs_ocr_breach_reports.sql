-- 192. HHS Office for Civil Rights breach reports, beside the state registries
--
-- HIPAA requires a covered entity (or its business associate) to report every
-- breach of unsecured protected health information to the Secretary of HHS,
-- and HITECH section 13402(e)(4) requires the Secretary to publish those that
-- affect 500 or more people. OCR publishes them in its Breach Portal
-- (https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf) as two lists:
--
--   Under Investigation  reports from the last 24 months OCR has open
--                        (701 on 19 Nov 2026, 12 Oct 2023 to 16 Oct 2026)
--   Archive              reports OCR has closed, or older than 24 months
--                        (7,391, 21 Oct 2009 to 6 Oct 2026)
--
-- Each is the victim's own report to a federal regulator under a legal duty,
-- the same class of evidence as the state notices and SEC 8-Ks already in
-- victim_disclosures, and it is the largest healthcare-specific list Vigil can
-- hold: 8,092 reports, every cause, not only ransomware.
--
-- WHAT HHS PUBLISHES, AND WHERE EACH FIELD GOES
--
--   Name of Covered Entity            company_name
--   State                             business_location (the entity's state,
--                                     as SEC's business_location is the
--                                     filer's). Not `state`: that column is
--                                     the registry's state, and
--                                     breach_notices_by_state groups by it.
--   Covered Entity Type               covered_entity_type, as given
--   Individuals Affected              persons_affected, scope 'total'
--   Breach Submission Date            filed_date
--   Type of Breach                    breach_cause, as given, cause_source
--                                     'hhs-ocr' (174's column for a
--                                     registry's own record of the cause)
--   Location of Breached Information  breach_locations, split on commas
--   Business Associate Present        business_associate_present
--   Web Description                   regulator_description, verbatim (OCR
--                                     writes one when it closes a case: 7,146
--                                     of the archive, none of the open list)
--   which list                        regulator_status: 'under_investigation'
--                                     or 'archived'
--
-- Nothing is derived. 1,274 archive descriptions contain the word "ransom";
-- that stays in OCR's words, and no row is called ransomware because its
-- description or name says so. "Hacking/IT Incident" is HHS's category, not a
-- finding about who did it.
--
-- IDENTITY
--
-- HHS publishes no report number. Name, state and submission date identify a
-- report except in 46 groups on 19 Nov 2026 (one business associate filed 7
-- reports on 11 Aug 2025, each for a different client), so the accession is
--   hhs-ocr:<actor_key(name)>:<state or na>:<submission date>:<n>
-- where n is the report's place in its group, ordered by entity type, breach
-- type, location, business associate flag and count. The Edge Function builds
-- it over both lists together, so a report keeps its accession when it moves
-- from Under Investigation to Archive. If OCR revises a count inside a group of
-- duplicates two rows can trade places; the set of reports held stays right.
--
-- Unlike the state registries, HHS's figures are taken as current on every
-- run: OCR revises counts (Change Healthcare's was revised more than once) and
-- moves cases to the archive. An unchanged row is not rewritten.
--
-- LICENCE
--
-- A list the Secretary publishes by statute, a work of the US government
-- (17 U.S.C. 105). No terms of use on the portal; robots.txt is absent (404),
-- checked 19 Nov 2026. HHS's web disclaimers restrict only licensed stock
-- images and the department's seals and logos. Commercial use allowed;
-- attribution not required, and Vigil credits OCR anyway.
--
-- THE REVIEW QUEUE
--
-- New rows filed in the last 90 days go through 190's trigger like any notice:
-- a report naming an organization a leak site claimed gets a
-- breach_notice_candidate card. The portal has no page per report, so
-- queue_breach_notice_candidates now puts HHS's own fields in the card's
-- details (the card shows every detail it is given). A backfill's older rows
-- are stored and not queued, as in 190.
--
-- WHO CAN REACH WHAT
--
-- The new columns are on victim_disclosures, which anon and authenticated
-- already read through victim_disclosures_read; HHS's fields are public
-- records and are meant to be read the same way. apply_hhs_breach_reports is
-- SECURITY DEFINER and service_role only: the hhs-ocr-breaches Edge Function
-- calls it. queue_breach_notice_candidates keeps its grants, restated.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('hhs-ocr',
   'HHS Office for Civil Rights breach portal (breaches of unsecured protected health information affecting 500 or more people)',
   'US public domain (17 U.S.C. 105); published under HITECH section 13402(e)(4)',
   'https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf',
   true, false, '2026-11-19',
   'Both lists, Under Investigation (701) and Archive (7,391), read from the portal''s CSV export. '
   'HHS''s own fields are kept as given; nothing is derived from names or descriptions. 192.')
on conflict (source_id) do nothing;

alter table public.victim_disclosures
  add column if not exists covered_entity_type text,
  add column if not exists breach_locations text[],
  add column if not exists business_associate_present boolean,
  add column if not exists regulator_description text,
  add column if not exists regulator_status text;

alter table public.victim_disclosures
  drop constraint if exists victim_disclosures_regulator_status_check;
alter table public.victim_disclosures
  add constraint victim_disclosures_regulator_status_check
  check (regulator_status is null or regulator_status in ('under_investigation', 'archived'));

comment on column public.victim_disclosures.breach_cause is
  'The registry''s own record of the cause, as given (174). Washington: databreachcause from data.wa.gov sb4j-ca4h. '
  'HHS OCR: Type of Breach (192). cause_source says which.';
comment on column public.victim_disclosures.covered_entity_type is
  'HHS OCR only (192): Healthcare Provider, Health Plan, Business Associate or Healthcare Clearing House, as given.';
comment on column public.victim_disclosures.breach_locations is
  'HHS OCR only (192): Location of Breached Information, as given, split on commas (Network Server, Email, Paper/Films...).';
comment on column public.victim_disclosures.business_associate_present is
  'HHS OCR only (192): Business Associate Present, Yes or No.';
comment on column public.victim_disclosures.regulator_description is
  'HHS OCR only (192): OCR''s Web Description, verbatim. Written when OCR closes a case; empty while it is under investigation.';
comment on column public.victim_disclosures.regulator_status is
  'HHS OCR only (192): which list the report was last read from, under_investigation or archived.';

-- p_rows: [{ accession, company_name, entity_state, entity_type, persons_affected,
--            submitted, breach_type, locations, business_associate, description,
--            status, url }]
create or replace function public.apply_hhs_breach_reports(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_seen int;
  v_new int;
  v_changed int;
  v_archived int;
  v_revised int;
begin
  if not exists (select 1 from source_licences where source_id = 'hhs-ocr') then
    raise exception 'unregistered disclosure source: hhs-ocr';
  end if;

  with incoming as (
    select distinct on (x.accession)
      x.accession,
      btrim(x.company_name) as company_name,
      upper(nullif(btrim(x.entity_state), '')) as entity_state,
      nullif(btrim(x.entity_type), '') as entity_type,
      x.persons_affected,
      x.submitted::date as submitted,
      nullif(btrim(x.breach_type), '') as breach_type,
      nullif(x.locations, '{}') as locations,
      x.business_associate,
      nullif(btrim(x.description), '') as description,
      x.status,
      x.url
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      accession text, company_name text, entity_state text, entity_type text,
      persons_affected bigint, submitted text, breach_type text, locations text[],
      business_associate boolean, description text, status text, url text
    )
    where x.accession like 'hhs-ocr:%'
      and nullif(btrim(x.company_name), '') is not null
      and nullif(btrim(x.submitted), '') is not null
      and x.status in ('under_investigation', 'archived')
    order by x.accession
  ),
  before as (
    select d.accession, d.regulator_status, d.persons_affected
      from victim_disclosures d
      join incoming i using (accession)
  ),
  upserted as (
    insert into victim_disclosures as d
      (accession, company_name, business_location, filed_date, persons_affected,
       persons_affected_scope, form, filing_url, source, match_status,
       breach_cause, cause_source, cause_recorded_at, covered_entity_type,
       breach_locations, business_associate_present, regulator_description, regulator_status)
    select accession, company_name, entity_state, submitted, persons_affected,
           case when persons_affected is not null then 'total' end,
           'hipaa-breach-report', url, 'hhs-ocr', 'unreviewed',
           breach_type, case when breach_type is not null then 'hhs-ocr' end,
           case when breach_type is not null then now() end, entity_type,
           locations, business_associate, description, status
      from incoming
    on conflict (accession) do update
      set company_name = excluded.company_name,
          business_location = excluded.business_location,
          filed_date = excluded.filed_date,
          persons_affected = excluded.persons_affected,
          persons_affected_scope = excluded.persons_affected_scope,
          filing_url = excluded.filing_url,
          breach_cause = excluded.breach_cause,
          cause_source = excluded.cause_source,
          cause_recorded_at = case when d.breach_cause is distinct from excluded.breach_cause
                                   then now() else d.cause_recorded_at end,
          covered_entity_type = excluded.covered_entity_type,
          breach_locations = excluded.breach_locations,
          business_associate_present = excluded.business_associate_present,
          -- OCR writes the description at closing; a later blank never erases one.
          regulator_description = coalesce(excluded.regulator_description, d.regulator_description),
          regulator_status = excluded.regulator_status
      where d.source = 'hhs-ocr'
        and ((d.company_name, d.business_location, d.filed_date, d.persons_affected,
              d.breach_cause, d.covered_entity_type, d.breach_locations,
              d.business_associate_present, d.regulator_status, d.filing_url)
             is distinct from
             (excluded.company_name, excluded.business_location, excluded.filed_date,
              excluded.persons_affected, excluded.breach_cause, excluded.covered_entity_type,
              excluded.breach_locations, excluded.business_associate_present,
              excluded.regulator_status, excluded.filing_url)
          or (excluded.regulator_description is not null
              and d.regulator_description is distinct from excluded.regulator_description))
    returning d.accession, (xmax = 0) as inserted, d.regulator_status, d.persons_affected
  )
  select
    (select count(*) from incoming),
    count(*) filter (where u.inserted),
    count(*) filter (where not u.inserted),
    count(*) filter (where not u.inserted and b.regulator_status = 'under_investigation'
                       and u.regulator_status = 'archived'),
    count(*) filter (where not u.inserted and b.persons_affected is distinct from u.persons_affected)
    into v_seen, v_new, v_changed, v_archived, v_revised
  from upserted u
  left join before b using (accession);

  return jsonb_build_object(
    'source', 'hhs-ocr',
    'seen', v_seen,
    'new', v_new,
    'changed', v_changed,
    'moved_to_archive', v_archived,
    'count_revised', v_revised,
    'held_total', (select count(*) from victim_disclosures where source = 'hhs-ocr'),
    'latest_submitted', (select max(filed_date) from victim_disclosures where source = 'hhs-ocr')
  );
end;
$function$;

comment on function public.apply_hhs_breach_reports(jsonb) is
  'Stores HHS OCR breach portal reports in victim_disclosures with HHS''s own fields, updating a report OCR revised or '
  'moved to the archive. Called by the hhs-ocr-breaches Edge Function in chunks. Migration 192.';

revoke execute on function public.apply_hhs_breach_reports(jsonb) from public, anon, authenticated;
grant execute on function public.apply_hhs_breach_reports(jsonb) to service_role;

-- The card for an HHS report carries HHS's fields, because the portal has no
-- page per report to open. Otherwise as before (166, 190).
create or replace function public.queue_breach_notice_candidates(p_notice_ids uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select n.id, n.source, n.state, n.company_name, n.filed_date, n.incident_date,
           n.filing_url, n.persons_affected,
           case when n.source = 'hhs-ocr' then jsonb_strip_nulls(jsonb_build_object(
             'hhs_entity_state', n.business_location,
             'hhs_entity_type', n.covered_entity_type,
             'hhs_breach_type', n.breach_cause,
             'hhs_location', array_to_string(n.breach_locations, ', '),
             'hhs_business_associate', n.business_associate_present,
             'hhs_list', n.regulator_status,
             'hhs_description', n.regulator_description,
             'hhs_find', 'The portal has no page per report: search its list for the entity name.'
           )) else '{}'::jsonb end as hhs,
           jsonb_agg(jsonb_build_object(
             'claimed_victim', i.victim_name,
             'claimed_by', coalesce(a.name, 'unknown'),
             'claim_discovered', i.discovered_date::text,
             'days_apart', least(abs(coalesce(n.incident_date, n.filed_date) - i.discovered_date),
                                 abs(n.filed_date - i.discovered_date))
           ) order by least(abs(coalesce(n.incident_date, n.filed_date) - i.discovered_date),
                            abs(n.filed_date - i.discovered_date))) as claims,
           min(least(abs(coalesce(n.incident_date, n.filed_date) - i.discovered_date),
                     abs(n.filed_date - i.discovered_date))) as nearest
    from victim_disclosures n
    join incidents i on company_key(i.victim_name) = company_key(n.company_name)
    left join threat_actors a on a.id = i.actor_id
    where n.id = any (p_notice_ids)
      and n.source <> 'sec-edgar'
      and n.filed_date is not null
      and i.discovered_date is not null
      and length(company_key(n.company_name)) > 3
      and least(abs(coalesce(n.incident_date, n.filed_date) - i.discovered_date),
                abs(n.filed_date - i.discovered_date)) <= 90
    group by n.id, n.source, n.state, n.company_name, n.filed_date, n.incident_date,
             n.filing_url, n.persons_affected, n.business_location, n.covered_entity_type,
             n.breach_cause, n.breach_locations, n.business_associate_present,
             n.regulator_status, n.regulator_description
  loop
    v_n := v_n + 1;
    perform record_finding(
      'breach_notice_candidate',
      r.company_name || ': ' || coalesce(r.state, upper(split_part(r.source, '-', 1)))
        || ' breach notice reported ' || r.filed_date
        || coalesce(', breach ' || r.incident_date, ''),
      'info',
      'open',
      jsonb_build_object(
        'question', 'Is this breach notice the victim''s own account of the attack a group claimed, or a different incident?',
        'instruction', 'Read the notice. A breach notice covers every cause - a lost laptop, a vendor, misdirected mail - and says nothing about ransomware unless it says so. Same name and close dates are why it is asked, not evidence of an answer.',
        'registry', r.source,
        'reported', r.filed_date::text,
        'breach_date', r.incident_date::text,
        'notice', r.filing_url,
        'persons_affected', r.persons_affected,
        'nearest_days_apart', r.nearest,
        'claims', r.claims,
        'window', 'Claims discovered within 90 days of the breach date or the report date. Wider gaps are not asked.'
      ) || r.hhs
    );
  end loop;
  return v_n;
end;
$function$;

revoke execute on function public.queue_breach_notice_candidates(uuid[]) from public, anon, authenticated;
grant execute on function public.queue_breach_notice_candidates(uuid[]) to service_role;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('hhs-ocr-breaches', 1440, false,
   'HHS OCR breach portal, both lists (Under Investigation and Archive), into victim_disclosures as source hhs-ocr (192). '
   'Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
