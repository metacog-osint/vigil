-- Migration: defunct status, evidenced by law-enforcement action
-- Drafted: September 20, 2026
--
-- Every one of Vigil's 4,517 actors said status = 'active', including groups whose
-- infrastructure was seized years ago. The fix is not to infer death from silence:
-- LockBit's site was seized in February 2024 and it published a victim two days ago.
-- Silence means dormant, which the INACTIVE trend already says.
--
-- So 'defunct' requires two things: a recorded event that ended the operation, and no
-- victim claim in the 180 days since. The event is a citable fact with a primary
-- source; the silence confirms it did not resume. A group that is seized and comes
-- back stays active and is recorded as having resumed - which is itself worth
-- knowing, and is exactly what LockBit did.

CREATE TABLE IF NOT EXISTS public.actor_takedowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('law_enforcement_seizure', 'arrests', 'exit_scam', 'dissolution', 'rebrand')),
  operation_name text,
  authorities text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  source_url text NOT NULL,
  source_title text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, event_date, source_url)
);
CREATE INDEX IF NOT EXISTS idx_actor_takedowns_actor ON public.actor_takedowns (actor_id);

ALTER TABLE public.actor_takedowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_takedowns_public_read ON public.actor_takedowns;
CREATE POLICY actor_takedowns_public_read ON public.actor_takedowns
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.actor_takedowns IS
  'Recorded events that ended or disrupted a group, each with a primary source; drives the defunct status';

-- ---------------------------------------------------------------------------
-- Seed: nine records covering seven events, each checked against the announcing
-- authority's own page on 2026-09-20. Vigil's own incident data corroborates every
-- one - the last victim claim lands within days of the announcement in most cases,
-- and for Dispossessor it is the day before.
-- ---------------------------------------------------------------------------
INSERT INTO public.actor_takedowns
  (actor_id, event_date, kind, operation_name, authorities, summary, source_url, source_title, recorded_by)
SELECT a.id, v.event_date::date, v.kind, v.operation, v.authorities, v.summary, v.url, v.title, 'owner review 2026-09-20'
FROM (VALUES
  ('Hive', '2023-01-26', 'law_enforcement_seizure', NULL,
   ARRAY['FBI', 'US DOJ', 'German police', 'Dutch police', 'Europol'],
   'Hive servers seized and decryption keys distributed to victims after the FBI penetrated the network in July 2022',
   'https://www.justice.gov/archives/opa/pr/us-department-justice-disrupts-hive-ransomware-variant',
   'U.S. Department of Justice Disrupts Hive Ransomware Variant'),

  ('hiveleak', '2023-01-26', 'law_enforcement_seizure', NULL,
   ARRAY['FBI', 'US DOJ', 'German police', 'Dutch police', 'Europol'],
   'Hive leak site seized in the same action; the feeds track it as a separate name',
   'https://www.justice.gov/archives/opa/pr/us-department-justice-disrupts-hive-ransomware-variant',
   'U.S. Department of Justice Disrupts Hive Ransomware Variant'),

  ('Ragnar Locker', '2023-10-20', 'law_enforcement_seizure', NULL,
   ARRAY['France', 'Europol', 'Eurojust', 'Czechia', 'Spain', 'Latvia'],
   'Nine servers taken down and six suspects questioned; the suspected developer brought before magistrates in Paris',
   'https://www.europol.europa.eu/media-press/newsroom/news/ragnar-locker-ransomware-gang-taken-down-international-police-swoop',
   'Ragnar Locker ransomware gang taken down by international police swoop'),

  ('BlackCat', '2023-12-19', 'law_enforcement_seizure', NULL,
   ARRAY['FBI', 'US DOJ'],
   'Websites seized and a decryption tool given to over 500 victims; the group stopped posting in March 2024',
   'https://www.justice.gov/archives/opa/pr/justice-department-disrupts-prolific-alphvblackcat-ransomware-variant',
   'Justice Department Disrupts Prolific ALPHV/Blackcat Ransomware Variant'),

  ('LockBit', '2024-02-20', 'law_enforcement_seizure', 'Operation Cronos',
   ARRAY['NCA', 'FBI', 'Europol'],
   'Administration environment, leak site and 28 affiliate servers seized. LockBit resumed publishing afterwards, so it is not defunct',
   'https://www.nationalcrimeagency.gov.uk/the-nca-announces-the-disruption-of-lockbit-with-operation-cronos',
   'The NCA announces the disruption of LockBit with Operation Cronos'),

  ('dispossessor', '2024-08-12', 'law_enforcement_seizure', NULL,
   ARRAY['FBI', 'UK', 'Germany'],
   'Three US, three UK and 18 German servers dismantled along with nine criminal domains',
   'https://www.fbi.gov/contact-us/field-offices/cleveland/news/international-investigation-leads-to-shutdown-of-ransomware-group',
   'International Investigation Leads to Shutdown of Ransomware Group'),

  ('8base', '2025-02-10', 'arrests', NULL,
   ARRAY['US DOJ', 'Europol', 'German police', 'FBI'],
   'Four suspected leaders arrested and over 100 servers disrupted; charged as operating under the 8Base name',
   'https://www.justice.gov/opa/pr/phobos-ransomware-affiliates-arrested-coordinated-international-disruption',
   'Phobos Ransomware Affiliates Arrested in Coordinated International Disruption'),

  ('black suit', '2025-07-24', 'law_enforcement_seizure', 'Operation Checkmate',
   ARRAY['HSI', 'US Secret Service', 'IRS-CI', 'FBI', 'Europol'],
   'Four servers and nine domains taken down, with over $1m in cryptocurrency seized',
   'https://www.justice.gov/opa/pr/justice-department-announces-coordinated-disruption-actions-against-blacksuit-royal',
   'Justice Department Announces Coordinated Disruption Actions Against BlackSuit (Royal) Ransomware Operations'),

  ('Royal', '2025-07-24', 'law_enforcement_seizure', 'Operation Checkmate',
   ARRAY['HSI', 'US Secret Service', 'IRS-CI', 'FBI', 'Europol'],
   'Named in the same action, which the Justice Department titles BlackSuit (Royal); the Royal brand itself stopped posting in July 2023',
   'https://www.justice.gov/opa/pr/justice-department-announces-coordinated-disruption-actions-against-blacksuit-royal',
   'Justice Department Announces Coordinated Disruption Actions Against BlackSuit (Royal) Ransomware Operations')
) AS v(actor, event_date, kind, operation, authorities, summary, url, title)
JOIN threat_actors a ON actor_key(a.name) = actor_key(v.actor)
ON CONFLICT (actor_id, event_date, source_url) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Status derivation
-- ---------------------------------------------------------------------------
ALTER TABLE public.threat_actors DROP CONSTRAINT IF EXISTS threat_actors_status_check;
ALTER TABLE public.threat_actors ADD CONSTRAINT threat_actors_status_check
  CHECK (status IN ('active', 'defunct'));

CREATE OR REPLACE FUNCTION public.apply_actor_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE made_defunct int := 0; resumed int := 0;
BEGIN
  -- Defunct: an event ended it, and nothing has been claimed in the 180 days since.
  WITH ended AS (
    UPDATE threat_actors a SET status = 'defunct'
    WHERE a.status <> 'defunct'
      AND EXISTS (SELECT 1 FROM actor_takedowns t WHERE t.actor_id = a.id)
      AND coalesce((SELECT max(i.discovered_date) FROM incidents i WHERE i.actor_id = a.id), DATE '1970-01-01')
          < current_date - 180
    RETURNING 1)
  SELECT count(*) INTO made_defunct FROM ended;

  -- Back from the dead: seized, then publishing again.
  WITH back AS (
    UPDATE threat_actors a SET status = 'active'
    WHERE a.status = 'defunct'
      AND coalesce((SELECT max(i.discovered_date) FROM incidents i WHERE i.actor_id = a.id), DATE '1970-01-01')
          >= current_date - 180
    RETURNING a.name)
  SELECT count(*) INTO resumed FROM back;

  -- Seized and still publishing is worth saying out loud rather than burying.
  PERFORM record_finding('actor_resumed_after_takedown', t.name, 'warning', 'open',
    jsonb_build_object('last_victim', t.last_victim, 'event_date', t.event_date,
      'note', 'Infrastructure was seized and the group is publishing victims again'))
  FROM (
    SELECT a.name, max(td.event_date) AS event_date,
           (SELECT max(i.discovered_date) FROM incidents i WHERE i.actor_id = a.id) AS last_victim
    FROM threat_actors a JOIN actor_takedowns td ON td.actor_id = a.id
    WHERE a.status = 'active'
    GROUP BY a.id, a.name
    HAVING (SELECT max(i.discovered_date) FROM incidents i WHERE i.actor_id = a.id) > max(td.event_date)
  ) t;

  RETURN jsonb_build_object('made_defunct', made_defunct, 'resumed', resumed,
    'defunct_total', (SELECT count(*) FROM threat_actors WHERE status = 'defunct'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_actor_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_actor_status() TO service_role;

SELECT public.apply_actor_status();
