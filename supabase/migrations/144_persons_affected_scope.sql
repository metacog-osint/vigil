-- 144: two states count different people, and 143 added them together
--
-- Washington's column is headed "Number of Washingtonians Affected". Oregon's
-- is headed "Number Affected", and its largest row is Marriott at 500,000,000
-- - the global figure, not Oregonians.
--
-- 143 stored both in persons_affected and breach_notices_by_state summed them,
-- producing "1,397,860,427 people affected in Oregon" beside Washington's
-- 49,341,395. One of those is a fact about a state and the other is not. Two
-- quantities under one column name, added together - the exact conflation this
-- project refuses, introduced by the migration before this one and caught by
-- reading the largest row rather than the row count.
--
-- persons_affected_scope records which a row is, and the view stops summing
-- across scopes. A national total and a residents-only count cannot be added,
-- and now no caller can do it by accident.
--
-- The view is dropped rather than replaced because create-or-replace cannot
-- rename a view column - a trap already recorded in the handover, and hit
-- again here. Nothing depended on it; it was created the same day.

begin;

alter table public.victim_disclosures
  add column if not exists persons_affected_scope text
  check (persons_affected_scope is null or persons_affected_scope in ('state_residents', 'total'));

comment on column public.victim_disclosures.persons_affected is
  'As the registry published it. Read persons_affected_scope before comparing '
  'or summing: Washington counts its own residents, Oregon counts everyone.';
comment on column public.victim_disclosures.persons_affected_scope is
  'state_residents: the registry counts only people in that state. total: the '
  'registry publishes the whole figure. Null where no count was published. '
  'These are different quantities and must never be added together.';

update public.victim_disclosures
set persons_affected_scope = case source
  when 'wa-ag' then 'state_residents'   -- "Number of Washingtonians Affected"
  when 'or-ag' then 'total'             -- "Number Affected"; Marriott is 500m
end
where source in ('wa-ag', 'or-ag') and persons_affected is not null;

drop view if exists public.breach_notices_by_state;

create view public.breach_notices_by_state
with (security_invoker = true) as
select
  state,
  count(*) as notices,
  count(persons_affected) as notices_with_a_count,
  -- Kept apart deliberately. Washington counts Washingtonians; Oregon counts
  -- everyone. Adding them would produce a number about nobody.
  sum(persons_affected) filter (where persons_affected_scope = 'state_residents')
    as residents_affected,
  sum(persons_affected) filter (where persons_affected_scope = 'total')
    as people_affected_worldwide,
  count(*) filter (where data_types is not null) as notices_with_data_types,
  min(filed_date) as earliest,
  max(filed_date) as latest
from public.victim_disclosures
where state is not null
group by state
order by count(*) desc;

grant select on public.breach_notices_by_state to anon, authenticated;

commit;
