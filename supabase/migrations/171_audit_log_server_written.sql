-- 171. audit_log is written by the server only
--
-- STATUS: APPLIED about 05:41 UTC 16 November 2026.
--
-- Finding audit_log_trust (64d94786). Tom's verdict on 16 Nov 2026: confirmed.
--
-- WHY
--
-- 121's audit_log_insert policy let a signed-in user insert any entry carrying
-- their own user_id. The subject of an entry could write their own record,
-- with whatever event, IP address and user agent they liked: self-report, not
-- evidence. The browser now posts to /api/audit (api/audit.js), which takes
-- who acted from the verified token and where from the request, and writes with
-- the service key through api/_lib/audit.js. Nothing in the browser writes
-- audit_log directly any more (src/lib/auditLogs.js).
--
-- Measured 05:20 UTC 16 Nov 2026: no code path in the app calls either writer
-- today, so this changes nothing on screen. It closes the door before
-- something starts using it.
--
-- GRANTS
--
-- The table-level grants were Supabase's old defaults: everything, including
-- INSERT, UPDATE, DELETE and TRUNCATE, to anon and authenticated, with RLS the
-- only gate (and RLS does not cover TRUNCATE). Now:
--   anon           nothing
--   authenticated  SELECT, still filtered by 121's audit_log_select policy
--                  (their own entries, or their team's if they are its admin);
--                  audit_activity_summary is security_invoker and reads
--                  through it
--   service_role   SELECT and INSERT for api/_lib/audit.js, and DELETE for
--                  retention (cleanup_old_audit_logs); no UPDATE, so an entry
--                  stays as written (121's intent, now in the grants as well as
--                  the policies)
--
-- Functions that touch audit_log, as found live:
--   log_audit_event(...)       SECURITY DEFINER; already service_role only
--                              (restated below)
--   cleanup_old_audit_logs(int) SECURITY INVOKER, executable by anon and
--                              authenticated. RLS stopped it deleting anything
--                              for them; it is now closed to both, and nothing
--                              in the repository calls it
--   get_user_audit_log(...)    a reader; unchanged

drop policy if exists audit_log_insert on public.audit_log;

revoke all on public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated;
grant select, insert, delete on public.audit_log to service_role;
alter table public.audit_log enable row level security;

revoke execute on function public.log_audit_event(text, text, text, text, text, jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_audit_event(text, text, text, text, text, jsonb, text, text, text, text)
  to service_role;

revoke execute on function public.cleanup_old_audit_logs(integer) from public, anon, authenticated;
grant execute on function public.cleanup_old_audit_logs(integer) to service_role;
