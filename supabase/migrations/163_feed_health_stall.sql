-- 163. A feed that runs and brings nothing new: say so, for the feeds where that is abnormal
--
-- STATUS: APPLIED 15 November 2026, 03:29 UTC (project faqazkwdkajhxmwxchop),
-- with the 18 h threshold for ransomlook.
--
-- WHY
--
-- From 22:15 UTC on 11 November 2026 to 06:45 UTC on 13 November, RansomLook's
-- /api/recent returned the same 100 posts on every hourly run: 32.5 hours with
-- no new leak-site claim. Each run logged success, 0 added, 100 skipped. So
-- feed_health called ransomlook fresh throughout, ingestion_is_healthy()
-- returned true, and the twice-daily Feed health workflow passed. Nothing said
-- anything.
--
-- Nothing was lost on Vigil's side. RansomLook's own API, read once on 15 Nov
-- (/api/last/5), has no post discovered on 12 Nov, and its counts for 10 to
-- 15 Nov match Vigil's exactly: 86, 38, 0, 48, 16, 1. Whether 12 Nov was a
-- lull or an outage at RansomLook is not settled here; an independent tracker
-- could not be reached to compare. Either way a reader of Vigil, and of COP,
-- which merges Vigil's feed, saw a quiet day where there was no data.
--
-- `state` is about the check: did the job run and succeed. It stays as it is
-- (153: "state describes the check, not the data"). This adds the other half,
-- for feeds where a long silence is itself abnormal: when the job last brought
-- a new record, and whether that is longer ago than the feed goes when it is
-- working. Absence and zero are different answers; this is how the view tells
-- them apart.
--
-- THE THRESHOLD
--
-- feed_expectations.stall_after_minutes is set per feed, and only where a long
-- silence is abnormal. Most feeds add nothing for days by design (cisa-kev,
-- the weekly snapshots), so it is null, and null means not watched for stalls.
--
-- ransomlook gets 18 hours (1,080 minutes). Measured 15 Nov 2026 from
-- sync_log, runs with records_added above zero, since continuous running began
-- in late September: the longest stretches without a new claim were 36.0 h
-- (3-4 Nov, the paused database), 32.5 h (11-13 Nov, this case) and 20.0 h
-- (3-4 Oct), then 17.0, 15.0, 14.0 and 13.0 h. At 18 hours the check fires on
-- the three longest and on nothing else. (Two earlier gaps, 158.7 h from 13 Jan
-- and 2,737.9 h from 29 May, are from before the worker ran continuously.)
-- The threshold is Tom's call; changing it is one UPDATE on feed_expectations,
-- and nothing but this view reads the column.
--
-- WHAT COUNTS AS NEW
--
-- A run whose records_added is above zero, whatever its status: a partial run
-- that added claims did bring new data. ransomlook writes records_added from
-- the worker's own count of inserted rows (workers/src/feeds/ransomlook.js),
-- after matching against claims already stored, so a repeat is never counted.
--
-- WHAT THIS CHANGES
--
-- feed_health: four columns appended at the end, which is all CREATE OR
--   REPLACE VIEW allows: stall_after_minutes, last_new_at, minutes_since_new,
--   stalled. Every existing column is unchanged. The scheduler reads feed_id,
--   last_success_at and minutes_since_success, so it sees no difference.
--   `stalled` is null, not false, for a feed that is not watched, or that has
--   never succeeded (`state` = 'never' already says that): "not watched" and
--   "watched and fine" are different answers.
-- ingestion_is_healthy(): also false when a critical feed is stalled. Its
--   comment says it is "intended to gate any claim that the data is current",
--   and a stalled ransomlook is data that is not current. Nothing in src/ or
--   api/ calls it (checked 15 Nov 2026).
-- Outside this file, in the same change: scripts/check-feed-health.mjs fails
--   on a stalled critical feed, so the workflow mails it; /api/feed carries a
--   per-source `health` block saying so, the shape Cordon's and Blackout's
--   feeds use, which COP's suite ledger reads.
--
-- ORDER
--
-- Apply this before merging the change: the script and /api/feed name the new
-- columns, and the script fails if the view does not have them.
--
-- GRANTS
--
-- CREATE OR REPLACE keeps a view's grants, and the new column takes the
-- table's. Restated anyway (CLAUDE.md reminder 12). The view's live grants on
-- 15 Nov were every privilege to anon and authenticated, left over from the
-- old defaults; select is all anything uses, so the rest are revoked.
-- ingestion_is_healthy() is not SECURITY DEFINER, so rule 2 does not apply;
-- its execute grant is restated.

alter table public.feed_expectations
  add column if not exists stall_after_minutes integer
  check (stall_after_minutes is null or stall_after_minutes > 0);

comment on column public.feed_expectations.stall_after_minutes is
  'Longest a working feed goes without adding a record. Past it, feed_health.stalled '
  'is true. Null: not watched for stalls, because a long silence is normal for it. '
  'Migration 163 has the measurement behind each value.';

update public.feed_expectations
   set stall_after_minutes = 1080
 where feed_id = 'ransomlook';

create or replace view public.feed_health
with (security_invoker = true) as
with runs as (
  select
    source,
    max(completed_at) filter (where status = 'success') as last_success_at,
    max(completed_at)                                   as last_attempt_at,
    max(completed_at) filter (where records_added > 0)  as last_new_at
  from sync_log
  group by source
),
latest as (
  select distinct on (source)
    source, status, error_message, completed_at
  from sync_log
  order by source, completed_at desc
)
select
  e.feed_id,
  e.expected_interval_minutes,
  e.critical,
  e.note,
  r.last_success_at,
  r.last_attempt_at,
  l.status                                                      as last_status,
  l.error_message                                               as last_error,
  round(extract(epoch from (now() - r.last_success_at)) / 60)::int
                                                                as minutes_since_success,
  case
    when r.last_success_at is null then 'never'
    when now() - r.last_success_at
         > make_interval(mins => e.expected_interval_minutes * 3) then 'stale'
    when now() - r.last_success_at
         > make_interval(mins => e.expected_interval_minutes)     then 'late'
    else 'fresh'
  end                                                           as state,
  c.cursor ->> 'snapshot_version'                               as snapshot_version,
  c.cursor ->> 'snapshot_published'                             as snapshot_published,
  e.stall_after_minutes,
  r.last_new_at,
  round(extract(epoch from (now() - r.last_new_at)) / 60)::int  as minutes_since_new,
  case
    when e.stall_after_minutes is null then null
    when r.last_success_at is null     then null
    when r.last_new_at is null         then true
    else now() - r.last_new_at > make_interval(mins => e.stall_after_minutes)
  end                                                           as stalled
from feed_expectations e
left join runs         r on r.source = e.feed_id
left join latest       l on l.source = e.feed_id
left join feed_cursors c on c.feed_id = e.feed_id;

comment on view public.feed_health is
  'Per-feed freshness: expected cadence against the last successful run. state '
  'is fresh / late / stale / never. A skipped run is not a successful one. '
  'state describes the check, not the data: for a snapshot source, '
  'snapshot_version and snapshot_published say how old the data is, and for a '
  'feed with stall_after_minutes, stalled says it has run without adding a '
  'record for longer than it does when working (null: not watched).';

revoke all on public.feed_health from anon, authenticated;
grant select on public.feed_health to anon, authenticated, service_role;

create or replace function public.ingestion_is_healthy()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from feed_health
    where critical and (state in ('stale', 'never') or coalesce(stalled, false))
  );
$$;

grant execute on function public.ingestion_is_healthy() to anon, authenticated;

comment on function public.ingestion_is_healthy() is
  'False when any feed marked critical has missed three of its own intervals, '
  'or has run without adding a record for longer than its stall_after_minutes '
  '(163). Intended to gate any claim that the data is current.';
