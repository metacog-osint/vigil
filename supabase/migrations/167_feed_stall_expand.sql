-- 167. Watch more feeds for stalls, counting only what the worker now counts
--
-- STATUS: NOT APPLIED. Apply only after the worker deploy that writes
-- metadata.new_counted (cd workers && npm run deploy); the guard below refuses
-- to run before it.
--
-- WHY
--
-- 163 watched ransomlook alone, because in the 30 days to 15 November 2026 only
-- ransomlook and ioc-geo wrote records_added above zero. Every other job logged
-- 0 whatever it brought: the scheduler read `added` and almost nothing returned
-- it. The upsert feeds reported every row written as `updated` (ThreatFox:
-- 484 runs, 757,520 "updated", 0 added), and the Edge Function feeds reported
-- their real insert counts under other names (`new`, `advisories_new`,
-- `filings_new`, `reports_new`), which the scheduler never read. Any of them
-- given a threshold would have read stalled at once.
--
-- The same worker change that this migration waits for makes records_added
-- mean "genuinely new records" for every job that can say, and null for every
-- job that cannot:
--   - the upsert feeds (threatfox, urlhaus, feodo, malwarebazaar, pulsedive,
--     tor-exits, bgpstream, nvd, cisa-kev, cisa-ics, anyrun-trends) ask
--     PostgREST for created_at back on the same request and count the rows
--     stamped with that statement's transaction time
--     (workers/src/lib/supabase.js, countInsertedRows);
--   - the Edge Function feeds have their own count read by name
--     (workers/src/feeds/registry.js, countNew);
--   - every row with a real count carries metadata.new_counted = true.
--
-- HISTORY BEFORE THE COUNT
--
-- sync_log rows written before that deploy say 0 for runs that brought
-- thousands of records, and some still carry counts from the legacy scripts
-- (malwarebazaar 14 Jan, nvd 13 Jan, feodo 30 May). Read as they are, a feed
-- given a threshold here would read stalled the moment this is applied.
--
-- So the view now reads only counted rows:
--   new_counted_since  the first run with new_counted: when the count began
--   last_new_at        the last counted run that added a record (was: any row)
--   stalled            null until the count has begun; then true once
--                      stall_after_minutes have passed since last_new_at, or
--                      since new_counted_since if nothing has been added yet
-- A feed whose count began an hour ago therefore cannot be stalled until a
-- whole threshold has passed with nothing new, which is the definition.
--
-- What that costs ransomlook: its pre-deploy counts were real (163), but they
-- carry no mark. Its clock restarts at the deploy. Its threshold is 18 h and it
-- adds claims most hours, so last_new_at is back within an hour or two, and a
-- stall already under way at the deploy is found up to 18 h late. The guard
-- below keeps the other failure out: applied before the deploy, ransomlook
-- would have no counted rows and read null, unwatched, which is the silence
-- 163 exists to end.
--
-- THE THRESHOLDS
--
-- Measured 15 November 2026 over the 45 days since 1 October, from the data
-- tables' own created_at (when Vigil first stored each record) for the upsert
-- feeds, and from sync_log.metadata.result for the Edge Function feeds, which
-- have logged real counts there all along. Gaps are between hours in which the
-- feed brought anything new. For every iocs and vulnerabilities feed the
-- longest gap is 3-4 November, when the database was paused (163 has it at
-- 36 h for ransomlook); it is left out of "longest ordinary gap" below and every
-- threshold would have fired on it, as it should.
--
--   feed                  runs every  longest ordinary gaps        threshold
--   threatfox             1 h         6, 5, 5 h                    12 h
--   urlhaus               6 h         14, 8, 8 h                   24 h
--   malwarebazaar         6 h         14, 12, 9 h                  24 h
--   nvd                   6 h         13, 12, 9 h                  24 h
--   tor-exits             1 day       34, 30, 26 h                 72 h
--   vendor-research       6 h         82, 67, 63 h                 144 h
--   state-breach-notices  1 day       97, 75, 73 h                 144 h
--
-- Caveats on those numbers:
--   - iocs.source is the feed that last wrote the row, not the first, so the
--     iocs gaps credit an indicator to whichever feed touched it last. The
--     effect is to make a feed look busier than it is, if anything.
--   - nvd is measured on the vulnerabilities table as a whole. cisa-kev writes
--     there too but adds a few CVEs a week against NVD's hundreds a day.
--   - tor-exits writes source 'tor_project' in iocs; that is what was measured.
--   - vendor-research and state-breach-notices have 45 days of history, and
--     none over a holiday. 144 h (six days) leaves room for Thanksgiving week;
--     the end of December may still read stalled for a day or two.
--
-- LEFT UNWATCHED, and why. Null is "not watched", not "fine" (163).
--   cisa-kev            adds to its catalogue a few times a week, irregularly
--   pulsedive           new indicators in 33 hours of 45 days; gaps to 256 h
--   feodo               nothing new in 45 days: the botnet C2 list is near static
--   bgpstream           nothing new in 45 days
--   cisa-ics            weekly-ish; gaps to 172 h in 54 rows
--   anyrun-trends       gaps to 121 h, and a static fallback list on failure
--   cisa-advisories, ncsc-advisories, sec-edgar, fincen-advisories, ofac-sdn
--                       a new record in 1 to 5 runs out of 45 days: silence
--                       for weeks is how they work
--   ransomwhere         a snapshot; feed_health.snapshot_* covers it
--   epss, threatcluster, etda-actors, censys, malpedia, misp-galaxy, mitre,
--   mitre-atlas         refresh or enrich existing records; nothing they do is
--                       "new", so they log records_added null
--   data-quality, actor-status, alert-rules, leak-site-notices, campaign-links,
--   ioc-geo             checks and derivations, not sources
--
-- threatfox is critical (feed_expectations), so a stalled threatfox makes
-- ingestion_is_healthy() false and fails the Feed health workflow, as a stalled
-- ransomlook does. The others are not critical: they show in feed_health and
-- in the workflow's table, and fail nothing.
--
-- Every value is Tom's to change, with one UPDATE on feed_expectations.
--
-- GRANTS
--
-- CREATE OR REPLACE keeps the view's grants; restated anyway (reminder 12).
-- ingestion_is_healthy() is not changed.

do $$
begin
  if not exists (
    select 1 from public.sync_log
     where source = 'ransomlook' and metadata ? 'new_counted'
  ) then
    raise exception
      '167 needs the worker that writes metadata.new_counted. Deploy it '
      '(cd workers && npm run deploy), wait for a ransomlook run, then apply.';
  end if;
end
$$;

update public.feed_expectations as e
   set stall_after_minutes = v.minutes
  from (values
    ('threatfox',              720),
    ('urlhaus',               1440),
    ('malwarebazaar',         1440),
    ('nvd',                   1440),
    ('tor-exits',             4320),
    ('vendor-research',       8640),
    ('state-breach-notices',  8640)
  ) as v(feed_id, minutes)
 where e.feed_id = v.feed_id;

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
  r.new_counted_since
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
  'record for longer than it does when working (null: not watched, or its '
  'count has not begun). last_new_at and stalled read only sync_log rows with '
  'metadata.new_counted, written from 167 on; new_counted_since is the first.';

revoke all on public.feed_health from anon, authenticated;
grant select on public.feed_health to anon, authenticated, service_role;
