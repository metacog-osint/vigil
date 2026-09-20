-- 126: a verdict can be recorded from the product, not only from a migration
--
-- WHY
--
-- Vigil's claim is that every judgment call is recorded with its evidence
-- rather than guessed. data_quality_findings has queued those calls since
-- 089, and the checks that raise them are honest: detect_leak_site_notices()
-- queues candidates and never moves a row on its own.
--
-- But the only way a verdict had ever been recorded was someone hand-writing
-- a migration. Twenty findings are open. The mechanism that separates Vigil
-- from a feed aggregator existed in SQL and nowhere a person could reach it.
--
-- WHAT A VERDICT IS
--
-- A verdict is a durable record of a human decision, with the reasoning that
-- supports it. It is not a delete and it is not a data fix. Applying a
-- decision to the data is a separate act - actor_relationship_decisions has
-- carried applied_at separately from decided_at since it was written, and
-- this follows that. A verdict recorded here changes what Vigil says about a
-- finding; it does not silently rewrite incidents.
--
-- Three verdicts, mapped onto the status vocabulary data_quality_findings
-- already has, so no existing check constraint moves:
--
--   confirmed  the finding is real           -> status 'resolved'
--   rejected   not a problem, a false read   -> status 'dismissed'
--   deferred   not enough evidence yet       -> status stays 'open'
--
-- 'deferred' is the one that matters for honesty. A reviewer who cannot
-- decide must be able to say so and leave the item queued, with the reason
-- recorded. Forcing a binary answer is how a queue gets cleared by guessing.
--
-- record_finding() already protects this: on re-run it keeps a status of
-- 'resolved' or 'dismissed' rather than reopening the row. So a verdict
-- survives the checks running again, and a deferred finding is re-raised
-- with fresh evidence, which is what should happen.
--
-- APPEND ONLY
--
-- A finding may be ruled on more than once - evidence arrives, a reviewer
-- changes their mind - and every ruling is kept. The history is the product;
-- nothing here updates or deletes a verdict, and there is no policy that
-- would let the API do so either. The current verdict is the most recent.
--
-- WHO DECIDES
--
-- decided_by is taken from the JWT inside the function, never from the
-- client, so a caller cannot record a verdict under someone else's name.
--
-- Worth being plain about the limit, because one of the open findings
-- (audit_log_trust) asks exactly this question of the audit log: this makes
-- the identity on a verdict trustworthy, but any signed-in user can still
-- record one. src/lib/adminAuth.js is an env-var list of emails checked in
-- the browser, which is presentation, not a boundary. If Vigil gains users
-- who are not its operator, this needs a reviewer allowlist held server-side
-- and checked here. Recorded as a finding rather than left implicit.

begin;

create table if not exists public.finding_verdicts (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.data_quality_findings(id) on delete cascade,
  verdict text not null check (verdict in ('confirmed', 'rejected', 'deferred')),
  -- Not nullable and not blank: a verdict without its reasoning is the guess
  -- this whole mechanism exists to avoid.
  rationale text not null check (length(btrim(rationale)) >= 10),
  decided_by text not null,
  decided_at timestamptz not null default now(),
  -- Null means recorded but not yet acted on in the data.
  applied_at timestamptz
);

create index if not exists idx_finding_verdicts_finding
  on public.finding_verdicts (finding_id, decided_at desc);

alter table public.finding_verdicts enable row level security;

-- Readable by any signed-in user: the decision log is the point of the
-- feature. No insert, update or delete policy exists, so the only way in is
-- record_verdict() below, and there is no way to alter or remove one
-- through the API once written.
drop policy if exists finding_verdicts_select on public.finding_verdicts;
create policy finding_verdicts_select on public.finding_verdicts
  for select to authenticated using (true);

-- The queue itself has to be readable to be reviewed. It already had RLS
-- enabled and not one policy, which denies everybody - so nothing had ever
-- read a finding through the API, and no page could have been built against
-- it. The same was true of the two decision tables that hold the verdicts
-- taken so far, so they get the same treatment: this is the decision log the
-- product is built on, and it was invisible.
alter table public.data_quality_findings enable row level security;

drop policy if exists data_quality_findings_select on public.data_quality_findings;
create policy data_quality_findings_select on public.data_quality_findings
  for select to authenticated using (true);

drop policy if exists actor_relationship_decisions_select on public.actor_relationship_decisions;
create policy actor_relationship_decisions_select on public.actor_relationship_decisions
  for select to authenticated using (true);

drop policy if exists sanctions_match_decisions_select on public.sanctions_match_decisions;
create policy sanctions_match_decisions_select on public.sanctions_match_decisions
  for select to authenticated using (true);

-- The latest verdict per finding, joined to the finding it rules on.
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
       (select count(*) from public.finding_verdicts fv where fv.finding_id = f.id) as verdict_count
from public.data_quality_findings f
left join lateral (
  select fv.verdict, fv.rationale, fv.decided_by, fv.decided_at
  from public.finding_verdicts fv
  where fv.finding_id = f.id
  order by fv.decided_at desc
  limit 1
) v on true;

create or replace function public.record_verdict(
  p_finding_id uuid,
  p_verdict text,
  p_rationale text
) returns public.finding_verdicts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := (auth.uid())::text;
  v_row public.finding_verdicts;
begin
  if v_user is null then
    raise exception 'a verdict must be recorded by a signed-in reviewer'
      using errcode = '28000';
  end if;

  if p_verdict not in ('confirmed', 'rejected', 'deferred') then
    raise exception 'unknown verdict: %', p_verdict using errcode = '22023';
  end if;

  if p_rationale is null or length(btrim(p_rationale)) < 10 then
    raise exception 'a verdict needs its reasoning, in at least ten characters'
      using errcode = '22023';
  end if;

  if not exists (select 1 from data_quality_findings where id = p_finding_id) then
    raise exception 'no such finding: %', p_finding_id using errcode = '23503';
  end if;

  insert into finding_verdicts (finding_id, verdict, rationale, decided_by)
  values (p_finding_id, p_verdict, btrim(p_rationale), v_user)
  returning * into v_row;

  -- Deferred leaves the finding open on purpose: the reviewer has said they
  -- cannot decide yet, and the reason is now on the record.
  update data_quality_findings
  set status = case p_verdict
                 when 'confirmed' then 'resolved'
                 when 'rejected' then 'dismissed'
                 else status
               end,
      resolved_at = case when p_verdict in ('confirmed', 'rejected')
                         then now() else resolved_at end
  where id = p_finding_id;

  return v_row;
end;
$$;

-- Following 125: PUBLIC gets EXECUTE on a new function by default, and anon
-- is a member of PUBLIC. Reviewers are signed in.
revoke execute on function public.record_verdict(uuid, text, text) from public, anon;
grant execute on function public.record_verdict(uuid, text, text) to authenticated, service_role;

grant select on public.finding_verdicts to authenticated;
grant select on public.review_queue to authenticated;

commit;

-- The reviewer-allowlist question, queued rather than assumed away.
select record_finding(
  'review_authority',
  'Any signed-in user can record a verdict',
  'info',
  'open',
  jsonb_build_object(
    'question', 'Should recording a verdict require a reviewer allowlist held server-side?',
    'detail', 'record_verdict takes decided_by from the JWT, so a verdict cannot be recorded under another name. It does not restrict who may record one.',
    'note', 'src/lib/adminAuth.js checks an env-var list of emails in the browser. That is presentation, not a boundary.',
    'matters_when', 'Vigil gains users who are not its operator'
  )
);
