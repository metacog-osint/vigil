-- 181. Daily actor trend snapshots, written by the worker with the service role
--
-- STATUS: APPLIED 19 Nov 2026, 03:54 UTC, as 181_actor_trend_snapshot_daily (version 20261119035446).
--
-- WHY
--
-- actor_trend_history stops at 30 May 2026 (7,561 rows since 14 Jan). Its only
-- writer was scripts/snapshot-actor-trends.mjs, run by a GitHub workflow with the
-- anon key; after 073 closed the table to anon, the insert has nothing to write
-- with. threat_actors.trend_status, incidents_7d and incident_velocity are
-- overwritten in place every hour, so a day with no snapshot is a day of trend
-- history that cannot be recovered afterwards.
--
-- WHAT CHANGES
--
-- 1. snapshot_actor_trends() (007) is re-created with the same body plus the
--    actor's `status` (active or defunct, 096), stored in a new column
--    actor_status. It was already idempotent per day (ON CONFLICT on
--    actor_id, recorded_date updates the day's row), and still is: a second call
--    the same UTC day refreshes that day's rows and adds none.
-- 2. It becomes callable by service_role only (it was open by default).
-- 3. The worker's registry gets an 'actor-trend-snapshot' job that calls it once a
--    day (workers/src/feeds/registry.js). It takes effect at the next worker deploy.
-- 4. feed_expectations watches the job, not critical until it has run.
--
-- The days 31 May to the first run are not recoverable from this table. The
-- 7-day and 30-day counts for those days can be recomputed from `incidents`
-- (insert-only) if wanted; the trend_status label of those days cannot.

begin;

alter table public.actor_trend_history add column if not exists actor_status text;

comment on column public.actor_trend_history.actor_status is
  'threat_actors.status (active or defunct) on recorded_date. Null before migration 181.';

create or replace function public.snapshot_actor_trends()
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  snapshot_count integer := 0;
begin
  insert into actor_trend_history
    (actor_id, recorded_date, trend_status, incidents_7d, incidents_30d,
     incident_velocity, rank_position, actor_status)
  select
    id,
    current_date,
    trend_status,
    incidents_7d,
    coalesce((
      select count(*)
      from incidents
      where actor_id = threat_actors.id
        and discovered_date >= current_date - interval '30 days'
    ), 0) as incidents_30d,
    incident_velocity,
    row_number() over (order by incidents_7d desc nulls last),
    status
  from threat_actors
  where last_seen >= current_date - interval '30 days'
    or trend_status = 'ESCALATING'
  on conflict (actor_id, recorded_date)
  do update set
    trend_status = excluded.trend_status,
    incidents_7d = excluded.incidents_7d,
    incidents_30d = excluded.incidents_30d,
    incident_velocity = excluded.incident_velocity,
    rank_position = excluded.rank_position,
    actor_status = excluded.actor_status;

  get diagnostics snapshot_count = row_count;
  return snapshot_count;
end;
$fn$;

comment on function public.snapshot_actor_trends() is
  'Writes today''s (UTC) trend snapshot for active actors into actor_trend_history. '
  'Idempotent per day. Called daily by the worker job actor-trend-snapshot. 007, 181.';

revoke execute on function public.snapshot_actor_trends() from public, anon, authenticated;
grant execute on function public.snapshot_actor_trends() to service_role;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('actor-trend-snapshot', 1440, false,
   'Daily snapshot of every active actor''s trend into actor_trend_history (181). '
   'Replaces the anon-key GitHub script, which stopped on 30 May 2026. '
   'Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
