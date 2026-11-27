-- 204: new tables and views in public start without DELETE or TRUNCATE for the browser roles
--
-- Read live on 26 Nov 2026: the default privileges of role postgres in schema
-- public gave anon and authenticated every privilege (arwdDxtm) on each new
-- table and view. Every table and view in public is owned by postgres, so this
-- is the default that applies to Vigil's objects. supabase_admin holds the same
-- default but creates none of them, and is left alone here.
--
-- New tables and views in public start without DELETE or TRUNCATE for the
-- browser roles. A migration that means a browser role to delete grants it by
-- name. Existing objects keep the privileges they have.
--
-- Migrations still revoke first and grant what is meant on every object they
-- create (scripts/check-migration-grants.mjs); this narrows what a missed
-- revoke leaves open.

alter default privileges for role postgres in schema public
  revoke delete, truncate on tables from anon, authenticated;

-- VERIFY
--
--   select defaclrole::regrole, defaclobjtype, defaclacl
--   from pg_default_acl
--   where defaclnamespace = 'public'::regnamespace and defaclobjtype = 'r';
--
--   -- anon and authenticated should read arwxtm (no d, no D); service_role keeps arwdDxtm.
