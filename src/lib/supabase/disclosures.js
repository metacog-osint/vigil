/**
 * What victims told a regulator.
 *
 * Every other source in Vigil records what an *attacker* claimed. This one
 * records what the organisation itself filed, under a legal obligation, with a
 * government body — a state attorney general or the SEC. It is the strongest
 * evidence class Vigil holds and the only one where the victim is the author.
 *
 * ## The trap: `persons_affected` means two different things
 *
 * Washington reports the number of **its own residents** affected. Oregon
 * reports the number of people affected **in total, worldwide**. California
 * publishes no count at all. The column is the same; the quantity is not.
 *
 *   WA  1,809 notices carrying a count →    49,341,395  state residents
 *   OR  1,445 notices carrying a count → 1,397,860,427  people worldwide
 *
 * Adding those gives 1.45 billion "people affected", which is not a number
 * about anything. `persons_affected_scope` is what tells the two apart, and it
 * is why `totalsByState()` returns them separately and labelled, and why there
 * is deliberately no method here that returns one grand total.
 *
 * ## `match_status` is a judgment, not a gap
 *
 * 8,879 of 8,895 rows are `unreviewed`. That is the designed state, not a
 * backlog someone forgot: deciding that a California notice and a leak-site
 * claim describe the same event is a person's call, and the queue exists so it
 * is recorded with its reasoning rather than guessed by a name match.
 *
 * A caller must not present `unreviewed` as "no known attacker".
 */

import { supabase } from './client'

/** The registries Vigil ingests, with what each one does and does not publish. */
export const DISCLOSURE_SOURCES = {
  'ca-ag': {
    label: 'California AG',
    short: 'CA',
    authority: 'California Attorney General',
    countScope: null,
  },
  'wa-ag': {
    label: 'Washington AG',
    short: 'WA',
    authority: 'Washington Attorney General',
    countScope: 'state_residents',
  },
  'or-ag': {
    label: 'Oregon DOJ',
    short: 'OR',
    authority: 'Oregon Department of Justice',
    countScope: 'total',
  },
  'sec-edgar': {
    label: 'SEC 8-K',
    short: 'SEC',
    authority: 'US Securities and Exchange Commission',
    countScope: null,
  },
}

/** How to read a `persons_affected` figure, in the filer's own terms. */
export const COUNT_SCOPES = {
  state_residents: {
    label: 'residents of that state',
    note: 'Counts only people in the filing state, so it understates the incident.',
  },
  total: {
    label: 'people worldwide',
    note: 'Counts everyone affected anywhere, so it is not a figure about that state.',
  },
}

const LIST_COLUMNS = `
  id, source, company_name, state, form, items,
  filed_date, incident_date, discovered_date,
  persons_affected, persons_affected_scope, data_types,
  filing_url, match_status, matched_incident_id
`

export const disclosures = {
  /**
   * A page of disclosures, newest filing first.
   *
   * Returns `{ data, count, error }` — `count` is the total matching the
   * filters, not the length of `data`, so a caller can page honestly.
   */
  async getAll({
    source = null,
    state = null,
    search = null,
    from = null,
    to = null,
    limit = 50,
    offset = 0,
  } = {}) {
    let query = supabase
      .from('victim_disclosures')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('filed_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (source) query = query.eq('source', source)
    if (state) query = query.eq('state', state)
    if (search) query = query.ilike('company_name', `%${search}%`)
    if (from) query = query.gte('filed_date', from)
    if (to) query = query.lte('filed_date', to)

    const { data, count, error } = await query
    return { data, count: typeof count === 'number' ? count : null, error }
  },

  /**
   * Per-state totals, each labelled with what its count actually counts.
   *
   * Reads the `breach_notices_by_state` view. The two count columns are
   * separate on purpose — see the note at the top of this file.
   */
  async totalsByState() {
    const { data, error } = await supabase
      .from('breach_notices_by_state')
      .select('*')
      .order('notices', { ascending: false })

    if (error) return { data: null, error }

    return {
      data: (data || []).map((row) => ({
        ...row,
        residents_affected: toNumber(row.residents_affected),
        people_affected_worldwide: toNumber(row.people_affected_worldwide),
        scope: row.residents_affected
          ? 'state_residents'
          : row.people_affected_worldwide
            ? 'total'
            : null,
      })),
      error: null,
    }
  },

  /**
   * How many disclosures each registry has supplied.
   *
   * Counted by the database rather than by reading the rows. PostgREST caps a
   * plain `select()` at 1,000 rows, so counting client-side reported 917
   * California notices against a real 5,302 — and published the shortfall as a
   * fact. Nothing here reads a row to produce a total.
   */
  async countsBySource() {
    const entries = await Promise.all(
      Object.keys(DISCLOSURE_SOURCES).map(async (source) => {
        const { count, error } = await supabase
          .from('victim_disclosures')
          .select('id', { count: 'exact', head: true })
          .eq('source', source)

        return { source, notices: error ? null : count, error }
      })
    )

    const failed = entries.find((e) => e.error)
    if (failed) return { data: null, error: failed.error }

    return {
      data: entries.filter((e) => e.notices > 0).sort((a, b) => b.notices - a.notices),
      error: null,
    }
  },

  /**
   * What a reader can and cannot expect to see, as figures rather than a claim.
   *
   * Every figure is a database count, for the reason above. `reviewed` is the
   * honest headline: how many of these filings anyone has actually ruled on
   * against Vigil's own incident data.
   *
   * A count the database did not return stays null and renders as an em dash.
   * "0 filings carry a count" and "we could not read that" are different
   * claims, and only one of them is ever true by accident.
   */
  async getCoverage() {
    const count = async (apply) => {
      const query = supabase.from('victim_disclosures').select('id', { count: 'exact', head: true })
      const { count: n, error } = await (apply ? apply(query) : query)
      return error ? null : n
    }

    const [total, reviewed, withCount, withDataTypes, withIncidentDate] = await Promise.all([
      count(),
      count((q) => q.not('match_status', 'is', null).neq('match_status', 'unreviewed')),
      count((q) => q.not('persons_affected', 'is', null)),
      count((q) => q.not('data_types', 'is', null)),
      count((q) => q.not('incident_date', 'is', null)),
    ])

    return {
      data: { total, reviewed, withCount, withDataTypes, withIncidentDate },
      error: null,
    }
  },
}

/** Postgres returns bigint sums as strings; a count Vigil cannot read stays null. */
function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export default disclosures
