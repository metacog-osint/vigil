-- Migration: leak-site posts that are not victim claims
-- Reviewed: September 20, 2026
--
-- 095 built leak_site_notices for the 23 Operation Cronos seizure banners that were
-- being counted as LockBit victims, and moved only those. The same fault exists
-- across the rest of the data: groups post announcements, contact pages, manifestos
-- and messages to rivals on the same blog they post victims on, and every feed
-- ingests all of it as an incident. One of them - ShinyHunters' "Note to Cl0p-_-",
-- an extortion message addressed to another gang - was the most recent victim claim
-- on Vigil's public landing page this morning.
--
-- An incident row asserts that a group claimed a victim. These assert something else.
--
-- Twenty-four rows are moved. Each one was read against the source post's own
-- description before being listed here, not matched by a pattern, because two
-- title patterns that look conclusive are not:
--
--   * cmd organization's "Contact Group" reads like a contact page. The source
--     description begins "Contact Group is a proudly Tasmanian company specializing
--     in building services" - it is a real victim with an unfortunate name, and a
--     title sweep would have deleted the only record of it.
--   * Monti posts "<victim> - Press Release" alongside its victim entries. Eleven of
--     the nineteen duplicate a row Vigil already holds, but eight are the only record
--     of that victim - Bickel & Brewer, Cascade Family Dental, Diablo Valley Oncology,
--     Magsaysay Maritime, Rainbow Travel Service, Rudolf GmbH, Rudolf Venture Chemical
--     and University Obrany. Moving them would have erased eight real claims.
--
-- Both are left in incidents and queued for review instead. So are the posts that
-- withhold a victim's name rather than lacking one - radiant's "Dutch ???" carries
-- country NL, and arcusmedia's "New .Gov ?" carries sector government. Those are
-- claims with the name held back, which is closer to a redaction than to a notice.

-- ---------------------------------------------------------------------------
-- 1. Move the verified notices
-- ---------------------------------------------------------------------------
WITH verdicts (akey, title, kind, note) AS (
  VALUES
    -- Messages addressed to other criminals, not to a victim
    (public.actor_key('ShinyHunters'), 'Note to Cl0p-_-', 'message_to_rival',
     'An extortion message addressed to the Cl0p group, demanding they make contact'),
    (public.actor_key('ShinyHunters'), 'Note to mr. databroker1 NEXUS DL Service', 'message_to_rival',
     'An offer addressed to a data broker the group had been trying to reach'),
    (public.actor_key('Donutleaks'), 'Who Is MONTY? ;)', 'message_to_rival',
     'A post about the Monti group, not a victim of Donutleaks'),

    -- Operational announcements to the group''s own readership
    (public.actor_key('ShinyHunters'), 'NOTICE OF WARNING', 'announcement',
     'Tells unnamed contacts that more leaks are coming and not to stall'),
    (public.actor_key('ShinyHunters'), 'Notice', 'announcement',
     'Advises those being contacted by the group to respond'),
    (public.actor_key('Stormous'), 'Notice', 'announcement',
     'Announces that the group will terminate operations and erase hosted data within 60 days'),
    (public.actor_key('Stormous'), 'Important Announcement', 'announcement',
     'Site announcement carrying no victim'),
    (public.actor_key('DeadLock'), 'Notice', 'announcement',
     'Tells readers the clearnet site is targeted for deletion and to save the page locally'),
    (public.actor_key('secp0'), 'Important Announcement', 'announcement',
     'Responds to a security vendor''s published review of the group''s tooling'),
    (public.actor_key('Lv'), 'Important announcement', 'announcement',
     'Site announcement carrying no victim'),
    (public.actor_key('Conti'), 'Announcement', 'announcement',
     'Site announcement carrying no victim'),
    (public.actor_key('arcusmedia'), 'Announcement 9-14', 'announcement',
     'Dated site announcement carrying no victim'),
    (public.actor_key('arcusmedia'), 'Announcement 16-09-2025', 'announcement',
     'Dated site announcement carrying no victim'),
    (public.actor_key('Donutleaks'), 'ATTENTION!', 'announcement',
     'Site announcement carrying no victim'),

    -- Pages describing the group itself
    (public.actor_key('Booba Project'), 'About Us', 'site_page',
     'The group''s own description of itself, addressed to "Dear Valued Partners"'),
    (public.actor_key('hellcat'), 'Contact us', 'site_page',
     'The leak site''s contact page'),
    (public.actor_key('Handala'), 'Contact Handala', 'site_page',
     'The leak site''s contact page, opening with the group''s declaration'),

    -- Political statements and doxxing posts
    (public.actor_key('Handala'),
     'Statement of Establishment Of the Grassroots Resistance Front Of Right-Seekers – Handala', 'manifesto',
     'The group''s founding statement'),
    (public.actor_key('Handala'), 'Who is VahidOnline?', 'manifesto',
     'A post about a named individual, published at /who-is-vahidonline/; not a claim against an organisation'),

    -- Complaints about third parties in the ransomware economy
    (public.actor_key('Ragnar Locker'),
     'Who is the real Bad Guys here? Or what recovery experts prefer to keep silent.', 'complaint',
     'An essay attacking ransomware recovery firms; three copies were ingested across two dates'),
    (public.actor_key('Everest'), 'Warning about the negotiator: All4you', 'complaint',
     'A warning about a ransom negotiation firm, published under the group''s /news/ path')
),
matched AS (
  -- Titles are compared with non-breaking spaces folded to ordinary ones. Ragnar
  -- Locker's essay was ingested three times, and two of the three carry U+00A0
  -- after "here?" where the third has a space; an exact match found one of them
  -- and would have left the other two on the site as victims.
  SELECT i.*, v.kind, v.note
  FROM incidents i
  JOIN threat_actors a ON a.id = i.actor_id
  JOIN verdicts v
    ON v.akey = public.actor_key(a.name)
   AND btrim(replace(i.victim_name, chr(160), ' ')) = btrim(replace(v.title, chr(160), ' '))
),
moved AS (
  -- Nothing recorded about these rows is discarded. incidents.source_url is null
  -- on all 24, but five carry the feed's permalink in victim_website, and 13 carry
  -- a sector the classifier guessed from the title; both are kept, the first as
  -- the notice's source_url and the rest folded into raw_data.
  INSERT INTO public.leak_site_notices
    (actor_id, title, posted_on, kind, note, source, source_url, raw_data)
  SELECT m.actor_id, m.victim_name, m.discovered_date, m.kind, m.note,
         m.source,
         nullif(coalesce(m.source_url, m.victim_website), ''),
         coalesce(m.raw_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'moved_from_incident', jsonb_strip_nulls(jsonb_build_object(
             'incident_id',     m.id,
             'victim_sector',   nullif(m.victim_sector, ''),
             'victim_country',  nullif(m.victim_country, ''),
             'victim_website',  nullif(m.victim_website, ''),
             'status',          m.status,
             'incident_date',   m.incident_date,
             'claim_date',      m.claim_date,
             'moved_by',        'migration 099',
             'moved_at',        now()))))
  FROM matched m
  RETURNING 1
)
DELETE FROM public.incidents WHERE id IN (SELECT id FROM matched);

-- ---------------------------------------------------------------------------
-- 2. Record what was deliberately left alone, with the reason
-- ---------------------------------------------------------------------------
SELECT public.record_finding(
  'leak_site_notice_review',
  'cmd organization / Contact Group',
  'info', 'resolved',
  jsonb_build_object(
    'verdict', 'kept as an incident',
    'evidence', 'Source description: "Contact Group is a proudly Tasmanian company specializing in building services and multi-technology solutions." A real victim whose name reads like a site page.')
);

SELECT public.record_finding(
  'leak_site_notice_review',
  'Monti / "<victim> - Press Release" (19 rows)',
  'warning', 'open',
  jsonb_build_object(
    'question', 'Are Monti''s press-release posts duplicates of its victim entries, or distinct posts?',
    'evidence', '11 of 19 duplicate an existing row for the same victim; 8 are the only record of that victim and must not be removed',
    'sole_record', jsonb_build_array('Bickel & Brewer', 'Cascade Family Dental',
      'Diablo Valley Oncology and Hematology Medical Group', 'Magsaysay Maritime',
      'Rainbow Travel Service', 'Rudolf GmbH & Rudolf Venture Chemicals Inc',
      'Rudolf Venture Chemical Inc', 'University Obrany'))
);

SELECT public.record_finding(
  'leak_site_notice_review',
  'Claims with the victim name withheld',
  'info', 'open',
  jsonb_build_object(
    'question', 'Should a post that withholds the victim''s name be treated as redacted rather than as a notice?',
    'rows', jsonb_build_array('radiant / "Dutch ???" (country NL)', 'arcusmedia / "New .Gov ?" (sector government)'),
    'note', 'Both carry victim attributes, so they assert a claim; only the name is missing')
);

SELECT public.record_finding(
  'leak_site_notice_review',
  'ciphbit / Affiliate',
  'info', 'open',
  jsonb_build_object(
    'question', 'Recruitment post or a victim named Affiliate?',
    'evidence', 'The source carries no description and activity "Not Found", so there is nothing to decide on yet')
);

-- ---------------------------------------------------------------------------
-- 3. Detect future ones - and only ever queue them
-- ---------------------------------------------------------------------------
-- There is no safe automatic rule here. "Contact Group" was a company and
-- "Contact us" was a page, and nothing in the row distinguishes them except the
-- source's prose. So this files candidates for a human and never moves anything,
-- which is the same detect / queue split the rest of the checks use.
CREATE OR REPLACE FUNCTION public.detect_leak_site_notices() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE queued int := 0; r record;
BEGIN
  FOR r IN
    SELECT a.name AS actor, i.victim_name, i.discovered_date,
           i.victim_country, i.victim_sector, i.victim_website
    FROM incidents i
    JOIN threat_actors a ON a.id = i.actor_id
    WHERE i.data_quality = 'ok'
      AND i.victim_name ~* '^(note to |notice$|notice of |important announcement$|announcement|about us$|contact us$|affiliate$|attention!?$|who is |statement of |warning about |read me|rules$|faq$)'
      -- A post carrying victim attributes is a claim with the name missing,
      -- not a notice; those are a different question and not raised here.
      AND coalesce(i.victim_country, '') = ''
      AND coalesce(i.victim_website, '') = ''
  LOOP
    PERFORM record_finding(
      'leak_site_notice_candidate',
      r.actor || ' / ' || r.victim_name,
      'warning', 'open',
      jsonb_build_object(
        'question', 'Is this post a victim claim, or something else published on the same leak site?',
        'posted_on', r.discovered_date,
        'instruction', 'Read the source post before deciding; titles alone have been wrong both ways'));
    queued := queued + 1;
  END LOOP;

  RETURN jsonb_build_object('queued_for_review', queued);
END $$;

REVOKE ALL ON FUNCTION public.detect_leak_site_notices() FROM anon, authenticated;

COMMENT ON FUNCTION public.detect_leak_site_notices() IS
  'Queues leak-site posts that may not be victim claims. Never moves a row: the decision needs the source post.';

-- Seed the queue with whatever is left after the moves above.
SELECT public.detect_leak_site_notices();
