-- Migration: indexes the alert evaluator needs to finish inside a cron slot
-- Drafted: September 20, 2026
--
-- evaluate_alert_rules() took 12.5 seconds against the live database, and timed out
-- entirely at 26 seconds on a cold call. It looks at the last 75 minutes of incidents
-- and vulnerabilities, and neither table had an index on created_at, so every rule
-- sequentially scanned all 39,530 incidents - 3.3 seconds each, measured - to find
-- the handful of rows that arrived since the last run.
--
-- The deduplication check has the same problem from the other side: it asks whether
-- this user has already been told about this item, against 9,147 notifications with
-- no index that answers it.
--
-- These are cheap indexes on small tables. Without them the hourly job would have
-- been the slowest thing the worker does, for the least work.

CREATE INDEX IF NOT EXISTS idx_incidents_created_at
  ON public.incidents (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_created_at
  ON public.vulnerabilities (created_at DESC);

-- Answers "has this user already been told about this item?" in one lookup.
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (user_id, notification_type, related_id);
