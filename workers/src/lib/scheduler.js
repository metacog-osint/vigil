/**
 * Picks which jobs to run this invocation, runs them, and records each one.
 *
 * Two rules matter here, and both come from the same failure:
 *
 *   1. Every job writes its own sync_log row the moment it finishes. The old code
 *      wrote one row for the whole run, at the end, which is exactly the write
 *      that got refused when the run had spent its subrequests. Feeds were
 *      ingesting for months with nothing to show they had.
 *
 *   2. A job that reports `skipped` is recorded as skipped, not success. Six feeds
 *      return `{ success: true, skipped: true }` when their API key is missing.
 *      Counting that as a successful run is how a feed goes quiet without anyone
 *      noticing, which is the thing `feed_health` exists to prevent.
 */

import { SubrequestBudgetError } from './supabase.js'

/**
 * A job is only started if a useful share of its declared cost is still available.
 * Requiring the full cost would leave cheap jobs waiting behind an expensive one
 * that will never fit; requiring none would start feeds that fail halfway and
 * write nothing useful.
 */
const MIN_SHARE_OF_COST = 0.5

/**
 * Reads the last successful run of every job. `feed_health` (migration 101) does
 * the aggregation in SQL so this stays one subrequest rather than one per job.
 */
export async function readFeedHealth(db) {
  const { data, error } = await db.select('feed_id,last_success_at,minutes_since_success')
  if (error) {
    console.error('Could not read feed_health:', error.message)
    return {}
  }
  return Object.fromEntries((data || []).map(row => [row.feed_id, row]))
}

/**
 * Due jobs, most starved first. A job that has never run successfully sorts ahead
 * of everything else at its priority, so a newly added or long-broken feed gets a
 * slot instead of waiting behind healthy ones.
 */
export function selectDueJobs(jobs, health) {
  const due = []

  for (const job of jobs) {
    const row = health[job.id]
    const minutesSince = row?.minutes_since_success

    // Never run, or no successful run on record: always due.
    const overdueRatio = minutesSince == null
      ? Number.POSITIVE_INFINITY
      : minutesSince / job.intervalMinutes

    if (overdueRatio >= 1) due.push({ job, overdueRatio })
  }

  due.sort((a, b) =>
    a.job.priority - b.job.priority ||
    b.overdueRatio - a.overdueRatio ||
    a.job.id.localeCompare(b.job.id)
  )

  return due.map(entry => entry.job)
}

/**
 * Runs one job and records the outcome. Never throws: a feed that fails is a row
 * in sync_log, not a dead invocation that takes the rest of the run with it.
 */
export async function runJob(job, { feedDb, logDb, env, budget, trigger }) {
  const startedAt = new Date()
  let result
  let status = 'success'
  let errorMessage = null

  try {
    result = await job.run(feedDb, env)
  } catch (error) {
    result = { success: false, error: error.message }
    // Budget exhaustion is a capacity signal, not a fault in the feed itself.
    status = error instanceof SubrequestBudgetError ? 'budget_exhausted' : 'error'
    errorMessage = error.message
  }

  if (status === 'success') {
    const skip = skipReason(result)
    if (skip) {
      status = 'skipped'
      errorMessage = skip
    } else if (result?.success === false) {
      status = 'error'
      errorMessage = result.error || 'feed reported failure without an error'
    }
  }

  const completedAt = new Date()
  const added = numberOr(result?.added, 0)
  const updated = numberOr(result?.updated, 0)
  const failed = numberOr(result?.failed, 0)

  // A feed that fetched its data, failed to write any of it, and returned
  // `success: true` is the same silence in a different place. ThreatFox did
  // exactly this on the first live run of the new scheduler: 1,296 records
  // failed, nothing written, reported as a successful run.
  if (status === 'success' && failed > 0 && added + updated === 0) {
    status = 'error'
    errorMessage = `fetched ${failed} records and wrote none of them`
  }

  await logDb.insert({
    source: job.id,
    status,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    records_added: added,
    records_updated: updated,
    records_failed: failed,
    records_processed: added + updated + failed,
    error_message: errorMessage,
    metadata: {
      trigger,
      duration_ms: completedAt - startedAt,
      subrequests_used: budget.used,
      result
    }
  })

  console.log(`[${job.id}] ${status} in ${completedAt - startedAt}ms`)
  return { id: job.id, status }
}

/**
 * Runs due jobs until the subrequest budget runs low. Whatever does not fit is
 * left for the next trigger, which will find it further overdue and take it first.
 */
export async function runDueJobs({ jobs, feedDb, logDb, healthDb, env, budget, trigger }) {
  const health = await readFeedHealth(healthDb)
  const due = selectDueJobs(jobs, health)

  const ran = []
  const deferred = []

  for (const job of due) {
    // `continue`, not `break`: a cheap job further down the list can still run
    // after an expensive one has been passed over.
    if (budget.remaining < job.cost * MIN_SHARE_OF_COST) {
      deferred.push(job.id)
      continue
    }
    ran.push(await runJob(job, { feedDb, logDb, env, budget, trigger }))
  }

  return { ran, deferred, subrequestsUsed: budget.used }
}

/**
 * `skipped` means three different things across the feeds, and reading it loosely
 * mislabels good runs:
 *
 *   true      - the feed declined to run (six feeds do this when an API key is
 *               missing), which is the case this is meant to catch
 *   a string  - resolve_ioc_geo returns { skipped: 'ip_geo_ranges is empty' }
 *   a number  - Ransomlook returns how many posts it had already stored, which on
 *               a normal hour is most of them. Truthiness alone marks a working
 *               feed as skipped and, through feed_health, as never having run.
 */
function skipReason(result) {
  if (result?.skipped === true) {
    return 'feed declined to run (missing API key, or nothing configured)'
  }
  if (typeof result?.skipped === 'string') return result.skipped
  return null
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}
