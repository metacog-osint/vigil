-- Migration: locate indicators in the database, not through a rate-limited API
-- Drafted: September 20, 2026
--
-- Vigil holds 51,076 IP indicators and 5,278 CIDRs and could place 164 of them.
-- scripts/enrich-geolocation.mjs calls ip-api.com one address at a time at 45
-- requests a minute, so after months it had covered 0.3%; it also stopped when the
-- scheduled workflows were disabled in May, and its free tier is licensed for
-- non-commercial use only, so it cannot follow Vigil into a paid product.
--
-- The ranges are small enough to hold locally: DB-IP's IP-to-Country Lite is 357,325
-- IPv4 ranges, published monthly under CC BY 4.0, which permits commercial use with
-- attribution. Loaded here, every indicator resolves by range lookup - no rate limit,
-- no per-query dependency, and future indicators resolve the moment they arrive.
--
-- IPv6 ranges are deliberately not loaded: Vigil holds no IPv6 indicators at all. The
-- loader takes a flag to include them when that changes.
--
-- Note on values: 48,332 of the 51,076 IP indicators are stored as "address:port",
-- the format ThreatFox publishes. ioc_ip() understands that, a plain address, and a
-- CIDR, and returns NULL rather than raising on anything else.

CREATE TABLE IF NOT EXISTS public.ip_geo_ranges (
  start_ip inet PRIMARY KEY,
  end_ip inet NOT NULL,
  country_code text NOT NULL,
  source text NOT NULL DEFAULT 'db-ip-lite',
  updated_on date NOT NULL DEFAULT current_date
);

COMMENT ON TABLE public.ip_geo_ranges IS
  'IP address ranges to country. Source: DB-IP IP to Country Lite (CC BY 4.0), refreshed monthly';

ALTER TABLE public.ip_geo_ranges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_geo_ranges_public_read ON public.ip_geo_ranges;
CREATE POLICY ip_geo_ranges_public_read ON public.ip_geo_ranges
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Turning an indicator value into an address
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ioc_ip(p_value text) RETURNS inet
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE v text := btrim(coalesce(p_value, ''));
BEGIN
  IF v = '' THEN RETURN NULL; END IF;

  -- ThreatFox publishes C2 addresses as "address:port"
  IF v ~ '^\d{1,3}(\.\d{1,3}){3}:\d+$' THEN
    v := split_part(v, ':', 1);
  END IF;

  -- A CIDR resolves at its network address
  IF v ~ '^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$' THEN
    RETURN host(network(v::cidr))::inet;
  END IF;

  IF v ~ '^\d{1,3}(\.\d{1,3}){3}$' THEN
    RETURN v::inet;
  END IF;

  RETURN NULL;
EXCEPTION WHEN others THEN
  -- A malformed indicator must never break a batch
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- The lookup: the last range starting at or before the address, if it reaches it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ip_country(p_ip inet) RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT t.country_code
  FROM (
    SELECT r.country_code, r.end_ip
    FROM ip_geo_ranges r
    WHERE r.start_ip <= p_ip
    ORDER BY r.start_ip DESC
    LIMIT 1
  ) t
  WHERE t.end_ip >= p_ip AND t.country_code <> 'ZZ';
$$;

-- ---------------------------------------------------------------------------
-- Resolved locations, kept beside the indicators rather than inside them: iocs is
-- a 568k-row table on the hot path and does not need two more columns.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ioc_geo (
  ioc_id uuid PRIMARY KEY REFERENCES public.iocs(id) ON DELETE CASCADE,
  ip inet NOT NULL,
  country_code text,
  source text NOT NULL DEFAULT 'db-ip-lite',
  resolved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ioc_geo_country ON public.ioc_geo (country_code);
CREATE INDEX IF NOT EXISTS idx_ioc_geo_ip ON public.ioc_geo (ip);

ALTER TABLE public.ioc_geo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ioc_geo_public_read ON public.ioc_geo;
CREATE POLICY ioc_geo_public_read ON public.ioc_geo
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.resolve_ioc_geo(p_limit int DEFAULT 20000) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resolved int := 0; unplaceable int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ip_geo_ranges LIMIT 1) THEN
    RETURN jsonb_build_object('skipped', 'ip_geo_ranges is empty');
  END IF;

  WITH todo AS (
    SELECT i.id, ioc_ip(i.value) AS ip
    FROM iocs i
    WHERE i.type IN ('ip', 'cidr')
      AND NOT EXISTS (SELECT 1 FROM ioc_geo g WHERE g.ioc_id = i.id)
    LIMIT greatest(1, p_limit)
  ), placed AS (
    INSERT INTO ioc_geo (ioc_id, ip, country_code)
    SELECT t.id, t.ip, ip_country(t.ip)
    FROM todo t
    WHERE t.ip IS NOT NULL
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

-- Where the indicators are, for the views that ask
CREATE OR REPLACE VIEW public.ioc_country_counts
WITH (security_invoker = on) AS
SELECT g.country_code, count(*) AS indicators, count(DISTINCT i.source) AS sources
FROM ioc_geo g
JOIN iocs i ON i.id = g.ioc_id
WHERE g.country_code IS NOT NULL
GROUP BY g.country_code;
