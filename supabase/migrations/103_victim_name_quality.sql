-- Migration: recognise the other way groups redact a victim name
-- Reviewed: September 20, 2026
--
-- 077 added incidents.data_quality to keep two kinds of row off the site: a
-- placeholder that is not a victim at all, and a name the group published with
-- part of it hidden. It recognises redaction by a run of asterisks, which is how
-- most groups do it.
--
-- Play does it with question marks, and 39 rows were reading as ordinary victims:
--
--   A???? F??????????? Ltd        C?l???t Group        D???? P??????s
--   ????????? ???? ?????          ???????              A????? ????k
--
-- These are not an encoding failure, which was the obvious reading. A charset
-- conversion replaces bytes it cannot map, and would not leave ASCII letters
-- standing inside the same word - "C?l???t Group" keeps a C, an l, a t and the
-- whole of "Group". The feed's raw_data holds the identical string, so the source
-- published it masked. It is the same act as "abc*******", in a different
-- character.
--
-- The rule is two or more consecutive question marks. A single one is punctuation:
-- "HOW TO BUY DATA?", "New .Gov ?" and "Will the Katecho,LLC be able to handle the
-- hack and prevent a data breach in time?" are all real posts and stay as they are.
-- The two rules do not overlap - no row matches both.
--
-- Also caught: three rows whose victim_name is a server-side template injection
-- payload left behind by somebody's scanner - "RCSSTI {{7*7}} ${7*7} <%=7*7%>".
-- Those are not victims and are placeholders.
--
-- Deliberately NOT changed, having looked:
--
--   * Asterisks stay on the three-in-a-row rule. Of the 100 rows carrying an
--     asterisk that read as 'ok', 13 are wildcard domains (*.algotrader.com) and
--     49 are names wrapped in markdown emphasis. Neither is a redaction, and a
--     looser rule would hide them.
--   * Six rows hold the leak site's HTML description block instead of a name.
--     Five of them name the victim inside the markup - Nissin Foods Do Brasil,
--     SCHERDELWiesauplast, The Beacon Insurance Company, The RKW Group, USA Rice -
--     so marking them placeholder would hide five real victims. They are queued
--     for a name to be lifted out instead.

-- ---------------------------------------------------------------------------
-- 1. Rebuild the generated column
-- ---------------------------------------------------------------------------
-- A generated column's expression cannot be altered in place, and one policy and
-- one index depend on it, so both come off and go back on unchanged.
DROP POLICY IF EXISTS incidents_public_read ON public.incidents;
DROP INDEX IF EXISTS public.idx_incidents_data_quality;

ALTER TABLE public.incidents DROP COLUMN IF EXISTS data_quality;

ALTER TABLE public.incidents
  ADD COLUMN data_quality text GENERATED ALWAYS AS (
    CASE
      -- Not a victim at all
      WHEN victim_name ~* '^\s*(company\s*id\s*:|audit\s+entity\s*:)' THEN 'placeholder'
      WHEN victim_name ~ '\{\{.*\}\}|<%=|\$\{'                        THEN 'placeholder'
      -- A real victim, published with the name partly hidden
      WHEN victim_name LIKE '%***%'                                   THEN 'redacted'
      WHEN victim_name ~ '\?\?'                                       THEN 'redacted'
      ELSE 'ok'
    END
  ) STORED;

CREATE INDEX idx_incidents_data_quality
  ON public.incidents (data_quality) WHERE data_quality <> 'ok';

-- Unchanged: placeholders stay in the table for the service role and off the site.
CREATE POLICY incidents_public_read ON public.incidents
  FOR SELECT TO anon, authenticated USING (data_quality <> 'placeholder');

-- ---------------------------------------------------------------------------
-- 2. Queue the ones that need a person
-- ---------------------------------------------------------------------------
SELECT public.record_finding(
  'victim_name_quality',
  'Six incidents whose victim_name is the leak site''s HTML description block',
  'warning', 'open',
  jsonb_build_object(
    'question', 'Lift the victim name out of the markup, or leave the row as the source sent it?',
    'named_inside_the_markup', jsonb_build_array(
      'Nissin Foods Do Brasil Ltda', 'SCHERDELWiesauplast', 'The Beacon Insurance Company',
      'The RKW Group', 'USA Rice'),
    'contentless', '1 row carries an empty <ul><li></li></ul> and names nobody',
    'note', 'Not marked placeholder: that would hide five identifiable victims')
);

SELECT public.record_finding(
  'leak_site_notice_candidate',
  'Posts phrased as questions, missed by the title rule',
  'info', 'open',
  jsonb_build_object(
    'question', 'Are these victim claims or leak-site notices?',
    'rows', jsonb_build_array('HOW TO BUY DATA?', 'Anyone.. Who need some bags?',
                              'The result of many unknown breaches?'),
    'note', 'detect_leak_site_notices matches on leading words and does not catch these')
);

-- ---------------------------------------------------------------------------
-- 3. Report what moved
-- ---------------------------------------------------------------------------
DO $$
DECLARE r jsonb;
BEGIN
  SELECT jsonb_build_object(
    'placeholder', count(*) FILTER (WHERE data_quality = 'placeholder'),
    'redacted',    count(*) FILTER (WHERE data_quality = 'redacted'),
    'ok',          count(*) FILTER (WHERE data_quality = 'ok'))
  INTO r FROM public.incidents;
  RAISE NOTICE 'incidents by data_quality: %', r;
END $$;
