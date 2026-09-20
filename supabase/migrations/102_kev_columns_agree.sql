-- Migration: the KEV catalogue the API serves is the one CISA publishes
-- Reviewed: September 20, 2026
--
-- `vulnerabilities` carries two sets of columns for the same facts, written by
-- different generations of ingestion code and read by different parts of the app:
--
--   written by the worker    read by the app
--   ---------------------    ---------------
--   kev_date                 kev_date_added
--   exploited_in_wild        is_kev
--   ransomware_campaign_use  ransomware_use
--   affected_vendors[]       vendor
--   affected_products[]      product
--   metadata->>'title'       title
--
-- The worker writes the left column; api/v1/vulnerabilities.js filters on
-- `is_kev`, and the sort options in src/lib/constants/filters.js order by
-- `kev_date_added`. Both stopped being written in January, when the GitHub Actions
-- workflows that wrote them were disabled.
--
-- The result was not an outage. Ingestion kept working: 1,717 CISA KEV rows, the
-- newest dated 18 September. But only 1,587 of them carry is_kev, and the newest
-- of those is dated 12 January. Every KEV entry of the last eight months - 230 of
-- them - is in the database and invisible to `?kev=true`.
--
-- Writing both sets from the worker would fix today's rows and drift again the
-- next time something writes only one side. So the agreement is enforced in the
-- database instead: whatever writes a KEV row, the app-facing columns follow.
--
-- Not derived here: `severity`. CISA publishes no CVSS score with the catalogue,
-- and inferring one from ransomware use would be Vigil asserting a severity
-- nobody published. It stays null until a source provides it.

-- ---------------------------------------------------------------------------
-- 1. Keep the two sets in agreement, whoever writes the row
-- ---------------------------------------------------------------------------
--
-- coalesce throughout: a value already set by another source (NVD fills vendor and
-- product for its own rows) is never overwritten. is_kev is only ever set true -
-- vulncheck-kev rows are flagged without carrying a CISA date, and clearing them
-- would discard that source's judgment.

CREATE OR REPLACE FUNCTION sync_kev_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kev_date IS NOT NULL THEN
    NEW.is_kev := true;
    NEW.kev_date_added := COALESCE(NEW.kev_date_added, NEW.kev_date);
  END IF;

  NEW.ransomware_use := COALESCE(NEW.ransomware_use, NEW.ransomware_campaign_use);
  NEW.vendor         := COALESCE(NEW.vendor, NEW.affected_vendors[1]);
  NEW.product        := COALESCE(NEW.product, NEW.affected_products[1]);
  NEW.title          := COALESCE(NEW.title, NULLIF(NEW.metadata->>'title', ''));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_kev_columns() IS
  'Derives the app-facing KEV columns (is_kev, kev_date_added, ransomware_use, vendor, product, title) from whatever the ingestion side wrote. See migration 102.';

DROP TRIGGER IF EXISTS trg_sync_kev_columns ON vulnerabilities;
CREATE TRIGGER trg_sync_kev_columns
  BEFORE INSERT OR UPDATE ON vulnerabilities
  FOR EACH ROW EXECUTE FUNCTION sync_kev_columns();

-- ---------------------------------------------------------------------------
-- 2. The eight months already in the table
-- ---------------------------------------------------------------------------

UPDATE vulnerabilities
SET is_kev = true
WHERE kev_date IS NOT NULL
  AND NOT COALESCE(is_kev, false);

UPDATE vulnerabilities
SET kev_date_added = kev_date
WHERE kev_date IS NOT NULL
  AND kev_date_added IS NULL;

UPDATE vulnerabilities
SET ransomware_use = ransomware_campaign_use
WHERE ransomware_use IS NULL
  AND ransomware_campaign_use IS NOT NULL;

UPDATE vulnerabilities
SET vendor = affected_vendors[1]
WHERE vendor IS NULL
  AND affected_vendors IS NOT NULL
  AND array_length(affected_vendors, 1) > 0;

UPDATE vulnerabilities
SET product = affected_products[1]
WHERE product IS NULL
  AND affected_products IS NOT NULL
  AND array_length(affected_products, 1) > 0;

UPDATE vulnerabilities
SET title = metadata->>'title'
WHERE title IS NULL
  AND NULLIF(metadata->>'title', '') IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Check the claim this migration makes
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  unflagged int;
  newest_flagged date;
BEGIN
  SELECT count(*) INTO unflagged
  FROM vulnerabilities
  WHERE kev_date IS NOT NULL AND NOT COALESCE(is_kev, false);

  SELECT max(kev_date) INTO newest_flagged
  FROM vulnerabilities WHERE is_kev;

  IF unflagged > 0 THEN
    RAISE EXCEPTION 'KEV backfill incomplete: % rows still carry kev_date without is_kev', unflagged;
  END IF;

  RAISE NOTICE 'KEV columns agree. Newest flagged entry: %', newest_flagged;
END $$;
