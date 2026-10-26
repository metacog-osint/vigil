-- 153. Say how old a snapshot feed's data is, next to how fresh its check is
--
-- STATUS: NOT YET APPLIED.
--
-- WHY
--
-- ransomwhere reads a static archive: the Zenodo deposit, v1.1.0, published
-- 2024-10-27, last payment 2024-08-19. Its weekly job checks the deposit's
-- version and imports only when it changes. Until this change the Edge Function
-- reported an unchanged deposit as `skipped`, the scheduler recorded that as a
-- skipped run, and feed_health - which counts only successes - called the feed
-- stale from 11 October. Marked critical, it failed the twice-daily feed-health
-- workflow 29 times running, so a real outage would have arrived as one more
-- copy of an email already being ignored.
--
-- The Edge Function now reports `unchanged: true`, as ofac-sdn already does, and
-- a confirmed check counts as a successful run. That makes ransomwhere `fresh`
-- after every weekly check. Fresh is true of the check and false of the data,
-- and migration 152 says why that difference matters: "a feed that reported
-- itself fresh every day while serving two-year-old data would be lying in the
-- way this project exists not to".
--
-- So the age of the data goes in the same row as the freshness of the check.
-- feed_cursors already holds snapshot_version and snapshot_published for
-- ransomwhere (written by the Edge Function on import), and any future snapshot
-- source that records the same keys gets the same columns for free. A live feed
-- has no snapshot and reads null, which is the honest answer.
--
-- WHAT THIS DOES NOT CHANGE
--
-- state, minutes_since_success and ingestion_is_healthy() are untouched. Two
-- new columns are appended at the end, which CREATE OR REPLACE VIEW permits;
-- every existing reader names its columns (the scheduler, scripts/check-feed-
-- health.mjs) or reads critical and state (ingestion_is_healthy), so none of
-- them sees a difference.
--
-- WHY snapshot_published STAYS TEXT
--
-- The scheduler and the feed-health alert both read this view. A ::date cast
-- here would let one malformed cursor value take down scheduling and alerting
-- together. The value is an ISO date as Zenodo publishes it; readers that want
-- a date can cast it themselves.
--
-- GRANTS
--
-- CREATE OR REPLACE keeps the existing grants. They are restated anyway, so the
-- view's readability does not rest on history - Supabase requires explicit
-- grants on new public objects from 30 October 2026.

create or replace view public.feed_health
with (security_invoker = true) as
with runs as (
  select
    source,
    max(completed_at) filter (where status = 'success') as last_success_at,
    max(completed_at)                                   as last_attempt_at
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
  c.cursor ->> 'snapshot_published'                             as snapshot_published
from feed_expectations e
left join runs         r on r.source = e.feed_id
left join latest       l on l.source = e.feed_id
left join feed_cursors c on c.feed_id = e.feed_id;

comment on view public.feed_health is
  'Per-feed freshness: expected cadence against the last successful run. state '
  'is fresh / late / stale / never. A skipped run is not a successful one. '
  'state describes the check, not the data: for a snapshot source, '
  'snapshot_version and snapshot_published say how old the data is.';

grant select on public.feed_health to anon, authenticated;
