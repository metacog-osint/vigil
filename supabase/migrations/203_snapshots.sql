-- 203: frozen snapshots for /compare. One row per snapshot, owned by its user, never updated.
set local lock_timeout = '5s';

create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.uid()::text),
  name text not null check (length(btrim(name)) between 1 and 120),
  scope_type text not null check (scope_type in ('watchlist', 'sector', 'actor')),
  scope_value text not null check (length(scope_value) between 1 and 200),
  window_start date not null,
  window_end date not null,
  taken_at timestamptz not null default now(),
  body_version int not null default 1,
  body jsonb not null,
  check (window_end >= window_start)
);
create index if not exists idx_snapshots_user_taken on public.snapshots (user_id, taken_at desc);

comment on table public.snapshots is
  'Frozen results for /compare. body sections are null when not computed for the scope, 0 only when counted. Never updated.';

revoke all on public.snapshots from anon, authenticated;
grant select, insert on public.snapshots to authenticated;
alter table public.snapshots enable row level security;

drop policy if exists snapshots_select_own on public.snapshots;
create policy snapshots_select_own on public.snapshots
  for select to authenticated using (user_id = auth.uid()::text);
drop policy if exists snapshots_insert_own on public.snapshots;
create policy snapshots_insert_own on public.snapshots
  for insert to authenticated with check (user_id = auth.uid()::text);
-- No update or delete policy and no update or delete grant: a snapshot is frozen.

create or replace function public.take_snapshot(
  p_name text, p_scope_type text, p_scope_value text, p_window_start date, p_window_end date
) returns public.snapshots
language plpgsql security invoker set search_path = public as $$
declare
  v_actor_ids uuid[];
  v_body jsonb;
  v_row public.snapshots;
begin
  if auth.uid() is null then raise exception 'sign in to take a snapshot'; end if;

  if p_scope_type = 'watchlist' then
    -- Only the caller's own list is visible here (065).
    if not exists (select 1 from watchlists w
                    where w.id = p_scope_value::uuid and w.entity_type = 'actor') then
      raise exception 'actor watchlist not found';
    end if;
    select coalesce(array_agg(wi.entity_id::uuid), '{}') into v_actor_ids
      from watchlist_items wi
     where wi.watchlist_id = p_scope_value::uuid;
  elsif p_scope_type = 'actor' then
    v_actor_ids := array[p_scope_value::uuid];
  elsif p_scope_type <> 'sector' then
    raise exception 'unknown scope type %', p_scope_type;
  end if;

  with scoped as (
    select i.actor_id, i.victim_sector
      from incidents i
     where i.discovered_date between p_window_start and p_window_end
       and (p_scope_type <> 'sector' or i.victim_sector = p_scope_value)
       and (v_actor_ids is null or i.actor_id = any (v_actor_ids))
  )
  select jsonb_build_object(
    'claims', jsonb_build_object(
      'total', (select count(*) from scoped),
      'by_actor', coalesce((select jsonb_object_agg(actor_id, n) from
                    (select actor_id, count(*) n from scoped where actor_id is not null group by 1) a), '{}'),
      'by_sector', coalesce((select jsonb_object_agg(victim_sector, n) from
                    (select victim_sector, count(*) n from scoped where victim_sector is not null group by 1) s), '{}')),
    'actors', coalesce((select jsonb_agg(distinct actor_id order by actor_id) from scoped where actor_id is not null), '[]'),
    'kev', coalesce((select jsonb_agg(cve_id order by cve_id) from vulnerabilities
                      where kev_date between p_window_start and p_window_end), '[]'),
    'open_findings', (select count(*) from data_quality_findings where status = 'open'),
    'evidence_tiers', null
  ) into v_body;

  insert into public.snapshots (name, scope_type, scope_value, window_start, window_end, body)
  values (p_name, p_scope_type, p_scope_value, p_window_start, p_window_end, v_body)
  returning * into v_row;
  return v_row;
end
$$;

revoke execute on function public.take_snapshot(text, text, text, date, date) from public, anon, authenticated;
grant execute on function public.take_snapshot(text, text, text, date, date) to authenticated;
