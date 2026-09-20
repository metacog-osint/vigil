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
 * Cloudflare gives a Cron Trigger 15 minutes of wall clock. Unlike the subrequest
 * cap there is no error to catch: the invocation is simply cut off, which takes the
 * summary row with it.
 */
const CRON_WALL_CLOCK_MS = 15 * 60 * 1000

/**
 * Held back so the job that is running when the clock runs low can finish and be
 * recorded. Five minutes because the slowest run observed - ransomware.live, on a
 * loaded database - took 239 seconds, and a feed that starts at minute 14 of 15
 * finishes into a closed door.
 */
const TIME_RESERVE_MS = 5 * 60 * 1000

/**
 * The clock, in the same shape as the subrequest budget and for the same reason:
 * stop before the platform stops you, so there is room left to say what happened.
 *
 * It governs admission only. A job already running cannot be interrupted, which is
 * what the reserve is for.
 *
 * `now` is injectable so this can be tested without waiting a quarter of an hour.
 */
export function createTimeBudget({
  limitMs = CRON_WALL_CLOCK_MS,
  reserveMs = TIME_RESERVE_MS,
  now = Date.now,
} = {}) {
  const startedAt = now()
  const ceiling = limitMs - reserveMs

  return {
    get elapsedMs() { return now() - startedAt },
    get remainingMs() { return Math.max(0, ceiling - (now() - startedAt)) },
    get expired() { return now() - startedAt >= ceiling },
  }
}

/**
 * A job is started only when its whole declared cost is still available.
 *
 * This began as half the cost, on the reasoning that a job given most of what it
 * needs would mostly finish. It does not work that way. A feed that runs out
 * part-way has still spent everything it used getting there, and it writes nothing
 * for it - the budget is gone and the work is not done. NVD did this on every run:
 * admitted with a third of what it needed, it burned the rest of the invocation and
 * was recorded as budget_exhausted, which is also why the feeds below it in the
 * queue never got a slot.
 *
 * Nothing is starved by this. The admission loop skips a job it cannot afford and
 * keeps looking, so a cheap job still runs behind an expensive one that was passed
 * over, and the expensive one is picked up by a trigger with more room - the
 * 6-hourly and daily ticks, where the hourly feeds are not due.
 */
const REQUIRE_FULL_COST = 1

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
export async function runDueJobs({ jobs, feedDb, logDb, healthDb, env, budget, clock, trigger }) {
  const health = await readFeedHealth(healthDb)
  const due = selectDueJobs(jobs, health)

  const ran = []
  const deferred = []
  let stoppedEarly = null

  for (const job of due) {
    // Out of time stops everything: unlike the subrequest budget, waiting does not
    // free any up, so there is no cheaper job further down that could still fit.
    if (clock?.expired) {
      stoppedEarly = 'time'
      deferred.push(job.id)
      continue
    }

    // `continue`, not `break`: a cheap job further down the list can still run
    // after an expensive one has been passed over.
    if (budget.remaining < job.cost * REQUIRE_FULL_COST) {
      deferred.push(job.id)
      continue
    }

    ran.push(await runJob(job, { feedDb, logDb, env, budget, trigger }))
  }

  return {
    ran,
    deferred,
    stoppedEarly,
    subrequestsUsed: budget.used,
    elapsedMs: clock?.elapsedMs ?? null,
  }
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
