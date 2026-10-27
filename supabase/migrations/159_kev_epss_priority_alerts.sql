-- 159. Alert when a KEV entry with known ransomware use reaches EPSS 0.5, and
--      stop the KEV-addition rule missing CVEs Vigil already held
--
-- STATUS: NOT YET APPLIED.
--
-- ORDER MATTERS: apply 158, deploy the epss-scores Edge Function, let it run
-- once (or invoke it), and only then apply this. About 60% of KEV entries had
-- no EPSS score before 158. Seeded before the refresh, every one of them that
-- the refresh puts at 0.5 or above would look newly P1 and alert at once - a
-- backfill dressed as news. Seeded after, they are already known.
--
-- THE RULE
--
-- From the ideas file (two-tier alerting), after the Exploited Vulnerability
-- Prioritization Dashboard: a CVE is P1 when CISA lists it in KEV with known
-- ransomware campaign use, and FIRST's EPSS puts the chance of exploitation
-- in the next 30 days at 0.5 or more. Both conditions, not either.
--
--   ransomware use  vulnerabilities.ransomware_campaign_use, which the CISA KEV
--                   feed writes from knownRansomwareCampaignUse. The older
--                   ransomware_use column disagrees on 61 KEV rows and is never
--                   true where this one is false, so it is not read.
--   EPSS            epss_score, with epss_date within three days. A stale score
--                   cannot make a CVE P1 (158).
--
-- WHY IT TRACKS WHEN A CVE BECOMES P1
--
-- The alert engine matches rows created in the last hour and a quarter. That
-- cannot work here: EPSS rises in the days after a CVE reaches KEV - the
-- dashboard's first version ranked all 15 newest KEV entries lowest for that
-- reason - so the moment that matters is when an existing CVE crosses the
-- line, not when its row appeared. Vigil keeps no EPSS history, so
-- kev_epss_p1 records when each CVE was first observed meeting the rule, and
-- the alert fires on that.
--
-- The 121 CVEs that already meet it are seeded as observed, and seeded rows
-- never alert: a backfill stays quiet, as the ideas file asks. Nothing is
-- removed when a CVE drops below 0.5; the observation is history.
--
-- THE KEV-ADDITION RULE, WHICH WAS MISSING A QUARTER OF ITS CASES
--
-- kev_added matched on vulnerabilities.created_at. A CVE the NVD feed stored
-- before CISA listed it already had an old created_at, so its KEV addition
-- never fired: 8 of the 32 KEV additions in the 30 days to 26 October. It now
-- also matches on kev_date, the day CISA added it, two days back to cover a
-- feed that runs every six hours across midnight. The engine's existing
-- per-user, per-CVE, per-type check stops a repeat.
--
-- TWO CONDITIONS THE ENGINE NEVER READ
--
-- The settings page has offered "Minimum CVSS" and "Only CVEs used in
-- ransomware campaigns" on kev_added since it was built, and the engine read
-- neither, so a rule with them alerted on everything they were meant to
-- exclude. Both are read now. The page also offered severity_threshold, which
-- the engine has never evaluated; no such rule exists, and the page stops
-- offering it.
--
-- A NEW NOTIFICATION TYPE
--
-- kev_priority, so a CVE already notified as kev_added can still be notified
-- when it becomes P1 - the engine de-duplicates by type, and sharing one
-- would swallow the second, more important alert.

-- ---------------------------------------------------------------------------
-- 1. When each CVE first met the rule
-- ---------------------------------------------------------------------------
create table if not exists public.kev_epss_p1 (
  cve_id text primary key references public.vulnerabilities (cve_id) on delete cascade,
  first_observed_at timestamptz not null default now(),
  epss_at_observation numeric not null,
  epss_date_at_observation date not null,
  -- True for CVEs that already met the rule when this migration ran. They
  -- never alert: a backfill is not news.
  seeded boolean not null default false
);

comment on table public.kev_epss_p1 is
  'When each CVE was first observed as KEV + known ransomware use + EPSS >= 0.5 '
  'on a current score. Never pruned. Seeded rows predate the rule and never '
  'alert. See migration 159.';

alter table public.kev_epss_p1 enable row level security;

drop policy if exists kev_epss_p1_select on public.kev_epss_p1;
create policy kev_epss_p1_select on public.kev_epss_p1
  for select to authenticated using (true);

revoke all on public.kev_epss_p1 from anon, authenticated;
grant select on public.kev_epss_p1 to authenticated, service_role;

create or replace function public.observe_kev_epss_p1()
returns integer
language sql
security definer
set search_path = public
as $fn$
  with observed as (
    insert into kev_epss_p1 (cve_id, epss_at_observation, epss_date_at_observation)
    select v.cve_id, v.epss_score, v.epss_date
    from vulnerabilities v
    where v.kev_date is not null
      and v.ransomware_campaign_use
      and v.epss_score >= 0.5
      and v.epss_date >= current_date - 3
    on conflict (cve_id) do nothing
    returning 1
  )
  select count(*)::int from observed;
$fn$;

comment on function public.observe_kev_epss_p1() is
  'Records CVEs newly meeting KEV + ransomware use + EPSS >= 0.5 on a current '
  'score. Called at the start of every evaluate_alert_rules() run.';

revoke execute on function public.observe_kev_epss_p1() from public, anon, authenticated;
grant execute on function public.observe_kev_epss_p1() to service_role;

-- Seed what already meets the rule, quietly. A score older than three days
-- is seeded too: it met the rule when last measured, and alerting on it the
-- day 158 refreshes it would be a backfill, not news.
insert into kev_epss_p1 (cve_id, epss_at_observation, epss_date_at_observation, seeded)
select v.cve_id, v.epss_score, coalesce(v.epss_date, current_date), true
from vulnerabilities v
where v.kev_date is not null
  and v.ransomware_campaign_use
  and v.epss_score >= 0.5
on conflict (cve_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The rule type and the notification type
-- ---------------------------------------------------------------------------
alter table public.user_alert_rules drop constraint if exists user_alert_rules_rule_type_check;
alter table public.user_alert_rules add constraint user_alert_rules_rule_type_check
  check (rule_type in ('vendor_cve', 'actor_activity', 'sector_incident', 'kev_added',
                       'severity_threshold', 'custom', 'kev_epss_p1'));

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('kev_added', 'kev_priority', 'actor_escalating',
                               'watchlist_update', 'vendor_alert', 'sector_incident',
                               'system', 'digest_ready'));

-- ---------------------------------------------------------------------------
-- 3. The engine
-- ---------------------------------------------------------------------------
-- As 104/105 left it, with three changes, each marked: observations first,
-- kev_added also matching on kev_date, and the kev_epss_p1 branch.
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
  made int;
  rules_fired int := 0;
  notes_created int := 0;
  email_pending int := 0;
  p1_observed int;
BEGIN
  -- 159: record CVEs newly meeting the P1 rule before any rule reads them.
  p1_observed := observe_kev_epss_p1();

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
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', v.cve_id, 'type', 'vulnerability',
          'severity', coalesce(lower(v.severity), 'high'),
          'title', v.cve_id || CASE WHEN v.kev_date IS NOT NULL THEN ' added to KEV' ELSE '' END,
          'message', left(coalesce(v.description, 'No description published'), 240),
          'link', '/vulnerabilities?cve=' || v.cve_id) AS m
        FROM vulnerabilities v
        WHERE (
            v.created_at >= cutoff
            -- 159: a CVE stored before CISA listed it has an old created_at.
            OR (r.rule_type = 'kev_added' AND v.kev_date >= (cutoff - interval '2 days')::date)
          )
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
          -- 159: the settings page has offered these two on kev_added since it
          -- was built, and nothing read them. An unknown CVSS passes, as an
          -- unknown severity does above; a non-numeric value is ignored rather
          -- than allowed to fail every rule's evaluation.
          AND (
            coalesce(r.conditions->>'min_cvss', '') !~ '^[0-9]+(\.[0-9]+)?$'
            OR v.cvss_score IS NULL
            OR v.cvss_score >= (r.conditions->>'min_cvss')::numeric
          )
          AND (coalesce(r.conditions->>'ransomware_only', 'false') <> 'true' OR v.ransomware_campaign_use)
        ORDER BY coalesce(v.kev_date::timestamptz, v.created_at) DESC
        LIMIT greatest(1, p_max_matches)
      ) s;

    -- 159: KEV + known ransomware use + EPSS >= 0.5, on the first observation.
    ELSIF r.rule_type = 'kev_epss_p1' THEN
      SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO matches FROM (
        SELECT jsonb_build_object(
          'id', v.cve_id, 'type', 'vulnerability', 'severity', 'critical',
          'title', v.cve_id || ': KEV with known ransomware use, EPSS ' ||
                   to_char(p.epss_at_observation, 'FM0.00'),
          'message', 'Known ransomware use, and FIRST puts the chance of exploitation in the next '
                     || '30 days at ' || to_char(p.epss_at_observation * 100, 'FM990') || '% (scored '
                     || p.epss_date_at_observation || '). '
                     || left(coalesce(v.description, ''), 180),
          'link', '/vulnerabilities?cve=' || v.cve_id) AS m
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
    END IF;

    IF jsonb_array_length(matches) = 0 THEN
      CONTINUE;
    END IF;

    made := 0;
    IF r.notify_in_app THEN
      WITH new_notes AS (
        INSERT INTO notifications (user_id, notification_type, title, message, severity, link, related_id, related_type)
        SELECT r.user_id,
               CASE r.rule_type
                 WHEN 'sector_incident' THEN 'sector_incident'
                 WHEN 'actor_activity' THEN 'actor_escalating'
                 WHEN 'kev_added' THEN 'kev_added'
                 WHEN 'kev_epss_p1' THEN 'kev_priority'
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
                 WHEN 'kev_epss_p1' THEN 'kev_priority'
                 ELSE 'vendor_alert' END)
        RETURNING 1)
      SELECT count(*) INTO made FROM new_notes;
    END IF;

    IF made = 0 THEN
      CONTINUE;
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
    'email_pending', email_pending,
    'p1_observed', p1_observed);
END;
$function$;

-- Restated, so the engine's callers do not rest on history (154): the worker
-- calls it as service_role.
revoke execute on function public.evaluate_alert_rules(interval, integer) from public, anon, authenticated;
grant execute on function public.evaluate_alert_rules(interval, integer) to service_role;
