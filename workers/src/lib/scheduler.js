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
import { withSubrequestBudget } from './subrequests.js'

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
 * over, and the expensive one is picked up by a tick with more room - the
 * ticks between the hourly feeds' runs, where those feeds are not due.
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
 * How early a job counts as due, in minutes. Half the gap between ticks
 * (wrangler.toml: "15,45 * * * *", so 30 minutes apart).
 *
 * Without it every job slipped a tick each time it ran. A job's clock starts when
 * its last run finished, which is some seconds or minutes into a tick, while the
 * check reads the clock at the very start of a tick. A 6-hour feed that finished
 * at 08:16:08 read 359 minutes at the 14:15:36 tick, so it waited for 14:45. In
 * the four days to 16 Nov 2026 pulsedive and urlhaus often ran 6.5 hours apart
 * and nvd 6 to 8, so a 6-hour feed ran fewer than four times a day.
 *
 * Half the tick gap is the most it can be: any more and an hourly job would also
 * be due at the tick 30 minutes after it ran. capacity.test.js holds that.
 */
export const DUE_SLACK_MINUTES = 15

/**
 * The latest moment at or before `now` when the UTC clock read `hhmm` ("15:00").
 */
export function lastUtcAnchor(hhmm, now) {
  const [h, m] = hhmm.split(':').map(Number)
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m))
  if (anchor > now) anchor.setUTCDate(anchor.getUTCDate() - 1)
  return anchor
}

/**
 * Due jobs, most starved first. A job that has never run successfully sorts ahead
 * of everything else at its priority, so a newly added or long-broken feed gets a
 * slot instead of waiting behind healthy ones.
 *
 * A job with `afterUtc` ("HH:MM") runs once a day, at the first tick after that
 * UTC time: it is due while its last success is older than the latest such time.
 * For a source that publishes at a fixed hour, so the day's run reads that day's
 * release rather than the previous one (epss, ideas#362).
 */
export function selectDueJobs(jobs, health, now = new Date()) {
  const due = []

  for (const job of jobs) {
    const row = health[job.id]
    const minutesSince = row?.minutes_since_success

    // Never run, or no successful run on record: always due.
    const overdueRatio = minutesSince == null
      ? Number.POSITIVE_INFINITY
      : minutesSince / job.intervalMinutes

    if (job.afterUtc) {
      const anchor = lastUtcAnchor(job.afterUtc, now).getTime()
      const lastSuccess = minutesSince == null ? null : now.getTime() - minutesSince * 60000
      if (lastSuccess == null || lastSuccess < anchor) due.push({ job, overdueRatio })
      continue
    }

    if (minutesSince == null || minutesSince >= job.intervalMinutes - DUE_SLACK_MINUTES) {
      due.push({ job, overdueRatio })
    }
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
    // The feed's own calls are refused at the budget's ceiling; the sync_log
    // write below runs in the caller's scope, where it is counted but not refused.
    result = await withSubrequestBudget(budget, () => job.run(feedDb, env), { enforce: true })
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
  const added = newRecordCount(job, result)
  const updated = numberOr(result?.updated, 0)
  const failed = numberOr(result?.failed, 0)

  // A feed that fetched its data, failed to write any of it, and returned
  // `success: true` is the same silence in a different place. ThreatFox did
  // exactly this on the first live run of the new scheduler: 1,296 records
  // failed, nothing written, reported as a successful run.
  if (status === 'success' && failed > 0 && (added ?? 0) + updated === 0) {
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
    records_processed: (added ?? 0) + updated + failed,
    error_message: errorMessage,
    metadata: {
      // Present only when records_added is a real count of new records.
      // feed_health (migration 167) starts a feed's stall clock at the first
      // run that carries it, so history written before the count existed,
      // when records_added was 0 whatever happened, cannot read as a stall.
      ...(added === null ? {} : { new_counted: true }),
      trigger,
      duration_ms: completedAt - startedAt,
      // Every subrequest of the invocation so far, the feeds' own fetch() calls
      // and the run's bookkeeping included (17 Nov 2026; before that, only the
      // Supabase client's calls).
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
 *
 * Its own reads and writes are counted against the budget but never refused;
 * each feed's calls are refused at the ceiling (runJob).
 */
export function runDueJobs(options) {
  return withSubrequestBudget(options.budget, () => runDueJobsCounted(options), { enforce: false })
}

async function runDueJobsCounted({ jobs, feedDb, logDb, healthDb, env, budget, clock, trigger }) {
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

/**
 * How many genuinely new records the run brought, or null when the job cannot
 * say. Null is written to sync_log as null: 0 would claim the run brought
 * nothing, and for most feeds that was never known. Until 15 November 2026
 * every job but ransomlook and ioc-geo logged 0 here because the scheduler
 * read only `added`, which almost nothing returned.
 *
 *   job.countNew(result)  for jobs whose count has another name: the Edge
 *                         Function feeds return `new`, `advisories_new`,
 *                         `filings_new`, or one count per source
 *   result.added          the worker feeds' own count of inserted rows
 *                         (ransomlook; the upsert feeds via createInsertTally)
 *
 * A failed run reports nothing new, but that is a fact, not a guess, only if
 * the job said so; so failure does not turn null into 0.
 */
export function newRecordCount(job, result) {
  const n = typeof job?.countNew === 'function' ? job.countNew(result ?? {}) : result?.added
  return Number.isFinite(n) && n >= 0 ? n : null
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}
