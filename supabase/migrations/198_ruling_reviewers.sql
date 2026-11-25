-- 198. Only named reviewers may rule
--
-- STATUS: written 24 Nov 2026. NOT APPLIED.
--
-- WHY
-- record_verdict (126), rule_vendor_actor_link (156) and rule_vendor_attribution (157) take decided_by from
-- the JWT, so nobody can rule under another name, but any signed-in account may rule. 126 queued that as an
-- open question (finding 'review_authority': "matters when Vigil gains users who are not its operator").
-- Sign-ups were open on 23 Nov 2026, so it matters now. src/lib/adminAuth.js's email list is browser-side
-- presentation, not a boundary.
--
-- WHAT CHANGES
--   public.ruling_reviewers   one row per account allowed to rule. No browser role can read or write it;
--                             rows are added in the SQL editor (see HOW TO ADD A REVIEWER).
--   public.is_ruling_reviewer()  true when the caller's auth.uid() is in that table. Callable by
--                             authenticated so the UI can hide ruling controls; it reveals nothing else.
--   The three ruling functions are renamed to *_unchecked and lose every grant. New functions with the old
--   names and signatures check the allowlist, then call them. Bodies, return types, errors and the
--   append-only tables are untouched; the client code does not change. rule_vendor_attribution calls
--   record_verdict by name, so it now passes the same check, for the same user.
--   A caller not on the list gets errcode 42501 ('only a named reviewer may ...').
--
-- SEED
--   Every account that has already recorded a ruling in any of the three decision tables and still exists in
--   auth.users. Measured 24 Nov 2026: one account, 5 finding verdicts, no vendor rulings. No address or id
--   is written in this file (public repo).
--
-- HOW TO ADD A REVIEWER (SQL editor, as postgres)
--   insert into public.ruling_reviewers (user_id, note)
--   select id, 'added <date>' from auth.users where email = '<address>';
--
-- REVERSE
--   drop the three wrappers, rename *_unchecked back, re-run the grants from 126/156/157, drop
--   is_ruling_reviewer() and ruling_reviewers. Nothing is deleted from the decision tables either way.
--
-- LIMIT: a later CREATE OR REPLACE of record_verdict, rule_vendor_actor_link or rule_vendor_attribution
-- replaces the wrapper, not the body. Change the body through the *_unchecked function.

begin;

create table if not exists public.ruling_reviewers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);

comment on table public.ruling_reviewers is
  'Accounts allowed to rule through record_verdict, rule_vendor_actor_link and rule_vendor_attribution. '
  'Rows are added in the SQL editor. See migration 198.';

revoke all on public.ruling_reviewers from anon, authenticated;
grant select on public.ruling_reviewers to service_role;
alter table public.ruling_reviewers enable row level security;

insert into public.ruling_reviewers (user_id, note)
select u.id, 'seeded by 198: had already ruled'
from auth.users u
where u.id::text in (
  select decided_by from public.finding_verdicts
  union select decided_by from public.vendor_link_decisions
  union select decided_by from public.vendor_attribution_decisions
)
on conflict (user_id) do nothing;

create or replace function public.is_ruling_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ruling_reviewers r where r.user_id = auth.uid());
$$;

revoke execute on function public.is_ruling_reviewer() from public, anon, authenticated;
grant execute on function public.is_ruling_reviewer() to authenticated, service_role;

-- The checked bodies keep their code under a new name and lose every grant.
alter function public.record_verdict(uuid, text, text)
  rename to record_verdict_unchecked;
alter function public.rule_vendor_actor_link(uuid, uuid, text, text)
  rename to rule_vendor_actor_link_unchecked;
alter function public.rule_vendor_attribution(uuid, text, text, text, text, text)
  rename to rule_vendor_attribution_unchecked;

revoke execute on function public.record_verdict_unchecked(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.rule_vendor_actor_link_unchecked(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.rule_vendor_attribution_unchecked(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.record_verdict(
  p_finding_id uuid,
  p_verdict text,
  p_rationale text
) returns public.finding_verdicts
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_ruling_reviewer() then
    raise exception 'only a named reviewer may record a verdict' using errcode = '42501';
  end if;
  return public.record_verdict_unchecked(p_finding_id, p_verdict, p_rationale);
end;
$$;

create or replace function public.rule_vendor_actor_link(
  p_report_id uuid,
  p_actor_id uuid,
  p_verdict text,
  p_rationale text
) returns public.vendor_link_decisions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_ruling_reviewer() then
    raise exception 'only a named reviewer may rule on a vendor link' using errcode = '42501';
  end if;
  return public.rule_vendor_actor_link_unchecked(p_report_id, p_actor_id, p_verdict, p_rationale);
end;
$$;

create or replace function public.rule_vendor_attribution(
  p_report_id uuid,
  p_verdict text,
  p_country text,
  p_strength text,
  p_phrase text,
  p_rationale text
) returns public.vendor_attribution_decisions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_ruling_reviewer() then
    raise exception 'only a named reviewer may rule on an attribution' using errcode = '42501';
  end if;
  return public.rule_vendor_attribution_unchecked(
    p_report_id, p_verdict, p_country, p_strength, p_phrase, p_rationale
  );
end;
$$;

revoke execute on function public.record_verdict(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_verdict(uuid, text, text) to authenticated, service_role;
revoke execute on function public.rule_vendor_actor_link(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.rule_vendor_actor_link(uuid, uuid, text, text) to authenticated, service_role;
revoke execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text)
  to authenticated, service_role;

comment on function public.record_verdict(uuid, text, text) is
  'Checks ruling_reviewers, then calls record_verdict_unchecked (126). See migration 198.';
comment on function public.rule_vendor_actor_link(uuid, uuid, text, text) is
  'Checks ruling_reviewers, then calls rule_vendor_actor_link_unchecked (156). See migration 198.';
comment on function public.rule_vendor_attribution(uuid, text, text, text, text, text) is
  'Checks ruling_reviewers, then calls rule_vendor_attribution_unchecked (157). See migration 198.';

commit;
