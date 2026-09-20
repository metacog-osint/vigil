-- Migration: per-feed freshness, readable as a fact
-- Reviewed: September 20, 2026
--
-- Vigil could not answer "is this feed still running?" Every worker invocation
-- wrote a single sync_log row named `cloudflare-worker`, and only if the run got
-- that far. It usually did not: Workers Free refuses the 51st subrequest of an
-- invocation, the feeds spent the budget, and the write that recorded the run was
-- the one that got refused. 5,869 rows under one name, the last row naming an
-- actual feed dated 31 May.
--
-- So the feeds kept working and the record of them stopped. URLhaus has ingested
-- nothing since 30 May and nothing said so. CISA KEV ran on 19 September while the
-- last logged run of its cron was 30 August.
--
-- The worker now writes one row per job, under the job's own id (workers/src/
-- feeds/registry.js). This migration holds the other half: what each feed's
-- cadence is meant to be, and a view that compares it against what happened.
--
-- The cadences here and the intervals in the registry describe the same schedule.
-- The registry decides what to run; this decides what counts as late. Change one
-- and change the other.

-- ---------------------------------------------------------------------------
-- 1. What each feed is expected to do
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_expectations (
  feed_id                   TEXT PRIMARY KEY,
  expected_interval_minutes INTEGER NOT NULL CHECK (expected_interval_minutes > 0),
  critical                  BOOLEAN NOT NULL DEFAULT false,
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feed_expectations IS
  'Expected cadence per ingestion job. Mirrors intervalMinutes in workers/src/feeds/registry.js.';
COMMENT ON COLUMN feed_expectations.critical IS
  'Freshness claims Vigil makes in public depend on these. A stale critical feed is not a degraded view, it is a wrong one.';

INSERT INTO feed_expectations (feed_id, expected_interval_minutes, critical, note) VALUES
  -- Leak-site claims and the checks that run against them: hourly
  ('ransomlook',      60,    true,  'Leak-site claims. The landing page and every incident count rest on this.'),
  ('threatfox',       60,    true,  'Fresh IOCs.'),
  ('data-quality',    60,    true,  'run_data_quality_checks: duplicate merges, alias review queue, trend recompute.'),
  ('actor-status',    60,    true,  'apply_actor_status: defunct after 180 silent days, active again on a new claim.'),
  ('ioc-geo',         60,    false, 'resolve_ioc_geo against the local range table. No external call.'),

  -- Vulnerabilities
  ('cisa-kev',        360,   true,  'Exploited-vulnerability catalogue.'),
  ('vulncheck',       360,   false, 'Needs VULNCHECK_API_KEY.'),
  ('nvd',             360,   false, 'Rate-limited without an API key.'),
  ('epss',            1440,  false, 'Exploit prediction scores for CVEs already held.'),
  ('cisa-ics',        1440,  false, 'ICS/OT advisories.'),

  -- IOC feeds
  ('malwarebazaar',   360,   false, 'Needs ABUSECH_API_KEY.'),
  ('pulsedive',       360,   false, 'Needs PULSEDIVE_API_KEY.'),
  ('urlhaus',         360,   false, 'Needs ABUSECH_API_KEY. Ingested nothing between 30 May and this migration.'),
  ('feodo',           360,   false, 'Botnet C2 list.'),
  ('tor-exits',       1440,  false, 'Tor exit node list.'),

  -- Sanctions, payments, group profiles
  ('ofac-sdn',        1440,  true,  'OFAC-designated addresses. Sanctions claims must not be made from stale data.'),
  ('ransomware.live', 1440,  false, 'Group profiles: techniques, tooling, leak sites. Personal-use licence only.'),
  ('ransomwhere',     1440,  false, 'Reported ransom payments.'),

  -- Reference data
  ('malpedia',        1440,  false, 'Actor database.'),
  ('misp-galaxy',     1440,  false, 'Actor database.'),
  ('bgpstream',       1440,  false, 'Routing incidents.'),
  ('anyrun-trends',   1440,  false, 'Malware trends.'),
  ('censys',          1440,  false, 'Needs CENSYS_API_KEY.'),
  ('mitre',           10080, false, 'ATT&CK techniques.'),
  ('mitre-atlas',     10080, false, 'ATLAS techniques.')
ON CONFLICT (feed_id) DO UPDATE
  SET expected_interval_minutes = EXCLUDED.expected_interval_minutes,
      critical = EXCLUDED.critical,
      note = EXCLUDED.note;

ALTER TABLE feed_expectations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_expectations readable" ON feed_expectations;
CREATE POLICY "feed_expectations readable" ON feed_expectations
  FOR SELECT TO anon, authenticated USING (true);

-- The view reads sync_log per source; the existing single-column indexes make
-- this a scan of everything each time.
CREATE INDEX IF NOT EXISTS idx_sync_log_source_completed
  ON sync_log (source, completed_at DESC);

-- ---------------------------------------------------------------------------
-- 2. What actually happened
-- ---------------------------------------------------------------------------
--
-- `skipped` is deliberately not success. Six feeds return
-- `{ success: true, skipped: true }` when their API key is missing, which is how a
-- feed goes quiet while reporting that all is well. The worker records that as its
-- own status and this view treats it as no run at all.

DROP VIEW IF EXISTS feed_health;

CREATE VIEW feed_health
WITH (security_invoker = true) AS
WITH runs AS (
  SELECT
    source,
    max(completed_at) FILTER (WHERE status = 'success') AS last_success_at,
    max(completed_at)                                   AS last_attempt_at
  FROM sync_log
  GROUP BY source
),
latest AS (
  SELECT DISTINCT ON (source)
    source, status, error_message, completed_at
  FROM sync_log
  ORDER BY source, completed_at DESC
)
SELECT
  e.feed_id,
  e.expected_interval_minutes,
  e.critical,
  e.note,
  r.last_success_at,
  r.last_attempt_at,
  l.status                                                      AS last_status,
  l.error_message                                               AS last_error,
  round(extract(epoch FROM (now() - r.last_success_at)) / 60)::int
                                                                AS minutes_since_success,
  CASE
    WHEN r.last_success_at IS NULL THEN 'never'
    WHEN now() - r.last_success_at
         > make_interval(mins => e.expected_interval_minutes * 3) THEN 'stale'
    WHEN now() - r.last_success_at
         > make_interval(mins => e.expected_interval_minutes)     THEN 'late'
    ELSE 'fresh'
  END                                                           AS state
FROM feed_expectations e
LEFT JOIN runs   r ON r.source = e.feed_id
LEFT JOIN latest l ON l.source = e.feed_id;

COMMENT ON VIEW feed_health IS
  'Per-feed freshness: expected cadence against the last successful run. state is fresh / late / stale / never. A skipped run is not a successful one.';

-- Public, like the sync_log rows underneath it (migration 073 made those
-- publicly readable). Restricting the view while its source table is open would
-- be a gesture, not a control, and a monitoring service that will not say when
-- its own monitoring is degraded is the thing this work exists to prevent.
GRANT SELECT ON feed_health TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. One question, answerable in one line
-- ---------------------------------------------------------------------------
--
-- Whether Vigil is entitled to present its data as current. Nothing reads this
-- yet; it is what the "data as of" line and any degraded-monitoring banner should
-- be built on, rather than on a timestamp taken from the newest row of a table
-- (which stays recent even when only one feed is still writing).

-- SECURITY INVOKER: every caller can read the two tables underneath, so there is
-- nothing to elevate. An earlier draft made it DEFINER to work around anon not
-- being able to read feed_expectations, which the grant above settles properly -
-- a definer function that silently sees no feeds would answer "healthy" for the
-- worst possible reason.
CREATE OR REPLACE FUNCTION ingestion_is_healthy()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM feed_health
    WHERE critical AND state IN ('stale', 'never')
  );
$$;

-- Safe to expose: one boolean, no feed names and no error text.
GRANT EXECUTE ON FUNCTION ingestion_is_healthy() TO anon, authenticated;

COMMENT ON FUNCTION ingestion_is_healthy() IS
  'False when any feed marked critical has missed three of its own intervals. Intended to gate any claim that the data is current.';
