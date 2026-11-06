/**
 * Per-invocation limits, shared by the worker and the schedule capacity test.
 *
 * Workers Free refuses the 51st subrequest of an invocation. The reserve covers
 * this run's own bookkeeping - reading feed_health, a sync_log row per job, the
 * summary row - plus the fetch() calls feeds make directly, which the client
 * cannot see and so cannot count.
 */
export const SUBREQUEST_LIMIT = 50
export const SUBREQUEST_RESERVE = 18
