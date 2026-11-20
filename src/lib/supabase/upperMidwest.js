/**
 * The Upper Midwest watch pack: Minnesota, North Dakota, South Dakota, Iowa
 * and Wisconsin (ideas#51, scope A: page only, no migration, no worker change).
 *
 * ## Three lanes, never summed
 *
 * Each lane places an organization in a state by a different field, and the
 * fields do not mean the same thing, so the page shows them apart:
 *
 *   HHS OCR      `business_location`, the covered entity's state, HHS's own field
 *   SEC 8-K      `business_location`, "City, ST" from EDGAR (the business address)
 *   Leak sites   no state field at all. Two weak routes, each marked:
 *                  - the claimed victim has exactly the name of a filing placed here
 *                  - the claim's own description text names the state
 *                Both are criminals' claims and neither placement is verified.
 *
 * The state AG registries Vigil holds (CA, WA, OR and the rest) are left out on
 * purpose: their `state` is the registry's state, not the organization's, and
 * no IA, WI, MN, ND or SD registry is held.
 *
 * ## The two rules from disclosures.js still hold
 *
 *   No total of people affected. HHS counts everyone affected; nothing here
 *   adds those up, and there is no method that would.
 *
 *   Every figure is a database count (`head: true`), never a tally of rows a
 *   page happened to fetch. PostgREST caps a plain select at 1,000.
 */

import { supabase } from './client'

export const UPPER_MIDWEST = [
  { code: 'MN', name: 'Minnesota' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'IA', name: 'Iowa' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'SD', name: 'South Dakota' },
]

export const UPPER_MIDWEST_CODES = UPPER_MIDWEST.map((s) => s.code)

const FILING_COLUMNS = `
  id, source, company_name, business_location, form, items,
  filed_date, incident_date, persons_affected, persons_affected_scope,
  breach_cause, covered_entity_type, filing_url, match_status
`

const CLAIM_COLUMNS = `
  id, victim_name, victim_country, victim_sector, discovered_date,
  threat_actor:threat_actors(id, name)
`

/** Names per request when matching claims to placed filings; keeps the URL short. */
const NAME_CHUNK = 40

/** PostgREST returns at most this many rows a request. */
const PAGE = 1000

/** The codes a call should cover: one state, or all five. */
function codesFor(state) {
  if (!state) return UPPER_MIDWEST_CODES
  return UPPER_MIDWEST_CODES.includes(state) ? [state] : []
}

/** Restrict a victim_disclosures query to one lane in one state. */
function placeFiling(query, lane, code) {
  if (lane === 'hhs-ocr') return query.eq('source', 'hhs-ocr').eq('business_location', code)
  return query.eq('source', 'sec-edgar').like('business_location', `%, ${code}`)
}

function yearAgo(now = new Date()) {
  const d = new Date(now)
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function stateName(code) {
  return UPPER_MIDWEST.find((s) => s.code === code)?.name || code
}

export const upperMidwest = {
  /**
   * Per-state database counts for each lane.
   *
   * A count the database did not return stays null (an em dash on screen):
   * "0 filings" and "could not read that" are different claims.
   */
  async getCounts({ now = new Date() } = {}) {
    const since = yearAgo(now)

    const count = async (table, apply) => {
      const { count: n, error } = await apply(
        supabase.from(table).select('id', { count: 'exact', head: true })
      )
      return error ? null : n
    }

    const rows = await Promise.all(
      UPPER_MIDWEST.map(async ({ code, name }) => {
        const [hhs, hhsYear, sec, claimsText] = await Promise.all([
          count('victim_disclosures', (q) => placeFiling(q, 'hhs-ocr', code)),
          count('victim_disclosures', (q) =>
            placeFiling(q, 'hhs-ocr', code).gte('filed_date', since)
          ),
          count('victim_disclosures', (q) => placeFiling(q, 'sec-edgar', code)),
          count('incidents', (q) => q.ilike('raw_data->>description', `%${name}%`)),
        ])
        return { state: code, name, hhs, hhsYear, sec, claimsText }
      })
    )

    return { data: rows, since, error: null }
  },

  /**
   * A page of one lane's filings, newest first. `count` is the database's
   * count of every match, so the caller can page honestly.
   */
  async getFilings({ lane = 'hhs-ocr', state = null, limit = 50, offset = 0 } = {}) {
    const codes = codesFor(state)
    if (!codes.length) return { data: [], count: 0, error: null }

    let query = supabase
      .from('victim_disclosures')
      .select(FILING_COLUMNS, { count: 'exact' })
      .order('filed_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (lane === 'hhs-ocr') {
      query = query.eq('source', 'hhs-ocr').in('business_location', codes)
    } else {
      query = query
        .eq('source', 'sec-edgar')
        .or(codes.map((c) => `business_location.like."*, ${c}"`).join(','))
    }

    const { data, count, error } = await query
    return {
      data: (data || []).map((row) => ({ ...row, placed_in: placedIn(row) })),
      count: typeof count === 'number' ? count : null,
      error,
    }
  },

  /**
   * Leak-site claims whose victim has exactly the name of a filing placed in
   * one of the five states. A shared name is a lead, not a link: Vigil has not
   * ruled that the two describe one organization or one event.
   */
  async getClaimsSameName({ state = null } = {}) {
    const codes = codesFor(state)
    if (!codes.length) return { data: [], error: null }

    // The placed names, read in pages so the 1,000-row cap cannot cut the list.
    const placed = new Map()
    for (const lane of ['hhs-ocr', 'sec-edgar']) {
      for (const code of codes) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await placeFiling(
            supabase.from('victim_disclosures').select('company_name, source, business_location'),
            lane,
            code
          ).range(from, from + PAGE - 1)
          if (error) return { data: null, error }
          for (const row of data || []) {
            if (!row.company_name) continue
            const list = placed.get(row.company_name) || []
            list.push({ source: row.source, state: code })
            placed.set(row.company_name, list)
          }
          if (!data || data.length < PAGE) break
        }
      }
    }

    const names = [...placed.keys()]
    const claims = []
    for (let i = 0; i < names.length; i += NAME_CHUNK) {
      const { data, error } = await supabase
        .from('incidents')
        .select(CLAIM_COLUMNS)
        .in('victim_name', names.slice(i, i + NAME_CHUNK))
      if (error) return { data: null, error }
      claims.push(...(data || []))
    }

    return {
      data: claims
        .map((c) => ({ ...c, matched: dedupe(placed.get(c.victim_name) || []) }))
        .sort(byDiscoveredDesc),
      error: null,
    }
  },

  /**
   * Leak-site claims whose own description text names one of the states.
   * Unverified: the text is the criminals' and may name a branch, a customer
   * or nothing to do with where the victim is.
   */
  async getClaimsNamingState({ state = null, limit = 100 } = {}) {
    const codes = codesFor(state)
    const results = await Promise.all(
      codes.map(async (code) => {
        const { data, error } = await supabase
          .from('incidents')
          .select(CLAIM_COLUMNS)
          .ilike('raw_data->>description', `%${stateName(code)}%`)
          .order('discovered_date', { ascending: false })
          .limit(limit)
        return { code, data, error }
      })
    )

    const failed = results.find((r) => r.error)
    if (failed) return { data: null, error: failed.error }

    // One claim can name two states; list it once with both.
    const byId = new Map()
    for (const { code, data } of results) {
      for (const claim of data || []) {
        const held = byId.get(claim.id) || { ...claim, states_named: [] }
        held.states_named.push(code)
        byId.set(claim.id, held)
      }
    }
    return { data: [...byId.values()].sort(byDiscoveredDesc), error: null }
  },
}

/** The state code a filing was placed in, from its own field. */
export function placedIn(row) {
  const loc = row?.business_location || ''
  const code = row?.source === 'hhs-ocr' ? loc : loc.split(',').pop()?.trim()
  return UPPER_MIDWEST_CODES.includes(code) ? code : null
}

function dedupe(list) {
  const seen = new Set()
  return list.filter((m) => {
    const key = `${m.source}:${m.state}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function byDiscoveredDesc(a, b) {
  return String(b.discovered_date || '').localeCompare(String(a.discovered_date || ''))
}

export default upperMidwest
