-- Migration: make alerts reach someone, and stop queueing for a reader that never existed
-- Drafted: September 20, 2026
--
-- Vigil has two alert paths. One worked and stopped; the other has never worked once.
--
-- The path that worked is user_alert_rules: a rule matches recent data, an in-app
-- notification is written, the trigger is recorded. It produced 2,188 triggers and
-- 9,147 notifications, and its last one is dated 28 May 2026 - the day the scheduled
-- GitHub workflows were disabled. Nothing has evaluated a rule since.
--
-- The path that never worked is alert_queue. A trigger enqueues every incident and
-- every KEV entry, and process-alerts.mjs is supposed to drain it - but its audience
-- function, get_users_for_alert, reads public.users and user_preferences.sectors, and
-- neither exists. It would have thrown on the first call. Had it not, its matching
-- rule was "every user whose sector list is empty", so the first successful run would
-- have emailed all three accounts about all 71,024 queued events.
--
-- So: rule evaluation moves into the database and runs hourly, and the queue is
-- retired rather than left accumulating 1,200 rows a day for nobody.
--
-- Delivery here is in-app only. Sending email is an outward-facing act that needs a
-- key the worker does not hold and a decision that is the owner's, so rules that ask
-- for email record the intent and are counted as pending rather than sent.

-- ---------------------------------------------------------------------------
-- 1. Retire the queue
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS auto_queue_incident_alert ON public.incidents;
DROP TRIGGER IF EXISTS auto_queue_kev_alert ON public.vulnerabilities;

-- queue_alert_event() and the queue itself are kept: when outbound email ships, the
-- triggers can be recreated and process-alerts.mjs pointed at a working audience.

ALTER TABLE public.alert_queue DROP CONSTRAINT IF EXISTS alert_queue_status_check;
ALTER TABLE public.alert_queue ADD CONSTRAINT alert_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'));

-- An "instant" alert that nobody delivered for a month is not news. The backlog is
-- marked expired with the reason rather than delivered late or silently dropped.
UPDATE public.alert_queue
SET status = 'expired',
    processed_at = now(),
    last_error = 'Never delivered: the queue had no working consumer. Superseded by rule evaluation (migration 101)'
WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Rule evaluation, in the database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_alert_rules(
  p_since interval DEFAULT interval '75 minutes',
  p_max_matches int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  cutoff timestamptz := now() - p_since;
  matches jsonb;
  made int;
  rules_fired int := 0;
  notes_created int := 0;
  email_pending int := 0;
BEGIN
  FOR r IN SELECT * FROM user_alert_rules WHERE enabled LOOP
    matches := '[]'::jsonb;

    IF r.rule_type = 'sector_incident' THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', i.id::text, 'type', 'incident', 'severity', 'high',
          'title', initcap(i.victim_sector) || ' incident: ' || coalesce(i.victim_name, 'Unknown'),
          'message', coalesce(a.name, 'An unattributed group') || ' claimed ' ||
                     coalesce(i.victim_name, 'an unnamed victim') || ' in the ' || i.victim_sector || ' sector',
          'link', '/incidents?sector=' || i.victim_sector) AS m
        FROM incidents i
        LEFT JOIN threat_actors a ON a.id = i.actor_id
        WHERE i.created_at >= cutoff
          AND i.victim_sector IS NOT NULL
          AND i.victim_sector = ANY (SELECT jsonb_array_elements_text(coalesce(r.conditions->'sectors', '[]'::jsonb)))
        ORDER BY i.created_at DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

    ELSIF r.rule_type = 'actor_activity' THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', i.id::text, 'type', 'incident', 'severity', 'high',
          'title', a.name || ' claimed a new victim',
          'message', a.name || ' claimed ' || coalesce(i.victim_name, 'an unnamed victim'),
          'link', '/actors') AS m
        FROM incidents i
        JOIN threat_actors a ON a.id = i.actor_id
        WHERE i.created_at >= cutoff
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(coalesce(r.conditions->'actor_names', '[]'::jsonb)) n
            WHERE actor_key(n) = actor_key(a.name))
        ORDER BY i.created_at DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

    ELSIF r.rule_type IN ('vendor_cve', 'kev_added') THEN
      -- vulnerabilities.vendor is empty in all 8,520 rows, so a vendor is matched
      -- against the product and the advisory text instead. Severity is only compared
      -- where the row actually carries one.
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', v.cve_id, 'type', 'vulnerability',
          'severity', coalesce(lower(v.severity), 'high'),
          'title', v.cve_id || CASE WHEN v.kev_date IS NOT NULL THEN ' added to KEV' ELSE '' END,
          'message', left(coalesce(v.description, 'No description published'), 240),
          'link', '/vulnerabilities?cve=' || v.cve_id) AS m
        FROM vulnerabilities v
        WHERE v.created_at >= cutoff
          AND (r.rule_type <> 'kev_added' OR v.kev_date IS NOT NULL)
          AND (coalesce(r.conditions->>'kev_only', 'false') <> 'true' OR v.kev_date IS NOT NULL)
          AND (
            coalesce(jsonb_array_length(r.conditions->'vendors'), 0) = 0
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(r.conditions->'vendors') vendor
              WHERE v.product ILIKE '%' || vendor || '%'
                 OR v.description ILIKE '%' || vendor || '%')
          )
          AND (
            r.conditions->>'min_severity' IS NULL
            OR v.severity IS NULL
            OR lower(v.severity) = lower(r.conditions->>'min_severity')
            OR (lower(r.conditions->>'min_severity') = 'high' AND lower(v.severity) = 'critical')
          )
        ORDER BY v.created_at DESC
        LIMIT greatest(1, p_max_matches)
      ) s;
    END IF;

    IF jsonb_array_length(matches) = 0 THEN
      CONTINUE;
    END IF;

    -- In-app delivery, skipping anything this user has already been told.
    made := 0;
    IF r.notify_in_app THEN
      WITH new_notes AS (
        INSERT INTO notifications (user_id, notification_type, title, message, severity, link, related_id, related_type)
        SELECT r.user_id,
               CASE r.rule_type
                 WHEN 'sector_incident' THEN 'sector_incident'
                 WHEN 'actor_activity' THEN 'actor_escalating'
                 WHEN 'kev_added' THEN 'kev_added'
                 ELSE 'vendor_alert'
               END,
               m->>'title', m->>'message', m->>'severity', m->>'link', m->>'id', m->>'type'
        FROM jsonb_array_elements(matches) m
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = r.user_id AND n.related_id = m->>'id'
            AND n.notification_type = CASE r.rule_type
                 WHEN 'sector_incident' THEN 'sector_incident'
                 WHEN 'actor_activity' THEN 'actor_escalating'
                 WHEN 'kev_added' THEN 'kev_added'
                 ELSE 'vendor_alert' END)
        RETURNING 1)
      SELECT count(*) INTO made FROM new_notes;
    END IF;

    IF made = 0 THEN
      CONTINUE;  -- everything matched had already been delivered
    END IF;

    INSERT INTO alert_triggers (rule_id, user_id, trigger_data, notification_sent, email_sent)
    VALUES (r.id, r.user_id, jsonb_build_object('matches', matches), r.notify_in_app, false);

    UPDATE user_alert_rules
    SET last_triggered_at = now(), trigger_count = coalesce(trigger_count, 0) + 1
    WHERE id = r.id;

    rules_fired := rules_fired + 1;
    notes_created := notes_created + made;
    IF r.notify_email THEN
      email_pending := email_pending + made;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'rules_evaluated', (SELECT count(*) FROM user_alert_rules WHERE enabled),
    'rules_fired', rules_fired,
    'notifications_created', notes_created,
    -- Rules asking for email: recorded, not sent. Outbound mail is off.
    'email_pending', email_pending);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_alert_rules(interval, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_alert_rules(interval, int) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Repair get_users_for_alert so the dormant email path is not a landmine
-- ---------------------------------------------------------------------------
-- The old body read public.users (no such table) and user_preferences.sectors (no
-- such column), and returned every user for every event. Preferences are an opt-out
-- model - excluded_event_types and excluded_sectors - so that is what is honoured,
-- and the address comes from auth.users.
-- The column types change with the rewrite, so the old definition has to go first.
DROP FUNCTION IF EXISTS public.get_users_for_alert(character varying, jsonb);

CREATE FUNCTION public.get_users_for_alert(
  p_event_type character varying, p_event_data jsonb
) RETURNS TABLE (
  user_id text, email text, push_enabled boolean, email_enabled boolean, in_quiet_hours boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT up.user_id,
         u.email::text,
         coalesce(up.push_enabled, false) AND CASE p_event_type
           WHEN 'ransomware' THEN coalesce(up.push_ransomware, false)
           WHEN 'kev' THEN coalesce(up.push_kev, false)
           WHEN 'cisa_alert' THEN coalesce(up.push_cisa_alerts, false)
           ELSE false END,
         coalesce(up.email_instant_alerts, false),
         coalesce(up.quiet_hours_enabled, false)
           AND localtime BETWEEN coalesce(up.quiet_hours_start, time '22:00')
                             AND coalesce(up.quiet_hours_end, time '07:00')
  FROM user_preferences up
  LEFT JOIN auth.users u ON u.id::text = up.user_id
  WHERE NOT (p_event_type = ANY (coalesce(up.excluded_event_types, '{}')))
    AND (p_event_data->>'sector' IS NULL
         OR NOT (p_event_data->>'sector' = ANY (coalesce(up.excluded_sectors, '{}'))));
$$;

REVOKE EXECUTE ON FUNCTION public.get_users_for_alert(character varying, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_for_alert(character varying, jsonb) TO service_role;
