-- 156. A proposed link between a vendor report and an actor can be ruled on
--      from the product
--
-- STATUS: applied 2026-10-27 at 00:05 UTC, with the revoke below applied a
-- minute later as a second step (156b in the live migration log).
--
-- WHY
--
-- Migration 139 matches actor names in vendor report titles and stores each
-- match in vendor_report_actors with `confirmed` null: proposed, never applied,
-- "until a person says". Nothing let a person say. On 26 October 2026 there
-- were 27 proposed links across 23 of 377 reports, and none had been ruled on.
-- SESSION_HANDOFF §2b names this as the largest gap: research Vigil holds and
-- cannot rule on through the product.
--
-- The links matter because they are how a vendor report becomes attributed
-- activity without the vendor having named a country: event from the vendor,
-- country from the actor record. A name match is not that join until a person
-- has read the report and agreed it is about that actor. One early match
-- proposed an Iranian group's campaign as the work of two Chinese actors.
--
-- WHAT A RULING IS
--
-- The same three answers record_verdict (126) gives a finding:
--
--   confirmed  the report is about this actor   -> confirmed = true
--   rejected   the name matched, the actor is wrong -> confirmed = false
--   deferred   not enough to say yet            -> confirmed stays as it was
--
-- 'deferred' matters for the same reason it does there: forcing a yes or no is
-- how a queue gets cleared by guessing. The reason is recorded and the link
-- stays proposed.
--
-- Every ruling is kept. vendor_link_decisions is append only - no update or
-- delete policy, and no grant that would allow one - and vendor_report_actors
-- carries the current state. A link can be ruled on again, and the earlier
-- ruling stays on the record.
--
-- Confirming a link records a decision. It does not write attributed_activity
-- or anything else; applying a decision to the data is a separate act, as 126
-- keeps it.
--
-- WHO DECIDES
--
-- decided_by is auth.uid() inside the function, never a value the client
-- sends, as in record_verdict. The limit 126 records applies here too: any
-- signed-in user can rule. A server-side reviewer list is still an open
-- finding, not something this migration settles.
--
-- GRANTS
--
-- Written for Supabase's 30 October 2026 change (changelog 45329): the new
-- table is granted explicitly, and the SECURITY DEFINER function is revoked
-- from public, anon and authenticated before it is granted to the roles that
-- call it (154, scripts/check-migration-grants.mjs).

create table if not exists public.vendor_link_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  actor_id uuid not null,
  verdict text not null check (verdict in ('confirmed', 'rejected', 'deferred')),
  -- A ruling without its reasoning is the guess this exists to avoid.
  rationale text not null check (length(btrim(rationale)) >= 10),
  decided_by text not null,
  decided_at timestamptz not null default now(),
  foreign key (report_id, actor_id)
    references public.vendor_report_actors (report_id, actor_id) on delete cascade
);

create index if not exists idx_vendor_link_decisions_link
  on public.vendor_link_decisions (report_id, actor_id, decided_at desc);

comment on table public.vendor_link_decisions is
  'Every ruling on a proposed vendor report to actor link, append only. '
  'vendor_report_actors.confirmed carries the current state. See migration 156.';

alter table public.vendor_link_decisions enable row level security;

-- Readable by signed-in users, like finding_verdicts: the decision log is the
-- point. No insert, update or delete policy: rule_vendor_actor_link() is the
-- only way in, and nothing removes a ruling once written.
drop policy if exists vendor_link_decisions_select on public.vendor_link_decisions;
create policy vendor_link_decisions_select on public.vendor_link_decisions
  for select to authenticated using (true);

-- Until 30 October 2026 Supabase's default privileges grant every new table to
-- anon and authenticated in full. RLS already refuses those writes, but this
-- file promises that no grant allows one, so the defaults are revoked and the
-- one privilege meant is granted back. From 30 October the revoke is a no-op.
revoke all on public.vendor_link_decisions from anon, authenticated;
grant select on public.vendor_link_decisions to authenticated, service_role;

create or replace function public.rule_vendor_actor_link(
  p_report_id uuid,
  p_actor_id uuid,
  p_verdict text,
  p_rationale text
) returns public.vendor_link_decisions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user text := (auth.uid())::text;
  v_row public.vendor_link_decisions;
begin
  if v_user is null then
    raise exception 'a ruling must be made by a signed-in reviewer'
      using errcode = '28000';
  end if;

  if p_verdict is null or p_verdict not in ('confirmed', 'rejected', 'deferred') then
    raise exception 'unknown ruling: %', p_verdict using errcode = '22023';
  end if;

  if p_rationale is null or length(btrim(p_rationale)) < 10 then
    raise exception 'a ruling needs its reasoning, in at least ten characters'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from vendor_report_actors
    where report_id = p_report_id and actor_id = p_actor_id
  ) then
    raise exception 'no such proposed link' using errcode = '23503';
  end if;

  insert into vendor_link_decisions (report_id, actor_id, verdict, rationale, decided_by)
  values (p_report_id, p_actor_id, p_verdict, btrim(p_rationale), v_user)
  returning * into v_row;

  -- Deferred leaves the link as it was, on purpose.
  if p_verdict <> 'deferred' then
    update vendor_report_actors
    set confirmed = (p_verdict = 'confirmed'),
        decided_by = v_user,
        decided_at = v_row.decided_at
    where report_id = p_report_id and actor_id = p_actor_id;
  end if;

  return v_row;
end;
$fn$;

comment on function public.rule_vendor_actor_link(uuid, uuid, text, text) is
  'Records a ruling on a proposed vendor report to actor link: confirmed, '
  'rejected or deferred, with its reasoning. The reviewer is taken from the '
  'JWT. See migration 156.';

revoke execute on function public.rule_vendor_actor_link(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.rule_vendor_actor_link(uuid, uuid, text, text)
  to authenticated, service_role;
