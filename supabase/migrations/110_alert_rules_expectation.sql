-- Migration: the alert evaluator joins the feeds that are watched for staleness
-- Drafted: September 20, 2026
--
-- 104 added evaluate_alert_rules and 105 made it fast enough to run on a schedule,
-- but nothing scheduled it: the registry in workers/src/feeds/registry.js is what
-- decides that, and feed_expectations (101) is what decides when a job counts as
-- late. The registry comment is explicit that the two move together, so this adds
-- the row that matches the job.
--
-- Marked critical: alerts are the one part of Vigil that is supposed to reach a
-- person without them opening the site. A rule evaluator that quietly stops is the
-- failure this whole health table exists to catch - it is exactly what happened on
-- 28 May, when rule evaluation stopped and nothing said so for four months.
--
-- The job runs hourly over a three-hour window. Delivery is deduplicated per user
-- and item, so the overlap cannot notify anyone twice; it means a missed hour is
-- picked up by the next run rather than leaving a hole in someone's alerts.

INSERT INTO feed_expectations (feed_id, expected_interval_minutes, critical, note) VALUES
  ('alert-rules', 60, true,
   'evaluate_alert_rules: matches new data against user rules and writes in-app notifications. Email is not sent from here.')
ON CONFLICT (feed_id) DO UPDATE
  SET expected_interval_minutes = EXCLUDED.expected_interval_minutes,
      critical = EXCLUDED.critical,
      note = EXCLUDED.note;
