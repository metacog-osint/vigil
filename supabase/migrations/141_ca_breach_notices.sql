-- 141: a second regulator, and 5,350 incidents that are not ransomware
--
-- THE PROBLEM THIS IS AIMED AT
--
-- Vigil holds 39,575 incidents. Every one is a ransomware leak-site claim.
-- Against that, the whole non-ransomware corpus is about 500 rows: 286 vendor
-- reports, 148 ICS advisories, 56 MITRE campaigns, 16 government advisories.
--
-- So the platform is ransomware-heavy not because the other sources are
-- missing but because one table outnumbers them eighty to one. Adding a feed
-- of a hundred rows does not change that. Only a high-volume source of
-- non-ransomware events does.
--
-- California's Attorney General publishes every breach notification submitted
-- under Civil Code 1798.29 and 1798.82: about 5,350 of them, back to 2012,
-- with the organisation, the date of the breach and the date it was reported.
-- They cover every cause - intrusion, insider, lost device, misdirected mail,
-- vendor compromise - so the great majority are not ransomware at all.
--
-- WHY IT GOES IN victim_disclosures AND NOT A NEW TABLE
--
-- Migration 139 argued that vendor research and government advisories are
-- different kinds of claim and belong apart. This is the opposite case. An
-- SEC 8-K Item 1.05 and a California breach notice are the *same* kind: the
-- victim telling a regulator, under a legal duty, that something happened to
-- them. Different regulator, same claim. Splitting them would mean every
-- question about "what did the victim themselves say" had to be asked twice.
--
-- WHAT IS ADDED
--
--   incident_date   California publishes the date of the breach, which the SEC
--                   filings do not carry. Null for those, and null is right -
--                   an 8-K says when it was filed, not when the attack was.
--
-- accession is reused as the deduplication key. California issues no
-- identifier, so it is composed from the organisation and the two dates, which
-- is what the portal itself uses to distinguish rows: the same organisation
-- appears repeatedly with different breach dates.
--
-- WHAT IS NOT DONE, DELIBERATELY
--
-- No row is matched to an incident. `match_status` stays 'unreviewed'. A
-- California notice naming "Acme Corp" and a leak-site claim against "Acme
-- Corp" may be the same event or two unrelated ones, and 130's header already
-- records why that is queued rather than joined - Stryker filed with the SEC
-- in April and was claimed by Qilin in July, which may well be two incidents.
--
-- The cause of each breach is also not imported, because the list page does
-- not carry it. Inferring "ransomware" from an organisation name would be
-- inventing the very thing this source was added to avoid.

begin;

alter table public.victim_disclosures
  add column if not exists incident_date date;

comment on column public.victim_disclosures.incident_date is
  'When the breach occurred, where the regulator publishes it. Null for SEC '
  '8-K filings, which give the filing date only.';

create index if not exists idx_victim_disclosures_source
  on public.victim_disclosures (source);
create index if not exists idx_victim_disclosures_incident_date
  on public.victim_disclosures (incident_date desc nulls last);

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('ca-ag', 'California Attorney General breach notifications',
   'US state government public record',
   'https://oag.ca.gov/privacy/databreach/list', true, true, '2026-09-21',
   'Submitted under California Civil Code 1798.29 and 1798.82 and published as '
     || 'a public record. About 5,350 notices back to 2012, covering every '
     || 'cause of breach rather than ransomware alone.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      checked_on = excluded.checked_on,
      notes = excluded.notes,
      updated_at = now();

/**
 * Record breach notifications filed with a state regulator.
 *
 * Never matches a notice to an incident. That is a judgment about whether two
 * records describe one event, and it belongs to a person.
 */
create or replace function public.apply_breach_notices(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int := 0;
  v_total int := 0;
  v_earliest date;
  v_latest date;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'unregistered disclosure source: %', coalesce(p_source, '<null>');
  end if;

  with incoming as (
    select
      -- California issues no identifier. The portal distinguishes rows by
      -- organisation plus both dates, and so does this.
      p_source || ':' || actor_key(x.company_name) || ':'
        || coalesce(x.incident_date, 'na') || ':' || coalesce(x.reported_date, 'na') as accession,
      btrim(x.company_name) as company_name,
      nullif(btrim(x.incident_date), '')::date as incident_date,
      nullif(btrim(x.reported_date), '')::date as reported_date,
      x.url
    from jsonb_to_recordset(p_rows) as x(
      company_name text, incident_date text, reported_date text, url text
    )
    where nullif(btrim(x.company_name), '') is not null
  ),
  upserted as (
    insert into victim_disclosures
      (accession, company_name, filed_date, incident_date, form, filing_url, source, match_status)
    select accession, company_name, reported_date, incident_date,
           'breach-notice', url, p_source, 'unreviewed'
    from incoming
    on conflict (accession) do update
      set company_name = excluded.company_name,
          filed_date = excluded.filed_date,
          incident_date = excluded.incident_date
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) into v_new, v_total from upserted;

  select min(filed_date), max(filed_date) into v_earliest, v_latest
  from victim_disclosures where source = p_source;

  return jsonb_build_object(
    'source', p_source,
    'seen', v_total,
    'new', v_new,
    'earliest_reported', v_earliest,
    'latest_reported', v_latest,
    'held_total', (select count(*) from victim_disclosures where source = p_source)
  );
end;
$$;

revoke execute on function public.apply_breach_notices(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_breach_notices(jsonb, text) to service_role;

commit;
