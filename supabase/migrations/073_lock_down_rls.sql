-- Migration: Lock down Row-Level Security
-- Created: September 19, 2026
-- Purpose: Resolve Supabase Security Advisor ERROR findings on the live database
--          (checked 2026-09-19):
--   * rls_disabled_in_public: 30 tables with RLS off, where the anon role could
--     INSERT/UPDATE/DELETE, including incidents, iocs, threat_actors, vulnerabilities
--   * "Allow all ... USING (true)" policies that let anyone write (techniques,
--     actor_techniques, actor_vulnerabilities, actor_trend_history, alerts, breaches,
--     blocklists, threat_feeds, entity_tags, tenant tables)
--   * security_definer_view: 14 views that bypassed RLS
--   * SECURITY DEFINER functions callable by anonymous visitors
--
-- Access levels:
--   PUBLIC_READ   anyone may SELECT; nobody may write through the API
--   OWN_ALL       signed-in users manage only their own rows (by user_id)
--   OWN_READ      signed-in users read only their own rows
--   SERVICE_ONLY  no API access; only the service_role key
--
-- The service_role key bypasses RLS, so ingestion (Cloudflare worker, GitHub
-- Actions, scripts) and the /api functions are unaffected.
-- Every existing policy on a listed table is dropped first. Missing tables are
-- skipped with a NOTICE.

CREATE OR REPLACE FUNCTION pg_temp.reset_table(tbl text) RETURNS boolean AS $$
DECLARE pol record;
BEGIN
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE 'Skipping missing table: %', tbl;
    RETURN false;
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
  END LOOP;
  RETURN true;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  own_check text := 'user_id::text = (select auth.uid())::text';
BEGIN
  -- PUBLIC_READ: threat intelligence and reference data
  FOREACH t IN ARRAY ARRAY[
    'incidents', 'iocs', 'threat_actors', 'vulnerabilities', 'malware',
    'actor_aliases', 'actor_techniques', 'actor_vulnerabilities', 'actor_trend_history',
    'advisories', 'cve_advisories', 'exploits', 'sandbox_reports', 'sector_keywords',
    'techniques', 'threat_hunts', 'sync_log', 'ai_summaries', 'alerts', 'breaches',
    'blocklists', 'threat_feeds'
  ] LOOP
    IF pg_temp.reset_table(t) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        t || '_public_read', t);
    END IF;
  END LOOP;

  -- OWN_ALL: rows users create and manage themselves
  FOREACH t IN ARRAY ARRAY[
    'user_alert_rules', 'user_hunt_progress', 'user_integrations',
    'outbound_webhooks', 'monitored_domains', 'tenant_members'
  ] LOOP
    IF pg_temp.reset_table(t) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        t || '_own_all', t, own_check, own_check);
    END IF;
  END LOOP;

  -- OWN_READ: system-written rows users may view
  FOREACH t IN ARRAY ARRAY[
    'alert_deliveries', 'alert_triggers', 'api_request_log', 'certificate_alerts',
    'integration_logs', 'search_alert_history', 'subscription_events'
  ] LOOP
    IF pg_temp.reset_table(t) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
        t || '_own_read', t, own_check);
    END IF;
  END LOOP;

  -- The client inserts these two for the signed-in user (src/lib/supabase/alertRules.js,
  -- src/lib/integrations.js)
  FOREACH t IN ARRAY ARRAY['alert_triggers', 'integration_logs'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        t || '_own_insert', t, own_check);
    END IF;
  END LOOP;

  -- entity_tags has no user_id; ownership comes from the parent tag
  IF pg_temp.reset_table('entity_tags') THEN
    CREATE POLICY entity_tags_via_tag ON public.entity_tags FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.tags tg
                     WHERE tg.id = entity_tags.tag_id AND tg.user_id = (select auth.uid())::text))
      WITH CHECK (EXISTS (SELECT 1 FROM public.tags tg
                          WHERE tg.id = entity_tags.tag_id AND tg.user_id = (select auth.uid())::text));
  END IF;

  -- entity_changelog: keep signed-in read, remove the unrestricted INSERT policy
  IF pg_temp.reset_table('entity_changelog') THEN
    CREATE POLICY entity_changelog_authenticated_read ON public.entity_changelog
      FOR SELECT TO authenticated USING (true);
  END IF;

  -- SERVICE_ONLY: queues and internal state, plus the unused (empty) white-label
  -- tenant tables whose "Allow all" policies let anyone create or edit tenants
  FOREACH t IN ARRAY ARRAY[
    'alert_queue', 'certificates', 'certificate_hosts', 'dns_records',
    'tenants', 'tenant_branding', 'tenant_invitations'
  ] LOOP
    PERFORM pg_temp.reset_table(t);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Views: run with the querying user's permissions so RLS applies
-- -----------------------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'watchlists_with_counts', 'tags_with_counts', 'malware_family_stats',
    'recent_malware_samples', 'ioc_source_stats', 'alert_queue_stats',
    'recent_entity_changes', 'atlas_techniques', 'attack_techniques',
    'nation_state_events', 'criminal_events', 'api_key_rotation_status',
    'audit_activity_summary', 'ioc_confidence'
  ] LOOP
    IF to_regclass(format('public.%I', v)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECURITY DEFINER functions: remove public access to ones the app never calls.
-- invalidate_user_sessions let anyone sign out any user; log_audit_event let
-- anyone forge audit entries.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.invalidate_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rotate_api_key(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, text, text, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rotated_keys() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_api_key_valid(text) FROM PUBLIC, anon, authenticated;

-- Terms functions are used by src/lib/terms.js for signed-in users only
REVOKE EXECUTE ON FUNCTION public.accept_terms(text, inet, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_accepted_current_terms(uuid) FROM PUBLIC, anon;

-- -----------------------------------------------------------------------------
-- Report any public table that still has RLS disabled
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    RAISE WARNING 'RLS still disabled on public.%', r.relname;
  END LOOP;
END;
$$;
