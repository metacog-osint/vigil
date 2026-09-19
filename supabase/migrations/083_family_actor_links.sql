-- Migration: Link indicators to threat actors through malware families
-- Drafted: September 19, 2026
--
-- "Which group uses this IP/wallet?" had no answer: 0 of 568k IOCs were linked to an
-- actor. Most IOCs are commodity malware (stealers, RATs, loaders), but 54 malware
-- families in the data correspond to groups with leak-site victims (Akira, LockBit,
-- Play, BianLian, Conti wallets, ...), covering ~1,300 indicators.
--
-- Links go through a reviewed map, never a bare name match, because several family
-- names are ambiguous (Snake ransomware vs Turla's Snake implant, Chaos, Loki, Hades,
-- Medusa). Relations carry different weight:
--   ransomware_brand  the family is that group's own ransomware -> attribution-grade
--   used_by           shared tooling (e.g. Cobalt Strike) -> NOT attribution
--   not_related       rejected
--   unreviewed        proposed by detection, awaiting a human decision
--
-- The hourly check proposes candidates; only reviewed rows produce links.

CREATE TABLE IF NOT EXISTS public.malware_family_actor_map (
  family_key text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  family_label text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('ransomware_brand', 'used_by', 'not_related', 'unreviewed')),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  rationale text,
  decided_by text,
  decided_at timestamptz DEFAULT now(),
  PRIMARY KEY (family_key, actor_id)
);

ALTER TABLE public.malware_family_actor_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS malware_family_actor_map_public_read ON public.malware_family_actor_map;
CREATE POLICY malware_family_actor_map_public_read ON public.malware_family_actor_map
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_iocs_malware_family_key
  ON public.iocs (public.actor_key(malware_family)) WHERE malware_family IS NOT NULL;

-- Seed: family name matches a group that has victims, the group has a real presence
-- (>= 20 incidents) or the family comes from Ransomwhere (a ransom-payment dataset,
-- so every family in it is a ransomware brand), and the name is not ambiguous.
INSERT INTO public.malware_family_actor_map (family_key, actor_id, family_label, relation, confidence, rationale, decided_by)
SELECT DISTINCT ON (fk, a.id)
  fk, a.id, f.malware_family, 'ransomware_brand', 'high',
  'Family name matches a ransomware group with leak-site victims', 'auto-seed 2026-09-19'
FROM (
  SELECT DISTINCT malware_family, public.actor_key(malware_family) AS fk,
         bool_or(source = 'ransomwhere') AS from_ransom_payments
  FROM public.iocs WHERE malware_family IS NOT NULL AND malware_family <> '' GROUP BY 1, 2
) f
JOIN public.threat_actors a ON public.actor_key(a.name) = f.fk
WHERE EXISTS (SELECT 1 FROM public.incidents i WHERE i.actor_id = a.id)
  AND (f.from_ransom_payments OR (SELECT count(*) FROM public.incidents i WHERE i.actor_id = a.id) >= 20)
  -- Ambiguous or generic names go to review instead: Snake (ransomware vs Turla's
  -- implant), Chaos, Loki, Hades, Medusa (three different things), Anubis (Android
  -- banker vs ransomware), and generic labels like 'Payload'/'Global'
  AND f.fk NOT IN ('snake', 'chaos', 'loki', 'hades', 'medusa', 'mirai', 'xworm',
                   'valleyrat', 'aisuru', 'payload', 'global', 'anubis')
ON CONFLICT DO NOTHING;

-- Everything else that name-matches a group with victims: queued for review
INSERT INTO public.malware_family_actor_map (family_key, actor_id, family_label, relation, confidence, rationale, decided_by)
SELECT DISTINCT ON (fk, a.id)
  fk, a.id, f.malware_family, 'unreviewed', 'low',
  'Name match; ambiguous or low-volume group, needs a decision', 'auto-detected'
FROM (
  SELECT DISTINCT malware_family, public.actor_key(malware_family) AS fk
  FROM public.iocs WHERE malware_family IS NOT NULL AND malware_family <> ''
) f
JOIN public.threat_actors a ON public.actor_key(a.name) = f.fk
WHERE EXISTS (SELECT 1 FROM public.incidents i WHERE i.actor_id = a.id)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- The link view the app reads: only reviewed relations, with their basis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ioc_actor_links
WITH (security_invoker = on) AS
SELECT i.id AS ioc_id, i.type, i.value, i.malware_family, i.source AS ioc_source,
       m.actor_id, a.name AS actor_name, m.relation, m.confidence, m.rationale
FROM public.iocs i
JOIN public.malware_family_actor_map m ON m.family_key = public.actor_key(i.malware_family)
JOIN public.threat_actors a ON a.id = m.actor_id
WHERE m.relation IN ('ransomware_brand', 'used_by');

GRANT SELECT ON public.ioc_actor_links TO anon, authenticated;
