-- Migration: locating indicators stops re-deriving the ones already located
-- Reviewed: September 20, 2026
--
-- `resolve_ioc_geo` has been failing every hour since 097 added it, and nothing
-- said so: the worker stored the failure in a metadata blob on a log row that was
-- usually never written. With per-feed logging (101) it appears as an error, which
-- is how this was found.
--
-- It times out. Not because there is work to do - 56,421 of 56,431 IP indicators
-- are already located, leaving ten - but because of where the address parsing sits:
--
--   SELECT i.id, ioc_ip(i.value) AS ip
--   FROM iocs i
--   WHERE i.type IN ('ip','cidr') AND NOT EXISTS (...)
--   LIMIT greatest(1, p_limit)
--
-- `ioc_ip` is evaluated for every row the scan touches, not for the rows that
-- survive the anti-join. With p_limit at 20,000 and only ten rows qualifying, the
-- scan runs to the end of the table, parsing 56,000 addresses to keep ten. Worse,
-- `ioc_ip` carries an EXCEPTION block, so each call opens a subtransaction.
--
-- The work is the same; only its position changes. Parsing moves inside the insert,
-- where it runs once per row actually being written.

CREATE OR REPLACE FUNCTION public.resolve_ioc_geo(p_limit int DEFAULT 20000) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resolved int := 0; unplaceable int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ip_geo_ranges LIMIT 1) THEN
    RETURN jsonb_build_object('skipped', 'ip_geo_ranges is empty');
  END IF;

  WITH todo AS (
    -- Carries the raw value. Nothing is parsed to decide what needs parsing.
    SELECT i.id, i.value
    FROM iocs i
    WHERE i.type IN ('ip', 'cidr')
      AND NOT EXISTS (SELECT 1 FROM ioc_geo g WHERE g.ioc_id = i.id)
    LIMIT greatest(1, p_limit)
  ), parsed AS (
    SELECT t.id, ioc_ip(t.value) AS ip
    FROM todo t
  ), placed AS (
    INSERT INTO ioc_geo (ioc_id, ip, country_code)
    SELECT p.id, p.ip, ip_country(p.ip)
    FROM parsed p
    WHERE p.ip IS NOT NULL
    ON CONFLICT (ioc_id) DO NOTHING
    RETURNING country_code
  )
  SELECT count(*), count(*) FILTER (WHERE country_code IS NULL) INTO resolved, unplaceable FROM placed;

  RETURN jsonb_build_object(
    'resolved', resolved,
    'no_country_in_ranges', unplaceable,
    'total_placed', (SELECT count(*) FROM ioc_geo WHERE country_code IS NOT NULL),
    'remaining', (SELECT count(*) FROM iocs i WHERE i.type IN ('ip', 'cidr')
                  AND NOT EXISTS (SELECT 1 FROM ioc_geo g WHERE g.ioc_id = i.id))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_ioc_geo(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ioc_geo(int) TO service_role;

-- The anti-join and the two counts in the return all walk the IP indicators. This
-- gives them an index to walk rather than the whole 568k-row table.
CREATE INDEX IF NOT EXISTS idx_iocs_ip_like
  ON public.iocs (id) WHERE type IN ('ip', 'cidr');
