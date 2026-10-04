/**
 * OFAC-designated digital currency addresses, and which tracked actors are
 * designated entities.
 *
 * 1,050 addresses across 99 entities, from SDN.XML (migration 088). US public
 * domain, so unlike most of what Vigil holds this carries no commercial
 * restriction - see `source_licences`.
 *
 * THE THING THIS MUST NOT IMPLY
 *
 * None of these addresses match the ransom-payment wallets Vigil holds, and
 * that is expected rather than a gap: ransom addresses are generated per
 * victim, while OFAC designates exchange deposit and actor-controlled
 * addresses. A page that put the two counts side by side would invite the
 * inference that a victim paid a sanctioned address, which nothing here
 * supports. `getOverview` returns the overlap explicitly so the page can state
 * it instead of leaving it to be guessed at.
 *
 * DELISTING IS DATA
 *
 * Rows are never deleted. Tornado Cash was delisted in 2025, and an address
 * that leaves the list keeps its history and gains a `delisted_at`. "Was
 * sanctioned until March" is a different answer from "is sanctioned" and from
 * "was never sanctioned", and a lookup that collapsed them would be wrong in
 * the most consequential direction.
 */

import { supabase } from './client'

/** Bitcoin addresses are case-sensitive; Ethereum's are not. Users paste either. */
function normalise(value) {
  return String(value ?? '').trim()
}

const COUNT = { count: 'exact', head: true }

export const sanctions = {
  /**
   * Is this address on the list, and was it ever?
   *
   * Matched on lower(address), which `idx_sanctioned_addresses_lower` serves,
   * because a user pasting an Ethereum address will not match the stored case.
   *
   * A miss returns `{ found: false }` and never the word clean. Vigil holds the
   * SDN list, not the truth about an address: not on this list means not
   * designated by OFAC as of `asOf`, which is a narrower claim and the only one
   * that can be supported.
   */
  async lookupAddress(value) {
    const address = normalise(value)
    if (!address) return { data: null, error: null }

    const { data, error } = await supabase
      .from('sanctioned_addresses')
      .select('address, currency, entity_name, entity_uid, programs, aliases, first_seen, last_seen, delisted_at')
      .ilike('address', address)
      .limit(1)

    if (error) return { data: null, error }

    const hit = data?.[0] ?? null
    const { data: asOf } = await supabase
      .from('sanctioned_addresses')
      .select('last_seen')
      .order('last_seen', { ascending: false })
      .limit(1)

    return {
      data: {
        query: address,
        found: Boolean(hit),
        /** A hit that is delisted is a third answer, not a yes. */
        currentlyDesignated: hit ? hit.delisted_at === null : false,
        match: hit,
        asOf: asOf?.[0]?.last_seen ?? null,
      },
      error: null,
    }
  },

  /**
   * Counts for the header. Every one is a database count rather than the length
   * of a returned array: PostgREST caps a plain select at 1,000 rows, and this
   * table has more than that, so counting client-side would under-report by
   * exactly the amount that makes it look fine.
   *
   * A failed count is null, not 0. Nobody can tell a real zero from a failure
   * once it has been rendered as "0".
   */
  async getOverview() {
    const count = async (apply) => {
      const query = supabase.from('sanctioned_addresses').select('address', COUNT)
      const { count: n, error } = await (apply ? apply(query) : query)
      return error ? null : n
    }

    const [addresses, delisted, entityRows, overlap, asOfRows] = await Promise.all([
      count(),
      count((q) => q.not('delisted_at', 'is', null)),
      supabase
        .from('sanctioned_addresses')
        .select('entity_uid')
        .not('entity_uid', 'is', null)
        .then(({ data, error }) => (error ? null : data)),
      // Measured, not asserted. sanctions_wallet_overlap() is one call rather
      // than fetching 9,900 wallets into the browser. See migration 151.
      supabase.rpc('sanctions_wallet_overlap').then(({ data, error }) =>
        error ? null : data
      ),
      supabase
        .from('sanctioned_addresses')
        .select('last_seen')
        .order('last_seen', { ascending: false })
        .limit(1)
        .then(({ data, error }) => (error ? null : data)),
    ])

    return {
      data: {
        addresses,
        delisted,
        currentlyDesignated:
          addresses === null || delisted === null ? null : addresses - delisted,
        // entity_uid is not unique per row - one entity holds many addresses -
        // and PostgREST cannot count distinct, so this is the one figure
        // derived from returned rows. It is capped at 1,000 like any select,
        // which is why it is labelled "at least" wherever it is rendered.
        entitiesAtLeast: entityRows === null ? null : new Set(entityRows.map((r) => r.entity_uid)).size,
        entitiesCapped: entityRows !== null && entityRows.length >= 1000,
        walletsHeld: overlap?.wallets_held ?? null,
        walletsOnSdnList: overlap?.wallets_on_sdn_list ?? null,
        overlapMeasuredAt: overlap?.measured_at ?? null,
        asOf: asOfRows?.[0]?.last_seen ?? null,
      },
      error: null,
    }
  },

  /** Designated entities, most addresses first, with their programs. */
  async getEntities({ limit = 50, search = '' } = {}) {
    let query = supabase
      .from('sanctioned_addresses')
      .select('entity_uid, entity_name, programs, currency, delisted_at')

    const term = normalise(search)
    if (term) query = query.ilike('entity_name', `%${term}%`)

    const { data, error } = await query
    if (error) return { data: null, error }

    const byEntity = new Map()
    for (const row of data) {
      const key = row.entity_uid ?? row.entity_name
      const entry = byEntity.get(key) ?? {
        entityUid: row.entity_uid,
        entityName: row.entity_name,
        programs: new Set(),
        currencies: new Set(),
        addresses: 0,
        delisted: 0,
      }
      entry.addresses += 1
      if (row.delisted_at) entry.delisted += 1
      for (const p of row.programs ?? []) entry.programs.add(p)
      if (row.currency) entry.currencies.add(row.currency)
      byEntity.set(key, entry)
    }

    const entities = [...byEntity.values()]
      .map((e) => ({
        ...e,
        programs: [...e.programs].sort(),
        currencies: [...e.currencies].sort(),
      }))
      .sort((a, b) => b.addresses - a.addresses || a.entityName.localeCompare(b.entityName))
      .slice(0, limit)

    return { data: entities, error: null }
  },

  /**
   * Tracked actors that are OFAC-designated entities, with how the link was
   * made. `match_basis` is the whole point: 'name' is an exact match on the
   * designated name, 'alias_reviewed' means a person confirmed it. Nothing is
   * linked on an alias without a recorded verdict.
   */
  async getActorLinks() {
    return supabase
      .from('actor_sanctions')
      .select('actor_id, entity_uid, entity_name, programs, match_basis, first_seen, last_seen, threat_actors(name, actor_type)')
      .order('entity_name')
  },

  /**
   * The verdicts themselves, including the rejections.
   *
   * A rejection is the most useful row here. Hydra matches HYDRA MARKET by
   * name, and a system that asserted it would be wrong: Vigil tracks Hydra as
   * a ransomware family, OFAC designated a darknet marketplace. The reason that
   * link does not exist is recorded, which is the difference between this and a
   * name-matching script.
   */
  async getDecisions() {
    return supabase
      .from('sanctions_match_decisions')
      .select('actor_key, entity_uid, verdict, rationale, decided_by, decided_at')
      .order('decided_at', { ascending: false })
  },
}

/** What OFAC's programme codes mean, for the ones this list actually uses. */
export const SANCTIONS_PROGRAMS = {
  CYBER2: 'Malicious cyber activity (EO 13694/13757)',
  CYBER4: 'Malicious cyber activity, later designations',
  SDGT: 'Specially Designated Global Terrorist',
  FTO: 'Foreign Terrorist Organization',
  TCO: 'Transnational Criminal Organization',
  DPRK3: 'North Korea (EO 13722)',
  DPRK4: 'North Korea (EO 13810)',
  'ILLICIT-DRUGS-EO14059': 'Illicit drug trafficking (EO 14059)',
  'ELECTION-EO13848': 'Foreign election interference (EO 13848)',
  'RUSSIA-EO14024': 'Harmful foreign activities of the Russian government',
  IFSR: 'Iran financial sanctions',
  NPWMD: 'Weapons of mass destruction proliferation',
}

/** 'confirmed' and 'rejected' are both verdicts. Only 'unreviewed' is absence. */
export const SANCTIONS_VERDICTS = {
  confirmed: 'Confirmed by review',
  rejected: 'Rejected by review',
  unreviewed: 'Not yet reviewed',
}
