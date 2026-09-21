-- 130: what the victim told its regulator
--
-- WHY THIS IS DIFFERENT FROM EVERY OTHER SOURCE
--
-- Every incident Vigil holds is a claim made by the group that attacked. The
-- README says so, the Help page says so, and ThreatCluster says it of its own
-- data: "Everything is the group's claim, not a confirmed breach." No
-- leak-site feed can do better, because the only party with an interest in
-- publishing is the one making the accusation.
--
-- An SEC 8-K Item 1.05 is the other party speaking. Since December 2023 a
-- registrant has had to report a material cybersecurity incident within four
-- business days. It is filed by the victim, under penalty, to a regulator. It
-- is public domain, free, and available over EDGAR's full-text search.
--
-- That is corroboration, and it is the one thing no amount of leak-site
-- coverage buys.
--
-- MEASURED FIRST
--
-- 101 Item 1.05 filings exist in total - the whole population since the rule
-- took effect - from 72 distinct companies. Matched against Vigil's victims by
-- company name with legal suffixes stripped, 11 of the 72 are organisations a
-- ransomware group has also claimed:
--
--   Hewlett Packard Enterprise, Key Tronic, Krispy Kreme, Lee Enterprises,
--   MarineMax, Microsoft, NovoCure, Nutex Health, Prudential Financial,
--   Stryker, UFP Technologies
--
-- WHAT A MATCH IS AND IS NOT
--
-- A name match is not proof the two records describe the same event. A large
-- company may be claimed by a group in March and file about an unrelated
-- intrusion in September. Deciding that a filing corroborates a particular
-- claim is a judgment call, so it is queued, exactly like every other one.
--
-- So this migration stores two different kinds of thing, and keeps them apart:
--
--   the filing        a fact. It exists, it is dated, it is citable.
--   the link          an assessment that this filing is about this claim.
--                     Null until a human says otherwise.
--
-- Filings are ingested automatically. Links are not.

begin;

/** A company name reduced for comparison: no punctuation, no legal suffix. */
create or replace function public.company_key(n text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(lower(coalesce(n, '')), '[^a-z0-9 ]', ' ', 'g'),
             '\m(inc|corp|corporation|company|co|llc|ltd|limited|plc|holdings|holding|group|trust|lp|llp|the)\M', ' ', 'g'
           ), '\s+', '', 'g')
$$;

create table if not exists public.victim_disclosures (
  id uuid primary key default gen_random_uuid(),
  -- The filing. These columns are what EDGAR returned, not an interpretation.
  accession text not null unique,
  company_name text not null,
  cik text,
  filed_date date not null,
  form text not null,
  items text[],
  business_location text,
  filing_url text not null,
  source text not null default 'sec-edgar',
  first_seen timestamptz not null default now(),

  -- The assessment. Null means nobody has ruled on it yet.
  matched_incident_id uuid references public.incidents(id) on delete set null,
  match_status text not null default 'unreviewed'
    check (match_status in ('unreviewed', 'candidate', 'corroborated', 'unrelated')),
  matched_by text,
  matched_at timestamptz
);

create index if not exists idx_victim_disclosures_company
  on public.victim_disclosures (public.company_key(company_name));
create index if not exists idx_victim_disclosures_filed
  on public.victim_disclosures (filed_date desc);

alter table public.victim_disclosures enable row level security;

-- A regulatory filing is public information and Vigil publishes the claims it
-- would corroborate, so it is readable by anyone. Writes go through the
-- ingest function.
drop policy if exists victim_disclosures_read on public.victim_disclosures;
create policy victim_disclosures_read on public.victim_disclosures
  for select to anon, authenticated using (true);

grant select on public.victim_disclosures to anon, authenticated;

/**
 * Record filings, and queue any that look like something Vigil already tracks.
 *
 * p_rows: [{ accession, company_name, cik, filed_date, form, items,
 *            business_location, filing_url }]
 *
 * Filings are upserted. Matches are queued as findings and never applied:
 * match_status stays 'candidate' until someone records a verdict.
 */
create or replace function public.apply_victim_disclosures(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int := 0;
  v_candidates int := 0;
  r record;
begin
  with incoming as (
    select x.accession, x.company_name, x.cik, x.filed_date::date as filed_date,
           x.form, x.items, x.business_location, x.filing_url
    from jsonb_to_recordset(p_rows) as x(
      accession text, company_name text, cik text, filed_date text,
      form text, items text[], business_location text, filing_url text
    )
    where x.accession is not null and x.company_name is not null
  ),
  upserted as (
    insert into victim_disclosures
      (accession, company_name, cik, filed_date, form, items, business_location, filing_url)
    select accession, company_name, cik, filed_date, form, items, business_location, filing_url
    from incoming
    on conflict (accession) do update
      set company_name = excluded.company_name,
          filed_date = excluded.filed_date,
          items = excluded.items,
          business_location = excluded.business_location
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_new from upserted;

  -- Anything whose filer is a name Vigil already holds as a victim. Queued,
  -- not linked: a name match is not evidence the two records describe the
  -- same event.
  for r in
    select d.id, d.company_name, d.filed_date, d.filing_url,
           i.victim_name, i.discovered_date, i.id as incident_id,
           a.name as actor_name
    from victim_disclosures d
    join incidents i on company_key(i.victim_name) = company_key(d.company_name)
    left join threat_actors a on a.id = i.actor_id
    where d.match_status = 'unreviewed'
      and length(company_key(d.company_name)) > 3
    limit 100
  loop
    update victim_disclosures set match_status = 'candidate' where id = r.id;
    v_candidates := v_candidates + 1;

    perform record_finding(
      'sec_disclosure_candidate',
      r.company_name || ' filed 8-K Item 1.05 on ' || r.filed_date,
      'info',
      'open',
      jsonb_build_object(
        'question', 'Does this filing corroborate the claim Vigil holds, or is it a different incident?',
        'instruction', 'Read the filing before deciding. A large company can be claimed in March and file about an unrelated intrusion in September.',
        'filed', r.filed_date::text,
        'filing', r.filing_url,
        'claimed_victim', r.victim_name,
        'claimed_by', coalesce(r.actor_name, 'unknown'),
        'claim_discovered', r.discovered_date::text,
        'why_it_matters', 'Every incident Vigil holds is the attacker''s claim. An 8-K Item 1.05 is the victim telling its regulator, under penalty, that a material cybersecurity incident occurred. That is the only corroboration a leak-site feed cannot supply.'
      )
    );
  end loop;

  return jsonb_build_object(
    'source', 'sec-edgar',
    'filings_new', v_new,
    'candidates_queued', v_candidates
  );
end;
$$;

revoke execute on function public.apply_victim_disclosures(jsonb) from public, anon, authenticated;
grant execute on function public.apply_victim_disclosures(jsonb) to service_role;

commit;
