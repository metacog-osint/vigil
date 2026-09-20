-- Migration: locating indicators stops counting the whole table to report nothing
-- Reviewed: September 20, 2026
--
-- 106 moved the address parsing out of the scan, which was the large cost. The
-- first deployed run still timed out, and with zero indicators left to locate,
-- so the remaining cost is not the work - there was none - it is the report:
--
--   'total_placed', (SELECT count(*) FROM ioc_geo WHERE country_code IS NOT NULL)
--   'remaining',    (SELECT count(*) FROM iocs i WHERE i.type IN ('ip','cidr')
--                    AND NOT EXISTS (SELECT 1 FROM ioc_geo g WHERE g.ioc_id = i.id))
--
-- Two full passes over 56,000 rows, run every hour to say "nothing to do". The
-- anti-join that finds the work is a third. On an idle instance that fits inside
-- PostgREST's statement timeout; behind the data-quality pass that runs before it
-- on the same trigger, it does not.
--
-- They are diagnostics, not results. They are now computed only when the run
-- actually placed something, which is when their value is worth the scan. A run
-- with nothing to do returns { resolved: 0 } and costs one anti-join.

CREATE OR REPLACE FUNCTION public.resolve_ioc_geo(p_limit int DEFAULT 5000) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resolved int := 0; unplaceable int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ip_geo_ranges LIMIT 1) THEN
    RETURN jsonb_build_object('skipped', 'ip_geo_ranges is empty');
  END IF;

  WITH todo AS (
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

  -- The quiet case, which is most hours: say so and stop.
  IF resolved = 0 THEN
    RETURN jsonb_build_object('resolved', 0);
  END IF;

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
