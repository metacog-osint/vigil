-- 197. A run that reads far fewer rows than the feed normally has is not a clean success
--
-- STATUS: APPLIED. /api/feed selects the new columns; without them its health
-- read fails and the feed goes out with no health block.
--
-- WHY
--
-- On 22 November 2026 ThreatCluster replaced its 90-day victims file with a
-- 7-day file. Vigil's next run parsed 16 rows against about 2,950 the day before,
-- filled no country, and logged success. feed_health said fresh, and claims with
-- a country fell to 0 of 14 (22 Nov) and 0 of 64 (23 Nov). 163 catches a feed
-- that adds nothing new. It cannot catch this: an enrichment feed adds nothing
-- new by design, and the run itself worked.
--
-- WHAT IT ADDS
--
--   feed_expectations.min_rows_per_run  the fewest rows a working run reads
--   feed_expectations.row_floor_note    where the floor came from, or why none
--   feed_health.last_rows               rows read by the last successful run
--   feed_health.below_floor             true when that is under the floor
--
-- Rows read are metadata.result.parsed where the feed reports it, otherwise
-- records_processed. sync_log is not changed and status still reads success: the
-- judgment is in the view, so it needs no worker deploy and applies to history.
--
-- THE FLOORS
--
-- Measured 23 November 2026 over the 30 days of successful runs in sync_log.
-- Each sits under the lowest ordinary run, so a floor fires on a collapse and
-- not on a quiet day.
--
--   feed               usual   lowest  floor
--   threatcluster      2,803   16*     500    *the 23 Nov collapse
--   cisa-kev           1,773   1,756   1,500
--   epss               1,960   0**     1,000  **one run; usual low is 1,915
--   nvd                2,000   2,000   1,000
--   threatfox          1,512   498     200
--   tor-exits          1,246   1,210   1,000
--   misp-galaxy        1,118   1,101   900
--   ofac-sdn           1,081   1,075   900
--   urlhaus            1,000   594     300
--   etda-actors        355     355     250
--   anyrun-trends      50      50      25
--   cisa-ics           30      30      15
--   vendor-exploited   30      30      15
--   fincen-advisories  78      15      10
--   cisa-advisories    10      10      5
--   ncsc-advisories    8       7       3
--
-- threatcluster will read below its floor every day while the free file stays
-- capped. That is meant: the lane then says why claims have no country.
--
-- Every other feed gets a note saying why it has no floor. Null is "not watched"
-- (163). pulsedive is the known gap: its runs are often 0, so a per-run floor
-- cannot see its 24 to 31 October slump, which needs a floor over a day.
--
-- Every value can be changed with one UPDATE on feed_expectations.
-- ingestion_is_healthy() is not changed, so no floor fails the workflow.

alter table public.feed_expectations
  add column if not exists min_rows_per_run integer
    check (min_rows_per_run is null or min_rows_per_run > 0),
  add column if not exists row_floor_note text;

comment on column public.feed_expectations.min_rows_per_run is
  'Fewest rows a working run reads. Below it, feed_health.below_floor is true. '
  'Null: no per-run floor; row_floor_note says why.';

update public.feed_expectations as e
   set min_rows_per_run = v.floor,
       row_floor_note = 'Measured over 30 days to 23 Nov 2026: usual ' || v.usual || ' rows a run.'
  from (values
    ('threatcluster',      500, 2803),
    ('cisa-kev',          1500, 1773),
    ('epss',              1000, 1960),
    ('nvd',               1000, 2000),
    ('threatfox',          200, 1512),
    ('tor-exits',         1000, 1246),
    ('misp-galaxy',        900, 1118),
    ('ofac-sdn',           900, 1081),
    ('urlhaus',            300, 1000),
    ('etda-actors',        250,  355),
    ('anyrun-trends',       25,   50),
    ('cisa-ics',            15,   30),
    ('vendor-exploited',    15,   30),
    ('fincen-advisories',   10,   78),
    ('cisa-advisories',      5,   10),
    ('ncsc-advisories',      3,    8)
  ) as v(feed_id, floor, usual)
 where e.feed_id = v.feed_id;

update public.feed_expectations
   set row_floor_note = case
     when feed_id = 'pulsedive'
       then 'Runs are often 0, so a per-run floor cannot see a slump; needs a floor over a day.'
     when feed_id in ('actor-status', 'actor-trend-snapshot', 'alert-rules', 'campaign-links',
                      'data-quality', 'ioc-geo', 'leak-site-notices', 'public-summary')
       then 'A check or derivation, not a source: it reads no upstream rows.'
     else 'Logs no reliable rows-read count, or 0 is an ordinary run.'
   end
 where min_rows_per_run is null;

create or replace view public.feed_health
with (security_invoker = true) as
with runs as (
  select
    source,
    max(completed_at) filter (where status = 'success') as last_success_at,
    max(completed_at)                                   as last_attempt_at,
    max(completed_at) filter (where records_added > 0
                                and metadata ? 'new_counted') as last_new_at,
    min(completed_at) filter (where metadata ? 'new_counted') as new_counted_since
  from sync_log
  group by source
),
latest as (
  select distinct on (source)
    source, status, error_message, completed_at
  from sync_log
  order by source, completed_at desc
),
latest_success as (
  select distinct on (source)
    source,
    case
      when metadata -> 'result' ->> 'parsed' ~ '^[0-9]+$'
        then (metadata -> 'result' ->> 'parsed')::integer
      else records_processed
    end as last_rows
  from sync_log
  where status = 'success'
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
    when r.new_counted_since is null   then null
    else now() - coalesce(r.last_new_at, r.new_counted_since)
         > make_interval(mins => e.stall_after_minutes)
  end                                                           as stalled,
  r.new_counted_since,
  e.min_rows_per_run,
  s.last_rows,
  case
    when e.min_rows_per_run is null or s.last_rows is null then null
    else s.last_rows < e.min_rows_per_run
  end                                                           as below_floor
from feed_expectations e
left join runs           r on r.source = e.feed_id
left join latest         l on l.source = e.feed_id
left join latest_success s on s.source = e.feed_id
left join feed_cursors   c on c.feed_id = e.feed_id;

comment on view public.feed_health is
  'Per-feed freshness: expected cadence against the last successful run. state '
  'is fresh / late / stale / never. A skipped run is not a successful one. '
  'state describes the check, not the data: for a snapshot source, '
  'snapshot_version and snapshot_published say how old the data is, and for a '
  'feed with stall_after_minutes, stalled says it has run without adding a '
  'record for longer than it does when working (null: not watched, or its '
  'count has not begun). last_new_at and stalled read only sync_log rows with '
  'metadata.new_counted, written from 167 on; new_counted_since is the first. '
  'below_floor (197) says the last successful run read fewer rows than '
  'min_rows_per_run (null: no floor, see feed_expectations.row_floor_note).';

revoke all on public.feed_health from anon, authenticated;
grant select on public.feed_health to anon, authenticated, service_role;
