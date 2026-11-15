-- 165: close what the queue should never have asked, and say so
--
-- WHAT WAS MEASURED (15 Nov 2026, live, read-only)
--
-- 750 findings open, 600 of them `sec_disclosure_candidate`. Each of those
-- says "<company> filed 8-K Item 1.05 on <date>" and asks whether that filing
-- corroborates a leak-site claim. Joined back to victim_disclosures on that
-- subject:
--
--   17   are SEC 8-K or 8-K/A filings, as the finding says
--   583  are state breach notices (CA, WA, OR AG). None is an SEC filing.
--
-- WHY 583 ARE WRONG
--
-- 141 and 143 put state breach notices in victim_disclosures and wrote down,
-- in both headers and in apply_breach_notices' own comment, that no notice is
-- matched to an incident: "Never matches a notice to an incident". But 130's
-- apply_victim_disclosures, called on every SEC run, scans every row with
-- match_status 'unreviewed' whatever its source. So from 21 Sep each SEC run
-- picked up to 100 state notices whose organisation shares a name with a
-- claimed victim, set them to 'candidate', and queued them under a subject
-- that states an 8-K Item 1.05 filing which does not exist.
--
-- So every one of the 583 asserts a fact that is false, and 714 state
-- notices carry 'candidate', which /disclosures counts as reviewed and
-- /api/feed publishes. Neither is a judgment anyone made.
--
-- WHAT THIS DOES
--
-- 1. apply_victim_disclosures scans source 'sec-edgar' only. Unchanged
--    otherwise. The bug stops before anything is closed.
-- 2. A finding can be 'auto_closed': distinct from 'auto_resolved' (a check
--    clearing its own finding), from 'resolved'/'dismissed' (a person ruled).
--    Every auto-close is a row in finding_auto_closures with the rule, the
--    reason, the status it had and what else was changed, so
--    reopen_auto_closed() can put it back exactly.
-- 3. auto_close_findings(p_apply) runs the rules. With p_apply false it
--    counts and changes nothing.
--
-- THE RULES, AND WHY EACH IS NOT A JUDGMENT
--
--   not_an_sec_filing    open sec_disclosure_candidate whose subject matches
--                        no sec-edgar row and at least one state notice. The
--                        finding asserts an 8-K that is not there; whether a
--                        state notice corroborates a claim is a different
--                        question, which 141 and 143 deliberately did not ask.
--                        The notices it touched go back from 'candidate' to
--                        'unreviewed', logged, never to a verdict.
--                        Closes 583 (dry run, 15 Nov).
--   feed_recovered       open source_upstream_down whose feed_health row is
--                        now 'fresh'. The finding reports a feed down; it is
--                        not. Closes 1 (ransomwhere, now on the Zenodo route).
--
-- Not done: closing by date gap, by name similarity, by amendment pairing, or
-- anything else that decides what a filing is about. docs/
-- REVIEW_QUEUE_AUTOMATION.md lists those as help for a reviewer, not closes.
--
-- RE-RAISING
--
-- record_finding keeps only 'resolved' and 'dismissed' on a re-run, so a check
-- that raises an auto-closed finding again reopens it. That is intended: an
-- auto-close says "the condition is gone", and the check saying it is back
-- outranks it. Neither rule's finding is raised by a recurring check once
-- (1) is in, so nothing here should reopen. No schedule and no worker deploy:
-- the closes run once, below; the function stays for a re-run on request.

begin;

-- 1. The SEC scan reads SEC filings only. Body is 130's, with one filter added.
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

  -- SEC filings only (165). State breach notices share this table and are
  -- never matched to an incident (141, 143).
  for r in
    select d.id, d.company_name, d.filed_date, d.filing_url,
           i.victim_name, i.discovered_date, i.id as incident_id,
           a.name as actor_name
    from victim_disclosures d
    join incidents i on company_key(i.victim_name) = company_key(d.company_name)
    left join threat_actors a on a.id = i.actor_id
    where d.match_status = 'unreviewed'
      and d.source = 'sec-edgar'
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

-- 2. A status for "closed by a rule", and the log that makes it reversible.
alter table public.data_quality_findings
  drop constraint if exists data_quality_findings_status_check;
alter table public.data_quality_findings
  add constraint data_quality_findings_status_check
  check (status in ('open', 'auto_resolved', 'auto_closed', 'resolved', 'dismissed'));

create table if not exists public.finding_auto_closures (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.data_quality_findings(id) on delete cascade,
  rule text not null,
  reason text not null check (length(btrim(reason)) >= 10),
  prior_status text not null,
  prior_resolved_at timestamptz,
  -- What else the close changed, so a reopen can undo it: for
  -- not_an_sec_filing, the victim_disclosures ids set back to 'unreviewed'.
  changed jsonb not null default '{}',
  closed_at timestamptz not null default now(),
  reopened_at timestamptz,
  reopened_reason text
);

create index if not exists idx_finding_auto_closures_finding
  on public.finding_auto_closures (finding_id, closed_at desc);

-- Readable like the verdict log: it is the record of what was closed and why.
-- Written only by the two functions below, as owner.
revoke all on public.finding_auto_closures from anon, authenticated;
grant select on public.finding_auto_closures to authenticated;
alter table public.finding_auto_closures enable row level security;
drop policy if exists finding_auto_closures_select on public.finding_auto_closures;
create policy finding_auto_closures_select on public.finding_auto_closures
  for select to authenticated using (true);

-- The review page shows why an item was closed. Columns are appended, so
-- create or replace keeps the view and its existing grant.
create or replace view public.review_queue
with (security_invoker = true) as
select f.id,
       f.check_name,
       f.subject,
       f.severity,
       f.status,
       f.details,
       f.first_seen,
       f.last_seen,
       f.resolved_at,
       v.verdict as latest_verdict,
       v.rationale as latest_rationale,
       v.decided_by as latest_decided_by,
       v.decided_at as latest_decided_at,
       (select count(*) from public.finding_verdicts fv where fv.finding_id = f.id) as verdict_count,
       c.rule as auto_close_rule,
       c.reason as auto_close_reason,
       c.closed_at as auto_closed_at
from public.data_quality_findings f
left join lateral (
  select fv.verdict, fv.rationale, fv.decided_by, fv.decided_at
  from public.finding_verdicts fv
  where fv.finding_id = f.id
  order by fv.decided_at desc
  limit 1
) v on true
left join lateral (
  select ac.rule, ac.reason, ac.closed_at
  from public.finding_auto_closures ac
  where ac.finding_id = f.id and ac.reopened_at is null
  order by ac.closed_at desc
  limit 1
) c on f.status = 'auto_closed';

revoke all on public.review_queue from anon, authenticated;
grant select on public.review_queue to authenticated;

-- 3. The rules.
create or replace function public.auto_close_findings(p_apply boolean default false)
returns table (rule text, matched int, closed int, disclosures_reset int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_ids uuid[];
  v_m int;
  v_c int;
  v_d int;
begin
  -- not_an_sec_filing
  v_m := 0; v_c := 0; v_d := 0;
  for r in
    select f.id, f.status, f.resolved_at,
           array_agg(d.id) as notice_ids,
           array_agg(distinct d.source) as sources
    from data_quality_findings f
    join victim_disclosures d
      on d.company_name || ' filed 8-K Item 1.05 on ' || d.filed_date = f.subject
    where f.check_name = 'sec_disclosure_candidate'
      and f.status = 'open'
    group by f.id, f.status, f.resolved_at
    having bool_and(d.source <> 'sec-edgar')
  loop
    v_m := v_m + 1;
    -- Only rows still 'candidate' are reset and logged; a notice a person
    -- has since ruled on is left alone.
    select coalesce(array_agg(id), '{}') into v_ids
    from victim_disclosures
    where id = any (r.notice_ids) and match_status = 'candidate';
    v_d := v_d + coalesce(array_length(v_ids, 1), 0);
    if p_apply then
      update victim_disclosures set match_status = 'unreviewed' where id = any (v_ids);

      insert into finding_auto_closures (finding_id, rule, reason, prior_status, prior_resolved_at, changed)
      values (
        r.id, 'not_an_sec_filing',
        'Raised in error: the subject names an 8-K Item 1.05 filing, but every matching record is a state breach notice ('
          || array_to_string(r.sources, ', ')
          || '). Migrations 141 and 143 never match a notice to an incident; apply_victim_disclosures scanned them until 165.',
        r.status, r.resolved_at,
        jsonb_build_object('victim_disclosures_reset_to_unreviewed', to_jsonb(v_ids))
      );
      update data_quality_findings set status = 'auto_closed', resolved_at = now() where id = r.id;
      v_c := v_c + 1;
    end if;
  end loop;
  rule := 'not_an_sec_filing'; matched := v_m; closed := v_c; disclosures_reset := v_d;
  return next;

  -- feed_recovered
  v_m := 0; v_c := 0;
  for r in
    select f.id, f.status, f.resolved_at, f.details->>'feed_id' as feed_id
    from data_quality_findings f
    join feed_health h on h.feed_id = f.details->>'feed_id'
    where f.check_name = 'source_upstream_down'
      and f.status = 'open'
      and h.state = 'fresh'
  loop
    v_m := v_m + 1;
    if p_apply then
      insert into finding_auto_closures (finding_id, rule, reason, prior_status, prior_resolved_at)
      values (r.id, 'feed_recovered',
              'The finding reports feed ' || r.feed_id || ' down; feed_health reads it fresh at ' || now()::date || '.',
              r.status, r.resolved_at);
      update data_quality_findings set status = 'auto_closed', resolved_at = now() where id = r.id;
      v_c := v_c + 1;
    end if;
  end loop;
  rule := 'feed_recovered'; matched := v_m; closed := v_c; disclosures_reset := 0;
  return next;
end;
$$;

revoke execute on function public.auto_close_findings(boolean) from public, anon, authenticated;
grant execute on function public.auto_close_findings(boolean) to service_role;

/** Put auto-closed findings back exactly as they were, by rule or one finding. */
create or replace function public.reopen_auto_closed(p_rule text, p_reason text, p_finding_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n int := 0;
begin
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'a reopen needs its reasoning, in at least ten characters' using errcode = '22023';
  end if;

  for r in
    select ac.* from finding_auto_closures ac
    join data_quality_findings f on f.id = ac.finding_id
    where ac.reopened_at is null
      and f.status = 'auto_closed'
      and ac.rule = p_rule
      and (p_finding_id is null or ac.finding_id = p_finding_id)
  loop
    update victim_disclosures set match_status = 'candidate'
    where match_status = 'unreviewed'
      and id in (select (jsonb_array_elements_text(r.changed->'victim_disclosures_reset_to_unreviewed'))::uuid);

    update data_quality_findings
    set status = r.prior_status, resolved_at = r.prior_resolved_at
    where id = r.finding_id;

    update finding_auto_closures
    set reopened_at = now(), reopened_reason = btrim(p_reason)
    where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.reopen_auto_closed(text, text, uuid) from public, anon, authenticated;
grant execute on function public.reopen_auto_closed(text, text, uuid) to service_role;

-- Run once.
select * from public.auto_close_findings(true);

commit;
