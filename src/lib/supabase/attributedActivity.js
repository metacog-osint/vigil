/**
 * Activity a government attributed, which ransomware leak sites cannot show.
 *
 * Every incident Vigil holds comes from a leak-site tracker, so it can only
 * record an attack the attacker chose to publish for extortion. Sixty threat
 * actors are attributed to Iran and fifty-nine have no incidents at all.
 * `attributed_activity` (migration 131) is the other kind of evidence: a
 * government saying, on the record, that it investigated and who it blames.
 *
 * The wording is the point. CISA writes "Iranian-Affiliated Cyber Actors",
 * "Russian State-Sponsored", "China-Nexus" and "Pro-Russia Hacktivists" and
 * means four different things — a hacktivist collective is not a state
 * apparatus. `attribution_phrase` keeps the source's exact words and
 * `attribution_strength` records which of the five kinds it is. Nothing here
 * collapses them, and neither should any caller.
 */

import { supabase } from './client'

/**
 * Ordered weakest to strongest claim about state involvement. Exported so the
 * map and any future consumer rank the same way rather than each inventing an
 * order — and so that adding a sixth kind is one edit, not a search.
 */
export const ATTRIBUTION_STRENGTHS = ['criminal', 'aligned', 'nexus', 'affiliated', 'state']

/** The governments that write into this table, as they should be named. */
export const ATTRIBUTION_SOURCE_LABELS = {
  cisa: 'CISA (US)',
  'ncsc-uk': 'NCSC (UK)',
}

/** How each kind should be described where there is room to describe it. */
export const ATTRIBUTION_STRENGTH_LABELS = {
  state: 'State-sponsored',
  affiliated: 'State-affiliated',
  nexus: 'State-nexus',
  aligned: 'Aligned, not state',
  criminal: 'Criminal',
}

/**
 * Colours are deliberately not a single-hue ramp. A ramp reads as "more of the
 * same thing", and these are different assertions, not different amounts of
 * one. See the legend in ThreatAttributionMap.
 */
export const ATTRIBUTION_STRENGTH_COLORS = {
  state: '#b91c1c',
  affiliated: '#ea580c',
  nexus: '#a16207',
  aligned: '#6d28d9',
  criminal: '#4b5563',
}

/** Rank of a strength, or -1 for an unrecognised or absent one. */
export function strengthRank(strength) {
  return ATTRIBUTION_STRENGTHS.indexOf(strength)
}

export const attributedActivity = {
  /**
   * Every advisory, newest first. Ten rows today; this is a corpus that grows
   * by a handful a month, so there is no pagination and no need for one.
   */
  async getAll({ country = null, limit = 200 } = {}) {
    let query = supabase
      .from('attributed_activity')
      .select('*')
      .order('published', { ascending: false })
      .limit(limit)

    if (country) query = query.eq('attributed_country', country.toUpperCase())

    return query
  },

  /**
   * The per-country aggregate the map colours by, straight from the view.
   *
   * Note what the view does *not* offer: a number comparable to an incident
   * count. Advisories and victim claims are not the same quantity and a single
   * "attacks by country" figure mixing them would be meaningless.
   */
  async getByCountry() {
    return supabase
      .from('attributed_activity_by_country')
      .select(
        'country_code, advisories, state_attributed, earliest, latest, phrases_used, sources, sources_used'
      )
      .order('advisories', { ascending: false })
  },

  /**
   * Advisories keyed by attributed country, each carrying the strongest claim
   * made about that country and every distinct phrase used about it.
   *
   * The strongest claim drives the fill colour; the phrases drive the tooltip.
   * A country with one "state-sponsored" advisory and three "aligned" ones is
   * drawn as state and says so four times over in the tooltip, because hiding
   * the weaker three would overstate and hiding the strongest would understate.
   */
  async getCountryIndex() {
    const { data, error } = await this.getAll({ limit: 500 })
    if (error) return { data: null, error }

    const byCountry = {}
    for (const row of data || []) {
      const code = row.attributed_country?.toUpperCase()
      if (!code) continue

      if (!byCountry[code]) {
        byCountry[code] = {
          count: 0,
          advisories: [],
          phrases: new Set(),
          sources: new Set(),
          strongest: null,
        }
      }

      const entry = byCountry[code]
      entry.count++
      entry.advisories.push(row)
      if (row.attribution_phrase) entry.phrases.add(row.attribution_phrase)
      if (row.source) entry.sources.add(row.source)
      if (strengthRank(row.attribution_strength) > strengthRank(entry.strongest)) {
        entry.strongest = row.attribution_strength
      }
    }

    for (const entry of Object.values(byCountry)) {
      entry.phrases = Array.from(entry.phrases)
      // Two governments naming a country independently is a materially
      // stronger position than one naming it twice, and nothing else on the
      // map distinguishes them.
      entry.sources = Array.from(entry.sources)
      entry.advisories.sort((a, b) => (a.published < b.published ? 1 : -1))
    }

    return { data: byCountry, error: null }
  },

  /**
   * How much of the corpus carries attribution at all.
   *
   * An advisory without an attributed country is not a failure — plenty of
   * CISA advisories are about a vulnerability and blame nobody — but a map
   * drawn from five of ten advisories should say which five.
   */
  async getCoverage() {
    const { data, error } = await supabase
      .from('attributed_activity')
      .select('attributed_country, published')

    if (error) return { data: null, error }

    const rows = data || []
    return {
      data: {
        total: rows.length,
        attributed: rows.filter((r) => r.attributed_country).length,
        latest: rows.reduce((max, r) => (!max || r.published > max ? r.published : max), null),
      },
      error: null,
    }
  },
}

export default attributedActivity
