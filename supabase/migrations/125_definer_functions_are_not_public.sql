-- 125: six SECURITY DEFINER functions were callable without signing in
--
-- WHAT WAS WRONG
--
-- Postgres grants EXECUTE on a new function to PUBLIC. Supabase's `anon` role
-- is a member of PUBLIC, so every function created by a migration is callable
-- by an anonymous visitor unless the migration says otherwise. None of ours
-- said otherwise.
--
-- That is harmless for a function that only reads what the public policies
-- already expose. It is not harmless for a SECURITY DEFINER function, which
-- runs as its owner and therefore ignores the row-level policies that are the
-- only thing standing between an anonymous caller and the whole table.
--
-- Six such functions were reachable. The ACLs show how:
--
--   detect_leak_site_notices   =X/postgres            <- PUBLIC only
--   touch_investigation        =X/postgres, anon=X    <- PUBLIC *and* anon
--   can_see_investigation      =X/postgres, anon=X
--   is_team_member             =X/postgres, anon=X
--   is_team_admin              =X/postgres, anon=X
--   get_current_terms_version  =X/postgres, anon=X
--
-- Revoking from `anon` alone would have changed nothing for any of them: the
-- PUBLIC grant grants it back. Both have to go.
--
-- The one that matters most is detect_leak_site_notices(). It is not a
-- read: it scans incidents and queues leak-site-notice candidates for review.
-- An anonymous caller could make Vigil do analytical work and write rows to
-- its own review queue, repeatedly. It never had an explicit anon grant -
-- its exposure was entirely the Postgres default, which is exactly why
-- nobody had noticed it.
--
-- WHY THIS DOES NOT BREAK THE POLICIES THAT CALL THEM
--
-- can_see_investigation(), is_team_member() and is_team_admin() exist to stop
-- RLS recursion: a policy on A that queries B whose policy queries A will not
-- run, so the lookup goes through a SECURITY DEFINER function instead. A role
-- evaluating such a policy does need EXECUTE on the function.
--
-- Every policy that calls them is scoped to `authenticated`:
--
--   select pol.polname, array_to_string(pol.polroles::regrole[], ',')
--   from pg_policy pol
--   where pg_get_expr(pol.polqual, pol.polrelid)
--         ~ '(can_see_investigation|is_team_member|is_team_admin)';
--
-- 23 policies, all `authenticated`, none `anon`. Investigations, teams,
-- vendors and audit logs are not public data and have no anonymous policy to
-- evaluate. So `authenticated` keeps EXECUTE and `anon` loses it.
--
-- touch_investigation() returns trigger and backs two triggers. A trigger
-- function is invoked by the system, not by the caller, and its EXECUTE
-- privilege is not checked when a trigger fires - so nothing needs it, and
-- PostgREST will not expose a trigger-returning function as an RPC either.
--
-- get_current_terms_version() is only read by useTermsAcceptance, which
-- returns early when there is no user and is mounted inside the protected
-- app. A signed-out visitor never calls it, and src/lib/terms.js falls back
-- to a hardcoded version if the call fails.
--
-- SEARCH PATH
--
-- Five of the six already pin search_path. get_current_terms_version does
-- not: it predates that practice (071, January). A SECURITY DEFINER function
-- with a mutable search_path can be made to resolve an unqualified name to an
-- object the caller controls, so it is pinned here. The remaining functions
-- flagged by the security advisor are a separate pass.

begin;

-- The three RLS lookups: authenticated evaluates policies with them, anon
-- has no policy that does.
revoke execute on function public.can_see_investigation(uuid) from public, anon;
revoke execute on function public.is_team_member(uuid) from public, anon;
revoke execute on function public.is_team_admin(uuid) from public, anon;

grant execute on function public.can_see_investigation(uuid) to authenticated, service_role;
grant execute on function public.is_team_member(uuid) to authenticated, service_role;
grant execute on function public.is_team_admin(uuid) to authenticated, service_role;

-- Read by the signed-in app only.
revoke execute on function public.get_current_terms_version() from public, anon;
grant execute on function public.get_current_terms_version() to authenticated, service_role;

alter function public.get_current_terms_version() set search_path = public;

-- A trigger function. Nothing calls it directly, so nobody needs to.
revoke execute on function public.touch_investigation() from public, anon, authenticated;
grant execute on function public.touch_investigation() to service_role;

-- A maintenance job that writes. The worker runs it as service_role; no
-- browser session of any kind should be able to.
revoke execute on function public.detect_leak_site_notices() from public, anon, authenticated;
grant execute on function public.detect_leak_site_notices() to service_role;

commit;

-- VERIFY
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
--          has_function_privilege('service_role', p.oid, 'EXECUTE') as service
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef
--   order by p.proname;
--
-- Expected: anon false for all six; authenticated true for the four the app
-- calls and false for touch_investigation and detect_leak_site_notices;
-- service_role true throughout.
