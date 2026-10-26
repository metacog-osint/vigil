-- 155. ioc-geo reads the indicators that arrived since it last ran, not all of them
--
-- STATUS: NOT YET APPLIED.
--
-- THE FIFTH TIME
--
-- resolve_ioc_geo has timed out on and off since 097 created it. Each fix
-- removed a real cost: 106 moved address parsing out of the scan, 108 stopped
-- counting the table to report nothing, 109 made the scan index-only, and 150
-- had autovacuum keep the visibility map current. None of them changed the
-- shape of the query: every run reads every ip and cidr row in iocs, to find
-- the handful that arrived in the last hour. 150 said so in its own header -
-- "this buys time rather than settling it" - and named the durable fix: make
-- the pending set directly findable. The time it bought has run out.
--
-- MEASURED, 26 OCTOBER 2026
--
--   28 of 136 runs failed in the seven days to 26 October, 11 of 19 on the
--   26th itself, every one with 57014 at about 8.4 s. The successes averaged
--   5.0 s over the last 423 calls (pg_stat_statements), up from about 4 s at
--   the start of the month, against the 8 s that PostgREST's `authenticator`
--   role imposes on every worker RPC (150 explains why it is 8 s).
--
--   A successful run on the 26th placed 30 addresses. To find them it read
--   65,225 rows through idx_iocs_ip_like: 38,963 buffers, 23,798 heap fetches.
--   The visibility map has rotted again even with 150's settings, because the
--   ip rows are the ones re-sighted most - ThreatFox and Feodo update their
--   last_seen_at every hour, and an update clears the page's all-visible bit.
--   150 tuned the insert trigger; this is update churn.
--
--   The same query, same plan, same 38,963 buffers, all of them shared hits,
--   took 52 ms on one run and 5,161 ms on another a few minutes apart. The
--   instance is Micro (shared_buffers 224 MB, max_connections 60) carrying a
--   1 GB iocs table, so how long a 39,000-buffer read takes depends on what
--   else the machine is doing. A job that must read the whole table every
--   hour on that machine will keep landing on the wrong side of 8 s however
--   the plan is tuned.
--
-- WHAT CHANGES
--
-- The run reads only indicators created since the last run that finished,
-- with six hours of overlap, through idx_iocs_type_created (type, created_at
-- DESC), which already exists. The mark is kept in feed_cursors under
-- 'ioc-geo', next to ofac-sdn's and ransomwhere's. About 20 ip indicators
-- arrive an hour, so a run reads roughly 140 rows instead of 65,000 - and that
-- number stays put as the table grows.
--
--   A seven-day window, as a worst case: 3,335 rows, 14,194 buffers, measured
--   with the generic plan PL/pgSQL settles on. The hourly window is a fraction
--   of that.
--
-- WHY A WATERMARK AND NOT A FLAG ON iocs
--
-- 150 suggested a geo_checked column. Setting it means updating iocs, and two
-- triggers fire on every update: iocs_updated_at, which would make each
-- located indicator look freshly changed, and trigger_changelog_iocs, which
-- would write a changelog entry saying so - about 30 false "changed" records
-- an hour in the history, which is the product. A watermark writes nothing to
-- iocs.
--
-- WHY IT CANNOT MISS ROWS
--
-- created_at defaults to now(), the inserting transaction's start, and nothing
-- in workers/, supabase/functions/ or the live write paths sets it. Measured:
-- no ip indicator in the last 30 days was located more than three days after
-- its created_at. Six hours of overlap covers a transaction that started
-- before the mark and committed after it; the worker's cron invocations are
-- cut off at 15 minutes.
--
-- The mark only advances when a run finishes its window. A run that fills its
-- p_limit batch leaves the mark where it was, so the next run carries on from
-- the same place instead of skipping what it did not reach.
--
-- If a row is ever inserted with an old created_at - a manual backfill, say -
-- rewind the mark and the next run picks it up:
--
--   update feed_cursors
--   set cursor = jsonb_set(cursor, '{checked_through}', to_jsonb(now() - interval '30 days'))
--   where feed_id = 'ioc-geo';
--
-- To confirm nothing is waiting, from the SQL editor (no 8 s limit there):
--
--   select count(*) from iocs i where i.type in ('ip','cidr')
--     and not exists (select 1 from ioc_geo g where g.ioc_id = i.id);
--
-- WHAT THE RESULT LOSES AND GAINS
--
-- 'remaining' is gone. It was a second full pass over the table, run whenever
-- the job placed anything - which made the successful runs the slow ones.
-- Nothing reads it. 'added' is new: the scheduler logs result.added as
-- records_added, so sync_log stops reporting 0 rows written for a job that
-- writes every hour. 'checked_from' says where the window started.

set local lock_timeout = '5s';

-- Start the mark at the oldest indicator still waiting, or now if none is.
-- This is the full pass, once, as postgres, where there is no 8 s limit.
insert into feed_cursors (feed_id, cursor, updated_at)
select 'ioc-geo',
       jsonb_build_object('checked_through', coalesce(min(i.created_at), now())),
       now()
from iocs i
where i.type in ('ip', 'cidr')
  and not exists (select 1 from ioc_geo g where g.ioc_id = i.id)
on conflict (feed_id) do nothing;

create or replace function public.resolve_ioc_geo(p_limit integer default 5000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_started   timestamptz := now();
  v_batch     int := greatest(1, p_limit);
  v_since     timestamptz;
  v_read      int := 0;
  resolved    int := 0;
  unplaceable int := 0;
begin
  if not exists (select 1 from ip_geo_ranges limit 1) then
    return jsonb_build_object('skipped', 'ip_geo_ranges is empty');
  end if;

  -- Six hours before the last finished run. With no mark at all, a week: far
  -- longer than feed_health lets this job stay broken unnoticed.
  select (cursor ->> 'checked_through')::timestamptz - interval '6 hours'
    into v_since
    from feed_cursors
   where feed_id = 'ioc-geo';
  v_since := coalesce(v_since, v_started - interval '7 days');

  with todo as materialized (
    select i.id, i.value
    from iocs i
    where i.type in ('ip', 'cidr')
      and i.created_at >= v_since
      and not exists (select 1 from ioc_geo g where g.ioc_id = i.id)
    limit v_batch
  ), parsed as (
    select t.id, ioc_ip(t.value) as ip
    from todo t
  ), placed as (
    insert into ioc_geo (ioc_id, ip, country_code)
    select p.id, p.ip, ip_country(p.ip)
    from parsed p
    where p.ip is not null
    on conflict (ioc_id) do nothing
    returning country_code
  )
  select (select count(*) from todo),
         (select count(*) from placed),
         (select count(*) from placed where country_code is null)
    into v_read, resolved, unplaceable;

  -- A full batch may have left rows in the window. Keep the mark, and the
  -- next run starts from the same place.
  if v_read < v_batch then
    insert into feed_cursors (feed_id, cursor, updated_at)
    values ('ioc-geo', jsonb_build_object('checked_through', v_started), now())
    on conflict (feed_id) do update
      set cursor = excluded.cursor, updated_at = excluded.updated_at;
  end if;

  if resolved = 0 then
    return jsonb_build_object('resolved', 0, 'added', 0, 'checked_from', v_since);
  end if;

  return jsonb_build_object(
    'resolved', resolved,
    'added', resolved,
    'no_country_in_ranges', unplaceable,
    'checked_from', v_since,
    'total_placed', (select count(*) from ioc_geo where country_code is not null)
  );
end;
$fn$;

comment on function public.resolve_ioc_geo(integer) is
  'Places ip and cidr indicators created since the last finished run (plus six '
  'hours of overlap) into ioc_geo. The mark is feed_cursors ''ioc-geo''. '
  'See migration 155 for why it no longer reads every row.';

-- Who may call it, stated rather than inherited. Unchanged from today:
-- the worker, as service_role.
revoke execute on function public.resolve_ioc_geo(integer) from public, anon, authenticated;
grant execute on function public.resolve_ioc_geo(integer) to service_role;
