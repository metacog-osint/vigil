-- 166: ask the state-notice question properly, and pre-fill the country one
--
-- WHY
--
-- 165 closed 583 findings that called state breach notices SEC filings. The
-- question underneath them is a real one: when a California, Washington or
-- Oregon notice names an organisation a ransomware group also claimed, at
-- about the same time, is the notice the victim's own account of that attack?
-- 141 and 143 chose not to ask it. On 15 Nov 2026 it was decided that it should
-- be asked, labelled for what it is, and only where the dates are close.
--
-- WHAT IS ASKED
--
-- One finding per notice, `breach_notice_candidate`, when the organisation's
-- company_key equals a claimed victim's and the claim's discovered_date is
-- within 90 days of the notice's breach date or its report date. The finding
-- lists every claim that qualifies, with the gap in days. It is a question,
-- never a link: victim_disclosures.match_status stays 'unreviewed', as 141
-- designed, and nothing is matched until a person says so.
--
-- Measured 15 Nov 2026: 858 notice-claim name pairs; 434 within 90 days,
-- covering 377 notices and 285 claims; 220 notices within 30 days.
--
-- 90 days is a reading aid, not a verdict. A breach date outside it does not
-- prove two incidents, and inside it does not prove one; it only orders the
-- queue so the likely ones are read first. The rest are simply not asked.
--
-- HOW IT KEEPS UP
--
-- Two statement-level triggers, one on new notices, one on new claims, both
-- calling queue_breach_notice_candidates() for the notices touched. A claim
-- posted after the notice is filed is found as well as the reverse. Each
-- trigger catches its own errors and records them as a finding, because a
-- review-queue helper must never be the reason an ingest fails. No worker
-- deploy and no change to run_data_quality_checks.
--
-- An expression index on incidents(company_key(victim_name)) makes both
-- directions an index lookup. 130's SEC scan uses the same join and gains too.
--
-- AND THE COUNTRY QUESTION
--
-- victim_country_disagreement (43 open) asks which of two countries is right
-- and shows only the two codes. review_country_evidence adds what Vigil
-- already holds about the victim: its website, the website's top-level domain
-- and, where that is a country code, which side it agrees with. 28 of the 43
-- have a website. A .de domain is evidence, not an answer: a German brand can
-- be a US company. So it is shown, never applied.

begin;

create index if not exists idx_incidents_company_key
  on public.incidents (public.company_key(victim_name));

/**
 * Recompute the breach_notice_candidate finding for each notice given.
 *
 * Returns how many notices carry at least one qualifying claim.
 */
create or replace function public.queue_breach_notice_candidates(p_notice_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select n.id, n.source, n.state, n.company_name, n.filed_date, n.incident_date,
           n.filing_url, n.persons_affected,
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
             n.filing_url, n.persons_affected
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
      )
    );
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.queue_breach_notice_candidates(uuid[]) from public, anon, authenticated;
grant execute on function public.queue_breach_notice_candidates(uuid[]) to service_role;

/** New notices: ask about each one that matches a claim. */
create or replace function public.breach_notices_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform queue_breach_notice_candidates(
      (select coalesce(array_agg(id), '{}') from new_rows where source <> 'sec-edgar'));
  exception when others then
    perform record_finding('breach_notice_candidate_failed', 'queue_breach_notice_candidates on new notices',
      'warning', 'open', jsonb_build_object('error', sqlerrm, 'at', now()::text));
  end;
  return null;
end;
$$;

/** New claims: re-ask about any notice whose organisation they name. */
create or replace function public.incidents_inserted_breach_notices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform queue_breach_notice_candidates((
      select coalesce(array_agg(distinct n.id), '{}')
      from new_rows i
      join victim_disclosures n on company_key(n.company_name) = company_key(i.victim_name)
      where n.source <> 'sec-edgar'
        and i.discovered_date is not null
        and length(company_key(i.victim_name)) > 3));
  exception when others then
    perform record_finding('breach_notice_candidate_failed', 'queue_breach_notice_candidates on new claims',
      'warning', 'open', jsonb_build_object('error', sqlerrm, 'at', now()::text));
  end;
  return null;
end;
$$;

revoke execute on function public.breach_notices_inserted() from public, anon, authenticated;
revoke execute on function public.incidents_inserted_breach_notices() from public, anon, authenticated;
-- no grant: trigger functions run as their owner and are called by no one.

drop trigger if exists victim_disclosures_breach_candidates on public.victim_disclosures;
create trigger victim_disclosures_breach_candidates
  after insert on public.victim_disclosures
  referencing new table as new_rows
  for each statement execute function public.breach_notices_inserted();

drop trigger if exists incidents_breach_candidates on public.incidents;
create trigger incidents_breach_candidates
  after insert on public.incidents
  referencing new table as new_rows
  for each statement execute function public.incidents_inserted_breach_notices();

-- Evidence for victim_country_disagreement: what Vigil holds about the victim.
create or replace view public.review_country_evidence
with (security_invoker = true) as
with f as (
  select id as finding_id,
         regexp_replace(subject, ': [A-Z]{2} or [A-Z]{2}$', '') as victim,
         details->>'held' as held,
         details->>'offered' as offered
  from public.data_quality_findings
  where check_name = 'victim_country_disagreement'
),
site as (
  select f.finding_id,
         min(nullif(btrim(i.victim_website), '')) as website,
         count(i.id) as incidents
  from f
  left join public.incidents i on i.victim_name = f.victim
  group by f.finding_id
),
tld as (
  select s.*,
         upper(substring(lower(regexp_replace(s.website, '^[a-z]+://', '')) from '\.([a-z]{2,})(?:[:/].*)?$')) as tld
  from site s
)
select f.finding_id,
       f.victim,
       f.held,
       f.offered,
       t.website,
       t.tld,
       t.incidents,
       -- A two-letter domain is a country code (UK for GB). Anything else says nothing.
       case
         when t.tld is null or length(t.tld) <> 2 then null
         when replace(t.tld, 'UK', 'GB') = f.held then 'held'
         when replace(t.tld, 'UK', 'GB') = f.offered then 'offered'
         else 'neither'
       end as domain_agrees_with
from f
join tld t on t.finding_id = f.finding_id;

revoke all on public.review_country_evidence from anon, authenticated;
grant select on public.review_country_evidence to authenticated;

-- Ask once now about every notice already held.
select public.queue_breach_notice_candidates(
  (select array_agg(id) from public.victim_disclosures where source <> 'sec-edgar'));

commit;
