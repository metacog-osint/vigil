/**
 * Where the published record disagrees with itself.
 *
 * Every other query object here answers "what happened". This one answers a
 * question no threat-intelligence product asks out loud: **when two bodies
 * publish different numbers for the same thing, which one does the product
 * print?** The usual answer is whichever was read last, and the reader is
 * never told there was a choice.
 *
 * ## The non-upgrade rule
 *
 * A figure's tier is the tier of the body that **produced** it, never of the
 * body that repeated it, and repetition never improves it. `claim_values`
 * records a repetition with `derived_from` pointing at what it repeats, and
 * `claim_values_resolved` walks that chain back to the originator.
 *
 * That is why `distinct_origins` and `values_recorded` are different columns
 * and why both are shown. Three values and one origin is one estimate quoted
 * three times, which is not corroboration however much it looks like it:
 *
 *   global_crypto_scam_losses_2025   3 values   1 origin   (all Chainalysis)
 *
 * ## There is deliberately no method that returns "the" value
 *
 * A caller cannot ask this module for the answer to a contested claim, because
 * picking one is exactly the behaviour the table exists to record rather than
 * perform. `resolution` and `handling` say what a person decided to do, and a
 * page renders that instruction; it does not resolve the claim itself.
 *
 * A test asserts that absence, because the obvious next commit is the one that
 * adds `getBestValue()`.
 *
 * ## Nothing here is verified
 *
 * Every seeded value carries `verification = 'carried_forward'`: read from a
 * compilation, not checked against its primary source. `getCoverage().verified`
 * is the honest headline and it is currently zero. A caller must not present a
 * carried-forward figure as an established one.
 */

import { supabase } from './client'

/** The three-tier source hierarchy, and what each tier licenses a reader to do. */
export const EVIDENCE_TIERS = {
  1: {
    label: 'Tier 1',
    short: 'primary',
    name: 'Primary documents and forensic record',
    note: 'Court filings, DOJ/Treasury/FinCEN actions, agency statistics, UN publications. Load-bearing.',
  },
  2: {
    label: 'Tier 2',
    short: 'research',
    name: 'Named commercial research and reputable press',
    note: "Always attributed to the named firm or outlet. A commercial estimate is that firm's estimate, never a neutral fact.",
  },
  3: {
    label: 'Tier 3',
    short: 'interested party',
    name: 'Interested-party and state messaging',
    note: 'Discloses what a party claims, not what is established. Never load-bearing for a conclusion.',
  },
}

/** What a publisher with no tier means. Not the same as a trustworthy one. */
export const UNCLASSIFIED_TIER = {
  label: 'Unclassified',
  short: 'unclassified',
  note: 'Nobody has classified this publisher. An unclassified source is not a Tier 1 source.',
}

/** What kind of number this is. The commonest way a reader is misled. */
export const MEASUREMENTS = {
  measured: { label: 'measured', note: 'Counted, on data the publisher held at the time.' },
  estimated: { label: 'estimated', note: "The publisher's estimate, by its own method." },
  projected: {
    label: 'projected',
    note: 'A forecast, not a count. Presenting it alone is the error this table exists to catch.',
  },
  reported: { label: 'reported', note: "An account of someone else's figure." },
  claimed: { label: 'claimed', note: 'Asserted by an interested party. Discloses the claim only.' },
}

/** What a person decided to do about a disagreement. */
export const RESOLUTIONS = {
  unresolved: { label: 'Unresolved', note: 'Nobody has ruled. The queue is asking.' },
  present_both: { label: 'Present both', note: 'Both values stand and both must be shown.' },
  present_range: {
    label: 'Present as a range',
    note: 'One range. Neither endpoint is the figure.',
  },
  prefer_one: { label: 'Prefer one', note: 'One value is right, and the reason is recorded.' },
  do_not_quote: {
    label: 'Do not quote',
    note: 'No figure here is quotable. Describe it another way.',
  },
  transcription_artefact: {
    label: 'Transcription artefact',
    note: 'Not a disagreement. Someone mistyped a figure and it propagated.',
  },
}

/** How a figure reached the record, and whether anyone has checked it. */
export const VERIFICATION_STATES = {
  verified: { label: 'verified', note: 'Read against the primary source on the date shown.' },
  carried_forward: {
    label: 'carried forward',
    note: 'Taken from an earlier compilation and not re-checked at source.',
  },
  unconfirmed: {
    label: 'unconfirmed',
    note: 'Could not be confirmed, or rests on a single source and is flagged as such.',
  },
}

const SUMMARY_COLUMNS = `
  id, claim_key, question, unit, period_start, period_end, scope_note,
  resolution, handling, decided_by, decided_at,
  values_recorded, distinct_origins, repetitions, best_tier,
  projections, values_verified, lowest_value, highest_value, spread_ratio
`

const VALUE_COLUMNS = `
  id, claim_id, claim_key, publisher_id, publisher_name, publisher_tier,
  origin_publisher_id, origin_publisher_name, effective_tier,
  repetition_depth, is_repetition,
  value_numeric, value_text, measurement, as_of, window_note,
  verification, verified_on, entered_from, source_url, citation, notes
`

export const contestedClaims = {
  /**
   * The claims, with the counts that distinguish corroboration from echo.
   *
   * `echoOnly` returns claims carrying two or more values that all trace to a
   * single body — the ones that read as agreement and are not.
   */
  async getAll({ resolution = null, echoOnly = false, limit = 50, offset = 0 } = {}) {
    let query = supabase
      .from('contested_claims_summary')
      .select(SUMMARY_COLUMNS, { count: 'exact' })
      .order('distinct_origins', { ascending: true })
      .order('claim_key', { ascending: true })
      .range(offset, offset + limit - 1)

    if (resolution) query = query.eq('resolution', resolution)
    if (echoOnly) query = query.gte('values_recorded', 2).eq('distinct_origins', 1)

    const { data, count, error } = await query
    return { data, count: typeof count === 'number' ? count : null, error }
  },

  /** One claim by its key, or null if there is no such claim. */
  async getByKey(claimKey) {
    const { data, error } = await supabase
      .from('contested_claims_summary')
      .select(SUMMARY_COLUMNS)
      .eq('claim_key', claimKey)
      .maybeSingle()

    return { data: data || null, error }
  },

  /**
   * The competing values for a claim, each carrying its originator's tier.
   *
   * Ordered so independent measurements come before the rows that repeat them.
   */
  async getValues(claimKey) {
    const { data, error } = await supabase
      .from('claim_values_resolved')
      .select(VALUE_COLUMNS)
      .eq('claim_key', claimKey)
      .order('repetition_depth', { ascending: true })
      .order('publisher_name', { ascending: true })

    return { data, error }
  },

  /** Every value on the board, for a page that shows claims and values together. */
  async getAllValues() {
    const { data, error } = await supabase
      .from('claim_values_resolved')
      .select(VALUE_COLUMNS)
      .order('claim_key', { ascending: true })
      .order('repetition_depth', { ascending: true })

    return { data, error }
  },

  /** The publishers, worst-classified first so the unclassified ones surface. */
  async getPublishers() {
    const { data, error } = await supabase
      .from('evidence_publishers')
      .select(
        'publisher_id, display_name, tier, tier_rationale, publisher_type, licence_source_id, checked_on, notes'
      )
      .order('tier', { ascending: true, nullsFirst: true })
      .order('display_name', { ascending: true })

    return { data, error }
  },

  /**
   * What the reader can and cannot expect, as database counts.
   *
   * Every figure is counted by the database with `head: true`. Counting rows
   * client-side hits PostgREST's 1,000-row cap and publishes the shortfall as
   * a fact — a defect this repository has shipped once already.
   *
   * A count that failed stays null and renders as an em dash. "0 verified" and
   * "we could not read the verified count" are different claims.
   */
  async getCoverage() {
    // evidence_publishers is keyed by publisher_id and has no id column, so
    // the column to count on is a parameter rather than an assumption.
    const count = async (table, column, apply) => {
      const query = supabase.from(table).select(column, { count: 'exact', head: true })
      const { count: n, error } = await (apply ? apply(query) : query)
      return error ? null : n
    }

    const [claims, values, repetitions, verified, echoClaims, publishers, untiered] =
      await Promise.all([
        count('contested_claims', 'id'),
        count('claim_values', 'id'),
        count('claim_values', 'id', (q) => q.not('derived_from', 'is', null)),
        count('claim_values', 'id', (q) => q.eq('verification', 'verified')),
        count('contested_claims_summary', 'id', (q) =>
          q.gte('values_recorded', 2).eq('distinct_origins', 1)
        ),
        count('evidence_publishers', 'publisher_id'),
        count('evidence_publishers', 'publisher_id', (q) => q.is('tier', null)),
      ])

    return {
      data: { claims, values, repetitions, verified, echoClaims, publishers, untiered },
      error: null,
    }
  },
}
