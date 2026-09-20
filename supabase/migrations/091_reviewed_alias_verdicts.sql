-- Migration: reviewed verdicts for the queued alias and sanctions matches
-- Reviewed: September 20, 2026
--
-- Nine actor-alias pairs and one sanctions match had been queued by the hourly
-- checks. Each verdict below is recorded with the evidence it rests on, so a reader
-- can see why the call was made rather than finding two groups silently merged.
--
-- The strongest evidence is a shared victim list: two names publishing the same
-- victims on the same dates are one operation seen through two feeds.

INSERT INTO public.actor_relationship_decisions (key_a, key_b, relation, rationale, decided_by)
SELECT least(public.actor_key(a), public.actor_key(b)), greatest(public.actor_key(a), public.actor_key(b)),
       r, why, 'owner review 2026-09-20'
FROM (VALUES
  ('ra group', 'raworld', 'same_entity',
   '116 of 146 and 137 victims are shared, over identical date ranges - one operation, two feed spellings'),
  ('APT73', 'bashe', 'same_entity',
   '79 shared victims; APT73 is the name the Bashe leak site gave itself'),
  ('crpx0', 'CRPxO', 'same_entity',
   'Digit-zero versus letter-O spelling of one leak site; 47 incidents against 0'),
  ('secp0', 'secpo', 'same_entity',
   'Digit-zero versus letter-O spelling of one leak site'),
  ('3am', 'threeam', 'same_entity',
   'Two spellings of the 3AM ransomware brand; no shared victims, so this rests on the name and family, not on overlap'),
  ('Booba Project', 'booba team', 'same_entity',
   'Catalogue entry and live leak site for one group; 0 incidents against 22'),
  ('Darkangel', 'dunghill', 'same_entity',
   'Dunghill Leak is the Dark Angel leak site; 0 incidents against 19')
) AS v(a, b, r, why)
ON CONFLICT (key_a, key_b) DO UPDATE
SET relation = EXCLUDED.relation, rationale = EXCLUDED.rationale, decided_by = EXCLUDED.decided_by;

-- Left unreviewed on purpose: babuk2/satanlock (reported as linked operators, not a
-- proven shared brand) and ransomedvc2/rebornvc (successor claim on three incidents).
-- They stay queued rather than being guessed at.

-- Vigil's "Hydra" is a MISP ransomware family entry with no incidents; OFAC's
-- HYDRA MARKET is a darknet marketplace. Different things that share a word.
INSERT INTO public.sanctions_match_decisions (actor_key, entity_uid, verdict, rationale, decided_by)
VALUES (public.actor_key('Hydra'), '36216', 'rejected',
        'Vigil tracks Hydra as a ransomware family with 0 incidents; OFAC designated HYDRA MARKET, a darknet marketplace',
        'owner review 2026-09-20')
ON CONFLICT (actor_key, entity_uid) DO UPDATE
SET verdict = EXCLUDED.verdict, rationale = EXCLUDED.rationale, decided_by = EXCLUDED.decided_by;

-- Close the findings these verdicts answer.
UPDATE public.data_quality_findings
SET status = 'resolved', resolved_at = now()
WHERE status = 'open'
  AND (check_name = 'sanctions_alias_match' AND subject = 'Hydra = HYDRA MARKET');

UPDATE public.data_quality_findings
SET status = 'resolved', resolved_at = now()
WHERE status = 'open' AND check_name = 'actor_alias_review'
  AND subject IN ('ragroup / raworld', 'apt73 / bashe', 'crpx0 / crpxo', 'secp0 / secpo',
                  '3am / threeam', 'boobaproject / boobateam', 'darkangel / dunghill');
