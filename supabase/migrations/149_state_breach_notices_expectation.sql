-- 149. Watch state-breach-notices under the id the worker logs it as
--
-- STATUS: NOT YET APPLIED.
--
-- WHAT WAS BROKEN
--
-- Migration 141 added the California AG registry as its own feed, 'ca-ag'.
-- Migration 143 folded California, Washington and Oregon into one job, and the
-- worker has logged that job to sync_log as 'state-breach-notices' ever since.
-- The feed_expectations row was never renamed, which did two things:
--
--   1. The scheduler reads feed_health by job id. With no row for
--      'state-breach-notices' it saw a job that had never succeeded, and a job
--      that has never succeeded is always due. A daily feed ran on every hourly
--      tick - 323 runs in 30 days - at about ten subrequests each.
--   2. 'ca-ag' had one sync_log row (22 September) and nothing after it, so
--      feed_health reported it stale while the feed was running hourly.
--
-- 'ca-ag' is still the source key for California notices in
-- victim_disclosures and DISCLOSURE_SOURCES; only the feed id changes here.

update feed_expectations
set
  feed_id = 'state-breach-notices',
  expected_interval_minutes = 1440,
  note = 'California, Washington and Oregon AG breach registries, one Edge '
    || 'Function (state-breach-notices). California alone is 5,302 notices back '
    || 'to January 2012, covering every cause of breach rather than ransomware '
    || 'alone. The victim''s own account to a regulator, so it sits with the SEC '
    || 'filings in victim_disclosures. Never matched to an incident: whether a '
    || 'notice and a leak-site claim describe one event is a judgment, and '
    || 'match_status stays unreviewed. Scheduled runs read the newest pages; the '
    || 'full backfill is a manual call with {"backfill": true}.'
where feed_id = 'ca-ag'
  and not exists (
    select 1 from feed_expectations where feed_id = 'state-breach-notices'
  );
