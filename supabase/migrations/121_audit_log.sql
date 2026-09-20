-- Migration: one audit log, with the columns its interface writes
-- Drafted: September 20, 2026
--
-- Vigil has been keeping two audit logs, and neither worked.
--
-- api/_lib/audit.js writes server-side events to audit_log with the service key -
-- API key creation, rotation, deletion. src/lib/auditLogs.js reads and writes
-- audit_logs, which does not exist, so the Settings > Audit Logs tab has failed
-- on every call since it shipped. The table holds zero rows.
--
-- They are the same log. This migration keeps audit_log - it has the writer, the
-- audit_activity_summary view and the existing policy - and gives it the seven
-- columns the interface expects. src/lib/auditLogs.js moves onto it in the same
-- commit.
--
-- The interface wrote `metadata` where the API writes `details`. They are the
-- same field, so no second column is added; the code maps onto details.
--
-- Two things worth saying plainly:
--
--   * audit_activity_summary was not security_invoker, so it ran with the
--     owner's rights and showed every user's activity to every signed-in user.
--     That is fixed here.
--   * The interface writes its own audit entries from the browser, which means
--     the subject of an entry can create it. That is a record of activity, not
--     proof of it, and it is not what a compliance reviewer will assume. The
--     server-side path through api/_lib/audit.js is the trustworthy one. A
--     finding is filed rather than quietly leaving the distinction unstated.

-- ---------------------------------------------------------------------------
-- 1. The columns the interface writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_name      text,
  ADD COLUMN IF NOT EXISTS team_id        uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_type     text,
  ADD COLUMN IF NOT EXISTS event_category text,
  ADD COLUMN IF NOT EXISTS resource_name  text,
  ADD COLUMN IF NOT EXISTS description    text;

COMMENT ON COLUMN public.audit_log.details IS
  'Structured context for the event. src/lib/auditLogs.js calls this metadata.';
COMMENT ON COLUMN public.audit_log.event_type IS
  'Dotted event name from EVENT_TYPES in src/lib/auditLogs.js, e.g. api_key.created';

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_team_created
  ON public.audit_log (team_id, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_category
  ON public.audit_log (event_category, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Who may read and write it
-- ---------------------------------------------------------------------------
-- Now that teams exist, a team's admins can review their own team's entries.
-- Nobody can read anyone else's.
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text
         OR (team_id IS NOT NULL AND public.is_team_admin(team_id)));

-- A user may record their own activity and nobody else's. The service role
-- bypasses RLS, so api/_lib/audit.js is unaffected.
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

-- Deliberately no UPDATE or DELETE policy. An audit entry is not editable
-- through the API by anyone, including its subject.

-- The summary view ran with the owner's rights, so it showed everybody's
-- activity to everybody. Now filtered by the caller's own policy.
ALTER VIEW public.audit_activity_summary SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 3. Retention and capture settings, per team
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log_settings (
  team_id                 uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  retention_days          integer NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 1 AND 3650),
  log_auth_events         boolean NOT NULL DEFAULT true,
  log_data_events         boolean NOT NULL DEFAULT true,
  log_export_events       boolean NOT NULL DEFAULT true,
  log_settings_events     boolean NOT NULL DEFAULT true,
  log_admin_events        boolean NOT NULL DEFAULT true,
  log_api_events          boolean NOT NULL DEFAULT true,
  auto_export_enabled     boolean NOT NULL DEFAULT false,
  auto_export_format      text,
  auto_export_frequency   text,
  auto_export_destination text,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log_settings IS
  'Per-team audit capture and retention. One row per team; the modal in AuditLogs.jsx writes it.';

ALTER TABLE public.audit_log_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_settings_read ON public.audit_log_settings;
CREATE POLICY audit_log_settings_read ON public.audit_log_settings
  FOR SELECT TO authenticated USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS audit_log_settings_write ON public.audit_log_settings;
CREATE POLICY audit_log_settings_write ON public.audit_log_settings
  FOR ALL TO authenticated
  USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));

-- ---------------------------------------------------------------------------
-- 4. Say what the log does and does not prove
-- ---------------------------------------------------------------------------
SELECT public.record_finding(
  'audit_log_trust',
  'Browser-written audit entries are self-reported',
  'warning', 'open',
  jsonb_build_object(
    'question', 'Should src/lib/auditLogs.js route through the API rather than writing audit_log directly?',
    'detail', 'RLS lets a signed-in user insert entries with their own user_id, so the subject of an entry can create it. That is a record of activity, not proof of it.',
    'trustworthy_path', 'api/_lib/audit.js, which writes with the service key from the server',
    'note', 'No UPDATE or DELETE policy exists, so entries cannot be altered or removed through the API once written')
);
