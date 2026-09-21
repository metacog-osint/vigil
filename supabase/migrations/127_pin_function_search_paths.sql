-- 127: pin the search_path on every function that lacked one
--
-- WHY
--
-- A function without `SET search_path` resolves unqualified names using the
-- caller's search_path. For a SECURITY DEFINER function that is a privilege
-- escalation route: a caller who can create objects puts a table or operator
-- earlier in their path, the function resolves to theirs instead of the
-- intended one, and it runs as the owner.
--
-- Supabase's linter flagged 66 such functions. Eight of them are SECURITY
-- DEFINER, which is where the risk actually lives; the other 58 are pinned
-- anyway, because "which of these 66 is dangerous" is a question nobody should
-- have to answer again.
--
-- WHY `public, extensions`
--
-- `extensions` is where Supabase installs pgcrypto and friends. Pinning to
-- `public` alone would break any function calling an extension routine
-- unqualified. Migration 114 already uses `public, extensions` for exactly
-- this reason, so this follows it.
--
-- WHAT THIS CANNOT BREAK
--
-- Setting search_path does not change a function body. A reference that is
-- already schema-qualified keeps resolving as before - `accept_terms` is the
-- only function here that reaches outside public, and it calls `auth.uid()`
-- with the schema named, so it is unaffected.
--
-- Checked before running:
--
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proconfig is null;          -- 66
--
--   -- functions referencing another schema at all
--   ... and pg_get_functiondef(p.oid) ~* '(auth|storage|extensions|vault)\.'
--                                                                -- 1, accept_terms
--
-- Aggregates are skipped: pg_get_functiondef() cannot render one, and an
-- aggregate has no body to resolve names in. `prokind` does that filtering.
--
-- The loop only touches functions whose proconfig is null, so re-running it is
-- a no-op rather than a reset of anything set deliberately since.

do $$
declare
  fn record;
  pinned int := 0;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proconfig is null
      and p.prokind in ('f', 'p')
    order by p.proname
  loop
    execute format('alter function %s set search_path = public, extensions', fn.signature);
    pinned := pinned + 1;
  end loop;

  raise notice 'pinned search_path on % functions', pinned;
end $$;

-- VERIFY
--
--   select count(*) as still_unpinned
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proconfig is null and p.prokind in ('f','p');
--
-- Expected: 0.
--
-- STILL OPEN AFTER THIS, deliberately
--
-- The linter also reports:
--
--   - Seven tables with RLS enabled and no policy: alert_queue, certificates,
--     certificate_hosts, dns_records, tenants, tenant_branding,
--     tenant_invitations. That combination denies everyone, so none of them is
--     an exposure. Adding policies would be inventing an access model for
--     features that are not finished; the right answer is a decision about
--     each feature, not a blanket policy. Left alone on purpose.
--
--   - Eight materialized views selectable by anon or authenticated. A
--     materialized view does not enforce RLS, so this is worth knowing - but
--     all eight hold aggregate threat data (actor activity, technique
--     co-occurrence, geographic targeting), which Vigil publishes anyway on
--     the landing page. No user data is in them.
--
--   - Seven SECURITY DEFINER functions executable by `authenticated`. Six were
--     granted deliberately in 125 after auditing all 23 policies that call
--     them, and `record_verdict` in 126 is meant to be called by a signed-in
--     reviewer. Intentional, and documented in those two files.
--
--   - Leaked-password protection is off. That is an Auth dashboard setting,
--     not SQL, and it is the owner's to enable.
