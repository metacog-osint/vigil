/**
 * Review Queue
 *
 * The queue of judgment calls Vigil has refused to guess at, and the verdicts
 * recorded against them. Reads the review_queue view (migration 126), which
 * joins each finding to its most recent verdict; writes go through
 * record_verdict(), which takes the reviewer's identity from the JWT rather
 * than from the caller.
 */

import { supabase } from './client'

/** Verdicts a reviewer can record, and what each one means. */
export const VERDICTS = [
  {
    value: 'confirmed',
    label: 'Confirmed',
    summary: 'The finding is real.',
    tone: 'confirm',
  },
  {
    value: 'rejected',
    label: 'Not a problem',
    summary: 'The check read this wrongly.',
    tone: 'reject',
  },
  {
    value: 'deferred',
    label: 'Not enough evidence',
    summary: 'Stays queued, with the reason on the record.',
    tone: 'defer',
  },
]

/** Severity order for sorting: the loudest thing first. */
const SEVERITY_RANK = { error: 0, warning: 1, info: 2 }

export const reviewQueue = {
  /**
   * Findings, newest evidence first within severity.
   *
   * status 'open' is the queue proper. 'all' includes everything ever ruled
   * on, because the decision log is as much the product as the queue is.
   */
  async getFindings({ status = 'open' } = {}) {
    let query = supabase.from('review_queue').select('*')

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('first_seen', { ascending: true })
    if (error) return { data: null, error }

    const sorted = [...(data || [])].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    )

    return { data: sorted, error: null }
  },

  /** How many sit in each status. A failed count is null, never 0. */
  async getCounts() {
    const { data, error } = await supabase.from('review_queue').select('status')
    if (error) return { data: null, error }

    const counts = { open: 0, resolved: 0, dismissed: 0, auto_resolved: 0, all: data.length }
    for (const row of data) {
      if (row.status in counts) counts[row.status] += 1
    }
    return { data: counts, error: null }
  },

  /** Every verdict ever recorded on one finding, most recent first. */
  async getVerdicts(findingId) {
    return supabase
      .from('finding_verdicts')
      .select('*')
      .eq('finding_id', findingId)
      .order('decided_at', { ascending: false })
  },

  /**
   * Record a verdict. The database rejects a blank or near-blank rationale,
   * so the caller does not get to decide that a reason is optional.
   */
  async recordVerdict({ findingId, verdict, rationale }) {
    return supabase.rpc('record_verdict', {
      p_finding_id: findingId,
      p_verdict: verdict,
      p_rationale: rationale,
    })
  },
}

export default reviewQueue
