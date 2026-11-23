-- 196. Record when a group's surge was first flagged (ideas#189, feed contract 2.1 last_change)
--
-- STATUS: written 23 Nov 2026 on Tom's yes to ideas#189 ("additive, new surges only").
--
-- WHY
-- /api/feed states last_change for every item but the surge item, because apply_actor_surges() (179)
-- keeps no record of when a group first met the rule. This adds one column and a trigger that stamps it.
--
-- WHAT CHANGES
--   threat_actors.surge_flagged_at  timestamptz, null when the group is not surging.
--   Set to now() when surge turns true (false or null before); cleared when surge turns false.
--   Groups already surging when this applies stay null: their start was never stored and is not guessed.
--   apply_actor_surges() and the surge rule are untouched; the trigger only reads the row it writes.
--   Additive; no row is deleted or rewritten, and threat_actors' grants and read-only RLS policy cover the column.

begin;

alter table public.threat_actors
  add column if not exists surge_flagged_at timestamptz;

comment on column public.threat_actors.surge_flagged_at is
  'Migration 196: when surge last turned true. Null while not surging, and for groups already surging when 196 applied (start never stored).';

create or replace function public.stamp_surge_flagged_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.surge is true and old.surge is not true then
    new.surge_flagged_at := now();
  elsif new.surge is not true then
    new.surge_flagged_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_surge_flagged_at() from public, anon, authenticated;

drop trigger if exists threat_actors_surge_flagged_at on public.threat_actors;
create trigger threat_actors_surge_flagged_at
  before update of surge on public.threat_actors
  for each row
  when (new.surge is distinct from old.surge)
  execute function public.stamp_surge_flagged_at();

commit;
