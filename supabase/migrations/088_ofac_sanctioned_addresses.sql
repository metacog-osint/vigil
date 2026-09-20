-- Migration: OFAC sanctioned digital-currency addresses
-- Drafted: September 20, 2026
--
-- Vigil held 9,900 crypto wallets (ransomwhere victim payments) and no way to answer
-- "is this address sanctioned?". OFAC's SDN.XML carries every designated digital
-- currency address as a structured <id> element with its entity and programs - 1,043
-- addresses across 99 entities, the same coverage as the 127 MB advanced export and
-- without the 1,000-character truncation that drops 544 of them from SDN.CSV.
--
-- Delisting matters as much as listing (Tornado Cash was delisted in 2025), so rows
-- are never removed: an address that leaves the list keeps its history and gains a
-- delisted_at date.
--
-- Note: none of the 1,043 currently match Vigil's wallets. Ransom payment addresses
-- are generated per victim; OFAC designates exchange deposit and actor-controlled
-- addresses. The list earns its place as a lookup for any address a user asks about,
-- and as an attribution link to tracked actors.

CREATE TABLE IF NOT EXISTS public.sanctioned_addresses (
  address text PRIMARY KEY,
  currency text NOT NULL,
  entity_name text NOT NULL,
  entity_uid text,
  programs text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'ofac-sdn',
  first_seen date NOT NULL DEFAULT current_date,
  last_seen date NOT NULL DEFAULT current_date,
  delisted_at date
);

-- Addresses are case-sensitive on Bitcoin but not on Ethereum; users paste either.
CREATE INDEX IF NOT EXISTS idx_sanctioned_addresses_lower ON public.sanctioned_addresses (lower(address));
CREATE INDEX IF NOT EXISTS idx_sanctioned_addresses_entity ON public.sanctioned_addresses (entity_name);
CREATE INDEX IF NOT EXISTS idx_sanctioned_addresses_currency ON public.sanctioned_addresses (currency);

ALTER TABLE public.sanctioned_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sanctioned_addresses_public_read ON public.sanctioned_addresses;
CREATE POLICY sanctioned_addresses_public_read ON public.sanctioned_addresses
  FOR SELECT TO anon, authenticated USING (true);

-- Designated entities matched to actors Vigil tracks, so a group page can say
-- "OFAC-designated" and a sanctions query can reach the group's incidents.
CREATE TABLE IF NOT EXISTS public.actor_sanctions (
  actor_id uuid NOT NULL REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  entity_uid text NOT NULL,
  entity_name text NOT NULL,
  programs text[] NOT NULL DEFAULT '{}',
  match_basis text NOT NULL,
  source text NOT NULL DEFAULT 'ofac-sdn',
  first_seen date NOT NULL DEFAULT current_date,
  last_seen date NOT NULL DEFAULT current_date,
  PRIMARY KEY (actor_id, entity_uid)
);
ALTER TABLE public.actor_sanctions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_sanctions_public_read ON public.actor_sanctions;
CREATE POLICY actor_sanctions_public_read ON public.actor_sanctions
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.upsert_sanctioned_addresses(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted int := 0; refreshed int := 0; delisted int := 0; relisted int := 0;
  linked int := 0; total int;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'upsert_sanctioned_addresses expects a JSON array';
  END IF;

  CREATE TEMP TABLE _sdn ON COMMIT DROP AS
  SELECT DISTINCT ON (address) *
  FROM jsonb_to_recordset(p_rows) AS x(
    address text, currency text, entity_name text, entity_uid text,
    programs text[], aliases text[])
  WHERE coalesce(address, '') <> '' AND coalesce(entity_name, '') <> ''
  ORDER BY address;

  SELECT count(*) INTO total FROM _sdn;
  -- A short payload means a truncated download, not a mass delisting.
  IF total < 100 THEN
    RAISE EXCEPTION 'refusing to apply a suspiciously short SDN payload (% rows)', total;
  END IF;

  SELECT count(*) INTO relisted FROM _sdn n
  JOIN sanctioned_addresses s ON s.address = n.address
  WHERE s.delisted_at IS NOT NULL;

  WITH up AS (
    INSERT INTO sanctioned_addresses AS s
      (address, currency, entity_name, entity_uid, programs, aliases, last_seen, delisted_at)
    SELECT address, currency, entity_name, entity_uid,
           coalesce(programs, '{}'), coalesce(aliases, '{}'), current_date, NULL
    FROM _sdn
    ON CONFLICT (address) DO UPDATE
    SET currency = excluded.currency, entity_name = excluded.entity_name,
        entity_uid = excluded.entity_uid, programs = excluded.programs,
        aliases = excluded.aliases, last_seen = current_date, delisted_at = NULL
    RETURNING (xmax = 0) AS is_new
  )
  SELECT count(*) FILTER (WHERE is_new), count(*) FILTER (WHERE NOT is_new)
  INTO inserted, refreshed FROM up;

  -- Addresses no longer on the list keep their row and gain a delisting date.
  WITH gone AS (
    UPDATE sanctioned_addresses s SET delisted_at = current_date
    WHERE s.source = 'ofac-sdn' AND s.delisted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM _sdn n WHERE n.address = s.address)
    RETURNING 1)
  SELECT count(*) INTO delisted FROM gone;

  -- Designated entities that match a tracked actor by name or alias.
  WITH m AS (
    SELECT DISTINCT ON (a.id, s.entity_uid) a.id AS actor_id, s.entity_uid, s.entity_name,
           s.programs,
           CASE WHEN actor_key(a.name) = actor_key(s.entity_name) THEN 'name' ELSE 'alias' END AS basis
    FROM (SELECT DISTINCT entity_uid, entity_name, programs, aliases FROM _sdn) s
    JOIN threat_actors a
      ON actor_key(a.name) = actor_key(s.entity_name)
      OR EXISTS (SELECT 1 FROM unnest(coalesce(s.aliases, '{}')) al
                 WHERE actor_key(al) = actor_key(a.name) AND length(actor_key(al)) > 3)
    WHERE s.entity_uid IS NOT NULL
  ), ins AS (
    INSERT INTO actor_sanctions (actor_id, entity_uid, entity_name, programs, match_basis, last_seen)
    SELECT actor_id, entity_uid, entity_name, coalesce(programs, '{}'), basis, current_date FROM m
    ON CONFLICT (actor_id, entity_uid) DO UPDATE
    SET entity_name = excluded.entity_name, programs = excluded.programs, last_seen = current_date
    RETURNING 1)
  SELECT count(*) INTO linked FROM ins;

  RETURN jsonb_build_object('addresses', total, 'new', inserted, 'refreshed', refreshed,
    'relisted', relisted, 'delisted', delisted, 'actors_linked', linked);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_sanctioned_addresses(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_sanctioned_addresses(jsonb) TO service_role;
