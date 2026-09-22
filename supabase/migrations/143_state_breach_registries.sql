-- 143: breach notices from any state, and the fields the states actually give
--
-- WHY THIS GENERALISES 141 RATHER THAN REPEATING IT
--
-- California was built as one source. Washington and Oregon publish the same
-- kind of record - a breach notification filed with a state Attorney General -
-- and a third, fourth and fifth function shaped like the first would be five
-- copies of one idea. So the source becomes a family: `state` names which
-- registry a row came from, and adding a state is a parser entry rather than a
-- new table, a new function and a new migration.
--
-- WHAT WAS CHECKED, AND WHAT IS NOT COMING
--
-- Not all fifty states publish a list a machine can read. Probed 22 September:
--
--   California   5,302 notices, paginated HTML table          INGESTED
--   Washington   ~1,900 notices, 38 pages                     INGESTED
--   Oregon       ~1,650 notices, all on one page              INGESTED
--   Texas        401 - a Salesforce portal behind auth
--   New Hampshire 403 - blocks non-browser clients
--   Maine, Montana, Indiana, Vermont  404 at the documented paths
--   Iowa         200, but the page carries no table at all
--
-- So "all state AGs" is not available, and the honest ceiling is the dozen or
-- so states that publish a real list. The three here are the three largest of
-- those, and the framework means the next one costs a parser.
--
-- THE STATES GIVE MORE THAN CALIFORNIA DOES
--
-- California publishes an organisation and two dates. Washington adds how many
-- of its residents were affected and which categories of data were exposed.
-- Oregon adds the date the breach was discovered and the date notice was sent.
--
-- Those are real and they are worth having - `persons_affected` is the closest
-- thing Vigil has ever held to a severity measure grounded in something other
-- than an attacker's own boast. They are nullable because most states publish
-- none of them, and null here means the registry did not say.
--
-- WHAT IS STILL REFUSED
--
-- The cause. Washington's "Information Compromised" lists what was exposed,
-- not how - "Name; Social Security Number; Medical Information" says nothing
-- about ransomware, insider or lost laptop. Nothing in this migration infers
-- one, and `match_status` still stays 'unreviewed' for every row.

begin;

alter table public.victim_disclosures
  add column if not exists state text,
  add column if not exists persons_affected bigint,
  add column if not exists data_types text[],
  add column if not exists discovered_date date;

comment on column public.victim_disclosures.state is
  'US state whose registry published this notice, as a two-letter code. Null '
  'for the SEC filings, which are federal.';
comment on column public.victim_disclosures.persons_affected is
  'As the registry published it. Usually residents of that state only, not the '
  'total affected, so it is a floor rather than a count.';
comment on column public.victim_disclosures.data_types is
  'Categories of data exposed, where the registry lists them. Says nothing '
  'about how the breach happened.';

create index if not exists idx_victim_disclosures_state
  on public.victim_disclosures (state);

-- California was ingested before `state` existed.
update public.victim_disclosures set state = 'CA'
where source = 'ca-ag' and state is null;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('wa-ag', 'Washington Attorney General breach notifications',
   'US state government public record', 'https://www.atg.wa.gov/data-breach-notifications',
   true, true, '2026-09-22',
   'Publishes the number of Washington residents affected and the categories '
     || 'of data exposed, which California does not.'),
  ('or-ag', 'Oregon DOJ breach notifications',
   'US state government public record', 'https://justice.oregon.gov/consumer/DataBreach/',
   true, true, '2026-09-22',
   'Publishes the breach date range, the discovery date and the date notice '
     || 'was sent. The whole list is one page.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      checked_on = excluded.checked_on,
      notes = excluded.notes,
      updated_at = now();

/**
 * Record breach notifications filed with any state regulator.
 *
 * Never matches a notice to an incident and never infers a cause.
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
  v_state text;
  v_earliest date;
  v_latest date;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'unregistered disclosure source: %', coalesce(p_source, '<null>');
  end if;

  with incoming as (
    select distinct on (accession) * from (
      select
        -- No registry issues an identifier, so one is composed from what
        -- distinguishes a row in the registry itself: who, and when.
        p_source || ':' || actor_key(x.company_name) || ':'
          || coalesce(x.incident_date, 'na') || ':' || coalesce(x.reported_date, 'na') as accession,
        btrim(x.company_name) as company_name,
        upper(nullif(btrim(x.state), '')) as state,
        nullif(btrim(x.incident_date), '')::date as incident_date,
        nullif(btrim(x.reported_date), '')::date as reported_date,
        nullif(btrim(x.discovered_date), '')::date as discovered_date,
        x.persons_affected,
        x.data_types,
        x.url
      from jsonb_to_recordset(p_rows) as x(
        company_name text, state text, incident_date text, reported_date text,
        discovered_date text, persons_affected bigint, data_types text[], url text
      )
      where nullif(btrim(x.company_name), '') is not null
    ) c
  ),
  upserted as (
    insert into victim_disclosures
      (accession, company_name, state, filed_date, incident_date, discovered_date,
       persons_affected, data_types, form, filing_url, source, match_status)
    select accession, company_name, state, reported_date, incident_date, discovered_date,
           persons_affected, data_types, 'breach-notice', url, p_source, 'unreviewed'
    from incoming
    on conflict (accession) do update
      set company_name = excluded.company_name,
          state = excluded.state,
          filed_date = excluded.filed_date,
          incident_date = excluded.incident_date,
          discovered_date = excluded.discovered_date,
          -- Only ever fill a null. A registry that stops publishing a figure
          -- it once published must not blank what Vigil already recorded.
          persons_affected = coalesce(victim_disclosures.persons_affected, excluded.persons_affected),
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
    'earliest_reported', v_earliest,
    'latest_reported', v_latest,
    'held_total', (select count(*) from victim_disclosures where source = p_source)
  );
end;
$$;

revoke execute on function public.apply_breach_notices(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_breach_notices(jsonb, text) to service_role;

/**
 * Breach notices by state, for the map and the filters.
 *
 * `persons_affected` is summed only where a registry published it, and the
 * count of rows that did is returned alongside - a total drawn from a third of
 * the rows is not the same claim as one drawn from all of them, and a caller
 * that shows the sum without the denominator is overstating.
 */
create or replace view public.breach_notices_by_state
with (security_invoker = true) as
select
  state,
  count(*) as notices,
  count(persons_affected) as notices_with_a_count,
  sum(persons_affected) as persons_affected_where_published,
  count(*) filter (where data_types is not null) as notices_with_data_types,
  min(filed_date) as earliest,
  max(filed_date) as latest
from public.victim_disclosures
where state is not null
group by state
order by count(*) desc;

grant select on public.breach_notices_by_state to anon, authenticated;

commit;
