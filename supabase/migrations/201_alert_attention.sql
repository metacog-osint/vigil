-- 201. Two attention levels on alerts: extra and quiet
--
-- STATUS: NOT YET APPLIED.
--
-- WHAT CHANGES
--
-- Every alert rule and every notification now carries an attention level,
-- 'extra' or 'quiet'. Quiet is the default: most of what a rule matches is
-- routine, and leak-site claims alone are about four in five of the rows Vigil
-- holds. A rule set to extra marks everything it matches as extra.
--
-- Five kinds of match are extra whatever the rule says, because each is a
-- change a reader would want to see first:
--
--   kev_added     a CVE added to KEV, for a rule that names vendors
--                 (vendor_cve or kev_added) and matches one of them
--   kev_priority  a KEV entry with known ransomware use reaching EPSS 0.5
--                 (159; it was already alerting, it is now marked extra)
--   resumed       the first claim a group posts after a recorded takedown
--                 (actor_takedowns), on actor_activity and sector_incident
--   sec_disclosure  an SEC 8-K Item 1.05 filing queued as a possible match
--                 for a leak-site claim (sec_disclosure_candidate), when the
--                 claim falls under the rule: a watched sector for
--                 sector_incident, a watched group for actor_activity. The
--                 match is a candidate until a reviewer rules on it, and the
--                 message says so.
--   contested_claim  a contested claim gaining its first value whose
--                 effective origin is Tier 1 (claim_values_resolved), for the
--                 new contested_claim rule type
--
-- BACKFILLS STAY QUIET
--
-- A row stored now about something old is history, not news. Such a match
-- still notifies, as before, but quiet, even on a rule set to extra, and none
-- of the five triggers above fires on one:
--
--   incidents     claim date (claim_date, else discovered_date) more than
--                 seven days before the row was stored. A full reload of an
--                 old leak site lands here.
--   CVEs          a CVE whose id year is more than one year before the row
--                 was stored, matched because the row is new rather than
--                 because CISA just listed it.
--   8-K matches   both the filing and the claim more than 30 days old.
--   P1            159's seeded rows never alert at all; unchanged.
--
-- A NOTIFICATION TYPE PER MATCH
--
-- The engine used to pick one notification type per rule. A vendor_cve rule
-- can now match both a new CVE (vendor_alert) and a KEV addition (kev_added),
-- and a sector rule both a claim and an 8-K match, so each match carries its
-- own type. De-duplication is unchanged: one notification per user, item and
-- type.
--
-- Nothing in the worker changes: it calls evaluate_alert_rules() as before,
-- and the result gains one count, extra_created.

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------
alter table public.user_alert_rules
  add column if not exists attention text not null default 'quiet';
alter table public.user_alert_rules drop constraint if exists user_alert_rules_attention_check;
alter table public.user_alert_rules add constraint user_alert_rules_attention_check
  check (attention in ('extra', 'quiet'));

comment on column public.user_alert_rules.attention is
  'extra: everything the rule matches is marked extra. quiet (default): only '
  'the triggers migration 201 lists are extra. Backfilled rows are always quiet.';

alter table public.notifications
  add column if not exists attention text not null default 'quiet';
alter table public.notifications drop constraint if exists notifications_attention_check;
alter table public.notifications add constraint notifications_attention_check
  check (attention in ('extra', 'quiet'));

comment on column public.notifications.attention is
  'extra or quiet, set by evaluate_alert_rules() (migration 201).';

create index if not exists idx_notifications_user_attention
  on public.notifications (user_id, attention, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. The new rule type and notification types
-- ---------------------------------------------------------------------------
alter table public.user_alert_rules drop constraint if exists user_alert_rules_rule_type_check;
alter table public.user_alert_rules add constraint user_alert_rules_rule_type_check
  check (rule_type in ('vendor_cve', 'actor_activity', 'sector_incident', 'kev_added',
                       'severity_threshold', 'custom', 'kev_epss_p1', 'contested_claim'));

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('kev_added', 'kev_priority', 'actor_escalating',
                               'watchlist_update', 'vendor_alert', 'sector_incident',
                               'system', 'digest_ready', 'sec_disclosure', 'contested_claim'));

-- ---------------------------------------------------------------------------
-- 3. The engine
-- ---------------------------------------------------------------------------
-- As 159 left it. Each match now carries 'ntype' (its notification type),
-- 'extra' (one of the triggers above) and 'backfill'. Changes are marked 201.
create or replace function public.evaluate_alert_rules(
  p_since interval default '01:15:00'::interval,
  p_max_matches integer default 5
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  r record;
  cutoff timestamptz := now() - p_since;
  matches jsonb;
  more jsonb;
  made int;
  made_extra int;
  rules_fired int := 0;
  notes_created int := 0;
  extra_created int := 0;
  email_pending int := 0;
  p1_observed int;
BEGIN
  p1_observed := observe_kev_epss_p1();

  FOR r IN SELECT * FROM user_alert_rules WHERE enabled LOOP
    matches := '[]'::jsonb;
    more := '[]'::jsonb;

    IF r.rule_type IN ('sector_incident', 'actor_activity') THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', i.id::text, 'type', 'incident', 'severity', 'high',
          'ntype', CASE r.rule_type WHEN 'sector_incident' THEN 'sector_incident'
                                    ELSE 'actor_escalating' END,
          'title', CASE
                     WHEN q.resumed THEN a.name || ' posted its first claim since a takedown'
                     WHEN r.rule_type = 'sector_incident'
                       THEN initcap(i.victim_sector) || ' incident: ' || coalesce(i.victim_name, 'Unknown')
                     ELSE a.name || ' claimed a new victim' END,
          'message', CASE
                       WHEN r.rule_type = 'sector_incident'
                         THEN coalesce(a.name, 'An unattributed group') || ' claimed ' ||
                              coalesce(i.victim_name, 'an unnamed victim') || ' in the ' ||
                              i.victim_sector || ' sector'
                       ELSE a.name || ' claimed ' || coalesce(i.victim_name, 'an unnamed victim') END
                     || CASE WHEN q.resumed THEN '. Its last recorded takedown was on ' ||
                                                 q.takedown_date || '.' ELSE '' END,
          'link', CASE r.rule_type WHEN 'sector_incident' THEN '/incidents?sector=' || i.victim_sector
                                   ELSE '/actors' END,
          'extra', q.resumed AND NOT q.backfill,
          'backfill', q.backfill) AS m
        FROM incidents i
        LEFT JOIN threat_actors a ON a.id = i.actor_id
        CROSS JOIN LATERAL (
          SELECT
            -- 201: a claim stored more than a week after it was posted.
            coalesce(i.claim_date, i.discovered_date) < (i.created_at - interval '7 days')::date AS backfill,
            t.event_date AS takedown_date,
            t.event_date IS NOT NULL AS resumed
          FROM (SELECT 1) one
          -- 201: the latest takedown on or before this claim, with no other
          -- claim by the group stored since it and before this one.
          LEFT JOIN LATERAL (
            SELECT t.event_date
            FROM actor_takedowns t
            WHERE i.actor_id IS NOT NULL
              AND t.actor_id = i.actor_id
              AND t.event_date <= coalesce(i.claim_date, i.discovered_date, i.created_at::date)
              AND NOT EXISTS (
                SELECT 1 FROM incidents j
                WHERE j.actor_id = i.actor_id AND j.id <> i.id
                  AND j.created_at < i.created_at
                  AND coalesce(j.claim_date, j.discovered_date, j.created_at::date) >= t.event_date)
            ORDER BY t.event_date DESC
            LIMIT 1
          ) t ON true
        ) q
        WHERE i.created_at >= cutoff
          AND (
            (r.rule_type = 'sector_incident'
              AND i.victim_sector IS NOT NULL
              AND i.victim_sector = ANY (SELECT jsonb_array_elements_text(coalesce(r.conditions->'sectors', '[]'::jsonb))))
            OR
            (r.rule_type = 'actor_activity'
              AND a.id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(coalesce(r.conditions->'actor_names', '[]'::jsonb)) n
                WHERE actor_key(n) = actor_key(a.name)))
          )
        ORDER BY q.resumed DESC, i.created_at DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

      -- 201: an 8-K Item 1.05 filing queued as a possible match for a claim
      -- this rule covers. The finding names the claimed victim and group;
      -- the claim is found as apply_victim_disclosures() found it.
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO more FROM (
        SELECT DISTINCT ON (f.id) jsonb_build_object(
          'id', f.id::text, 'type', 'disclosure', 'severity', 'high',
          'ntype', 'sec_disclosure',
          'title', f.subject,
          'message', 'A leak-site claim by ' || coalesce(f.details->>'claimed_by', 'an unknown group')
                     || ' names ' || coalesce(f.details->>'claimed_victim', 'an organisation')
                     || ', and a company of that name told the SEC of a material cybersecurity incident. '
                     || 'A possible match, not yet reviewed: the filing may be about a different incident.',
          'link', '/review',
          'extra', NOT q.backfill,
          'backfill', q.backfill) AS m
        FROM data_quality_findings f
        JOIN incidents i ON company_key(i.victim_name) = company_key(f.details->>'claimed_victim')
        LEFT JOIN threat_actors a ON a.id = i.actor_id
        CROSS JOIN LATERAL (
          SELECT coalesce(CASE WHEN coalesce(f.details->>'filed', '') ~ '^\d{4}-\d{2}-\d{2}$'
                               THEN (f.details->>'filed')::date END, current_date) < current_date - 30
             AND coalesce(i.claim_date, i.discovered_date, i.created_at::date) < current_date - 30 AS backfill
        ) q
        WHERE f.check_name = 'sec_disclosure_candidate'
          AND f.status = 'open'
          AND f.first_seen >= cutoff
          AND coalesce(f.details->>'filed', '') ~ '^\d{4}-\d{2}-\d{2}$'
          AND (
            (r.rule_type = 'sector_incident'
              AND i.victim_sector = ANY (SELECT jsonb_array_elements_text(coalesce(r.conditions->'sectors', '[]'::jsonb))))
            OR
            (r.rule_type = 'actor_activity'
              AND a.id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(coalesce(r.conditions->'actor_names', '[]'::jsonb)) n
                WHERE actor_key(n) = actor_key(a.name)))
          )
        ORDER BY f.id
        LIMIT greatest(1, p_max_matches)
      ) s;

      matches := matches || more;

    ELSIF r.rule_type IN ('vendor_cve', 'kev_added') THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', v.cve_id, 'type', 'vulnerability',
          'severity', coalesce(lower(v.severity), 'high'),
          'ntype', CASE WHEN r.rule_type = 'kev_added' OR q.kev_new THEN 'kev_added'
                        ELSE 'vendor_alert' END,
          'title', v.cve_id || CASE WHEN v.kev_date IS NOT NULL THEN ' added to KEV' ELSE '' END,
          'message', left(coalesce(v.description, 'No description published'), 240),
          'link', '/vulnerabilities?cve=' || v.cve_id,
          -- 201: a KEV addition for a vendor the rule names.
          'extra', q.kev_new AND q.has_vendors,
          'backfill', q.backfill) AS m
        FROM vulnerabilities v
        CROSS JOIN LATERAL (
          SELECT
            v.kev_date IS NOT NULL AND v.kev_date >= (cutoff - interval '2 days')::date AS kev_new,
            coalesce(jsonb_array_length(r.conditions->'vendors'), 0) > 0 AS has_vendors,
            -- 201: an old CVE stored now, matched because its row is new.
            coalesce(
              NOT (v.kev_date IS NOT NULL AND v.kev_date >= (cutoff - interval '2 days')::date)
                AND substring(v.cve_id from '^CVE-(\d{4})-')::int
                    < extract(year from v.created_at)::int - 1,
              false) AS backfill
        ) q
        WHERE (
            v.created_at >= cutoff
            OR (r.rule_type = 'kev_added' AND q.kev_new)
            -- 201: a vendor_cve rule naming vendors also hears of their KEV
            -- additions, which an old created_at used to hide.
            OR (r.rule_type = 'vendor_cve' AND q.has_vendors AND q.kev_new)
          )
          AND (r.rule_type <> 'kev_added' OR v.kev_date IS NOT NULL)
          AND (coalesce(r.conditions->>'kev_only', 'false') <> 'true' OR v.kev_date IS NOT NULL)
          AND (
            NOT q.has_vendors
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
          AND (
            coalesce(r.conditions->>'min_cvss', '') !~ '^[0-9]+(\.[0-9]+)?$'
            OR v.cvss_score IS NULL
            OR v.cvss_score >= (r.conditions->>'min_cvss')::numeric
          )
          AND (coalesce(r.conditions->>'ransomware_only', 'false') <> 'true' OR v.ransomware_campaign_use)
        ORDER BY coalesce(v.kev_date::timestamptz, v.created_at) DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

    ELSIF r.rule_type = 'kev_epss_p1' THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', v.cve_id, 'type', 'vulnerability', 'severity', 'critical',
          'ntype', 'kev_priority',
          'title', v.cve_id || ': KEV with known ransomware use, EPSS ' ||
                   to_char(p.epss_at_observation, 'FM0.00'),
          'message', 'Known ransomware use, and FIRST puts the chance of exploitation in the next '
                     || '30 days at ' || to_char(p.epss_at_observation * 100, 'FM990') || '% (scored '
                     || p.epss_date_at_observation || '). '
                     || left(coalesce(v.description, ''), 180),
          'link', '/vulnerabilities?cve=' || v.cve_id,
          'extra', true,
          'backfill', false) AS m
        FROM kev_epss_p1 p
        JOIN vulnerabilities v ON v.cve_id = p.cve_id
        WHERE NOT p.seeded
          AND p.first_observed_at >= cutoff
          AND (
            coalesce(jsonb_array_length(r.conditions->'vendors'), 0) = 0
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(r.conditions->'vendors') vendor
              WHERE v.product ILIKE '%' || vendor || '%'
                 OR v.description ILIKE '%' || vendor || '%')
          )
        ORDER BY p.first_observed_at DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

    -- 201: a contested claim gaining its first value with a Tier 1 origin.
    ELSIF r.rule_type = 'contested_claim' THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT DISTINCT ON (c.id) jsonb_build_object(
          'id', cv.id::text, 'type', 'contested_claim', 'severity', 'medium',
          'ntype', 'contested_claim',
          'title', 'Tier 1 origin for: ' || c.question,
          'message', coalesce(res.origin_publisher_name, res.publisher_name, 'A Tier 1 publisher')
                     || ' is the first Tier 1 origin recorded for this claim'
                     || coalesce(' (' || coalesce(res.value_numeric::text, res.value_text)
                                 || coalesce(' ' || c.unit, '') || ')', '') || '.',
          'link', '/contested-claims',
          'extra', true,
          'backfill', false) AS m
        FROM claim_values cv
        JOIN claim_values_resolved res ON res.id = cv.id
        JOIN contested_claims c ON c.id = cv.claim_id
        WHERE cv.created_at >= cutoff
          AND res.effective_tier = 1
          AND NOT EXISTS (
            SELECT 1 FROM claim_values cv2
            JOIN claim_values_resolved res2 ON res2.id = cv2.id
            WHERE cv2.claim_id = cv.claim_id AND cv2.id <> cv.id
              AND res2.effective_tier = 1
              AND cv2.created_at < cutoff)
          AND (
            coalesce(jsonb_array_length(r.conditions->'claim_keys'), 0) = 0
            OR c.claim_key = ANY (SELECT jsonb_array_elements_text(r.conditions->'claim_keys'))
          )
        ORDER BY c.id, cv.created_at
        LIMIT greatest(1, p_max_matches)
      ) s;
    END IF;

    IF jsonb_array_length(matches) = 0 THEN
      CONTINUE;
    END IF;

    made := 0;
    made_extra := 0;
    IF r.notify_in_app THEN
      WITH new_notes AS (
        INSERT INTO notifications (user_id, notification_type, title, message, severity, link,
                                   related_id, related_type, attention)
        SELECT r.user_id, m->>'ntype',
               m->>'title', m->>'message', m->>'severity', m->>'link', m->>'id', m->>'type',
               -- 201: a trigger is extra; a rule set to extra marks the rest
               -- extra too; a backfill is quiet either way.
               CASE
                 WHEN coalesce((m->>'backfill')::boolean, false) THEN 'quiet'
                 WHEN coalesce((m->>'extra')::boolean, false) OR r.attention = 'extra' THEN 'extra'
                 ELSE 'quiet'
               END
        FROM jsonb_array_elements(matches) m
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = r.user_id AND n.related_id = m->>'id'
            AND n.notification_type = m->>'ntype')
        RETURNING attention)
      SELECT count(*), count(*) FILTER (WHERE attention = 'extra')
      INTO made, made_extra FROM new_notes;
    END IF;

    IF made = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO alert_triggers (rule_id, user_id, trigger_data, notification_sent, email_sent)
    VALUES (r.id, r.user_id,
            jsonb_build_object('matches', matches, 'attention', r.attention, 'extra', made_extra),
            r.notify_in_app, false);

    UPDATE user_alert_rules
    SET last_triggered_at = now(), trigger_count = coalesce(trigger_count, 0) + 1
    WHERE id = r.id;

    rules_fired := rules_fired + 1;
    notes_created := notes_created + made;
    extra_created := extra_created + made_extra;
    IF r.notify_email THEN
      email_pending := email_pending + made;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'rules_evaluated', (SELECT count(*) FROM user_alert_rules WHERE enabled),
    'rules_fired', rules_fired,
    'notifications_created', notes_created,
    'extra_created', extra_created,
    'email_pending', email_pending,
    'p1_observed', p1_observed);
END;
$function$;

revoke execute on function public.evaluate_alert_rules(interval, integer) from public, anon, authenticated;
grant execute on function public.evaluate_alert_rules(interval, integer) to service_role;
