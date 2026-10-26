-- 154. Four SECURITY DEFINER functions that writers call were open to callers
--      they were never meant for
--
-- STATUS: applied 2026-10-26 at 18:54 UTC, before this file was pushed. The
-- check query below returned no rows, and Security Advisor no longer lists any
-- of the four.
--
-- WHAT WAS OPEN
--
-- Supabase's Security Advisor, read on 26 October 2026, flagged these, and
-- pg_proc.proacl confirms each one:
--
--   apply_ransom_payments(text, text, date, jsonb)   PUBLIC, anon, authenticated
--   apply_regulatory_advisories(jsonb, text)          authenticated
--   review_regulatory_advisories()                    authenticated
--   review_contested_claims()                         authenticated
--
-- apply_ransom_payments is the serious one. It is SECURITY DEFINER, so it
-- writes ransomware_payments as its owner, past RLS, and it was executable
-- by anon - without signing in. The ransom-payment totals, the "follow the
-- money" figures, were writable by anyone. Checked the same day: every row
-- was last written by the 4 October import, so there is no sign that it
-- happened.
--
-- The other three need a signed-in user. Three accounts exist, the newest from
-- January, and regulatory_advisories holds only source 'fincen'.
--
-- WHY IT HAPPENED
--
-- Supabase sets default privileges in `public` that grant EXECUTE on every new
-- function to anon, authenticated and service_role by name, on top of the
-- PUBLIC grant Postgres gives every function. Revoking from PUBLIC does not
-- touch the named grants.
--
--   * 152 created apply_ransom_payments and revoked nothing.
--   * 145 and 147 revoked from public and anon, which reads as "service role
--     only" but leaves authenticated in place.
--
-- Every other apply_* function follows 130's pattern - revoke from public,
-- anon and authenticated in one statement, then grant to service_role - and
-- none of them is flagged.
--
-- WHAT STILL CALLS THESE
--
-- The Edge Functions (ransomwhere-archive, fincen-advisories) call with the
-- service-role key, and service_role keeps EXECUTE. A SECURITY DEFINER caller
-- such as run_data_quality_checks runs as postgres, so it is unaffected. Nothing
-- in src/ calls any of the four.
--
-- WHY NOW, NOT ON 30 OCTOBER
--
-- Supabase's 30 October change (changelog 45329) stops granting new *tables*
-- and *sequences* in public to anon, authenticated and service_role. It says
-- nothing about functions, so it would not have closed this; new functions keep
-- the named EXECUTE grants. scripts/check-migration-grants.mjs now fails any
-- migration numbered 154 or later that creates a SECURITY DEFINER function
-- without revoking it from all three, or a public table or view without a
-- grant.
--
-- To verify after applying (expect no rows):
--
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.proname in
--     ('apply_ransom_payments', 'apply_regulatory_advisories',
--      'review_regulatory_advisories', 'review_contested_claims')
--     and (has_function_privilege('anon', p.oid, 'execute')
--       or has_function_privilege('authenticated', p.oid, 'execute'));

revoke execute on function public.apply_ransom_payments(text, text, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_ransom_payments(text, text, date, jsonb)
  to service_role;

revoke execute on function public.apply_regulatory_advisories(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.apply_regulatory_advisories(jsonb, text)
  to service_role;

revoke execute on function public.review_regulatory_advisories()
  from public, anon, authenticated;
grant execute on function public.review_regulatory_advisories()
  to service_role;

revoke execute on function public.review_contested_claims()
  from public, anon, authenticated;
grant execute on function public.review_contested_claims()
  to service_role;
