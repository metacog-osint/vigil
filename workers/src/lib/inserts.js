/**
 * Counts the rows a feed's upserts inserted, as opposed to rows that were
 * already there and only got updated.
 *
 * Most feeds upsert, and until 15 November 2026 they reported every row they
 * wrote as `updated`, so sync_log.records_added stayed 0 whether a run brought
 * a thousand new indicators or the same list again. feed_health.stalled reads
 * records_added, so a feed could only be watched for stalls if it said what was
 * new. See countInsertedRows in supabase.js for how an upsert finds out.
 *
 * `added` is null, not 0, if any batch could not say: a count that is partly
 * a guess is not a count, and the scheduler logs null as "not known".
 */
export function createInsertTally() {
  let added = 0
  let known = true

  return {
    /** Takes one upsert's `inserted` and returns it, or 0 if it is not known. */
    record(inserted) {
      if (Number.isFinite(inserted)) {
        added += inserted
        return inserted
      }
      known = false
      return 0
    },
    get added() {
      return known ? added : null
    },
  }
}
