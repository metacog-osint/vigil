import { describe, it, expect, vi } from 'vitest'

import { selectDueJobs, runJob, runDueJobs } from '../scheduler.js'
import { createSubrequestBudget, SubrequestBudgetError } from '../supabase.js'

/**
 * These cases are the failure that prompted the rewrite, written down so it
 * cannot come back quietly:
 *
 *  - a run that exhausts its subrequests must still record what it did
 *  - a feed that skips itself must not be recorded as a successful run
 *  - one feed failing must not take the rest of the invocation with it
 */

function fakeLog() {
  const rows = []
  return {
    rows,
    insert: vi.fn(async row => {
      rows.push(row)
      return { data: null, error: null }
    })
  }
}

function job(overrides = {}) {
  return {
    id: 'test-feed',
    priority: 3,
    cost: 10,
    intervalMinutes: 60,
    run: async () => ({ success: true, added: 1 }),
    ...overrides
  }
}

describe('selectDueJobs', () => {
  it('leaves out a job that ran inside its own interval', () => {
    const jobs = [job({ id: 'fresh', intervalMinutes: 60 })]
    const health = { fresh: { minutes_since_success: 30 } }

    expect(selectDueJobs(jobs, health)).toEqual([])
  })

  it('includes a job that has reached its interval', () => {
    const jobs = [job({ id: 'due', intervalMinutes: 60 })]
    const health = { due: { minutes_since_success: 61 } }

    expect(selectDueJobs(jobs, health).map(j => j.id)).toEqual(['due'])
  })

  it('treats a job with no successful run on record as due', () => {
    const jobs = [job({ id: 'never-ran' })]

    expect(selectDueJobs(jobs, {}).map(j => j.id)).toEqual(['never-ran'])
  })

  it('offers priority 1 a slot before anything more overdue at a lower priority', () => {
    const jobs = [
      job({ id: 'reference', priority: 4, intervalMinutes: 1440 }),
      job({ id: 'leak-sites', priority: 1, intervalMinutes: 60 })
    ]
    const health = {
      reference: { minutes_since_success: 40000 }, // wildly overdue
      'leak-sites': { minutes_since_success: 61 }  // only just due
    }

    expect(selectDueJobs(jobs, health).map(j => j.id))
      .toEqual(['leak-sites', 'reference'])
  })

  it('takes the most starved first within a priority', () => {
    const jobs = [
      job({ id: 'a', priority: 3, intervalMinutes: 60 }),
      job({ id: 'b', priority: 3, intervalMinutes: 60 })
    ]
    const health = {
      a: { minutes_since_success: 90 },
      b: { minutes_since_success: 600 }
    }

    expect(selectDueJobs(jobs, health).map(j => j.id)).toEqual(['b', 'a'])
  })
})

describe('runJob', () => {
  const context = () => ({
    feedDb: {},
    logDb: fakeLog(),
    env: {},
    budget: createSubrequestBudget({ limit: 50, reserve: 18 }),
    trigger: 'test'
  })

  it('records a successful run under the job id, not the worker name', async () => {
    const ctx = context()
    await runJob(job({ run: async () => ({ success: true, added: 3, updated: 2 }) }), ctx)

    expect(ctx.logDb.rows).toHaveLength(1)
    expect(ctx.logDb.rows[0]).toMatchObject({
      source: 'test-feed',
      status: 'success',
      records_added: 3,
      records_updated: 2,
      records_processed: 5
    })
  })

  it('records a feed that skipped itself as skipped, not success', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: true, source: 'urlhaus', skipped: true }) }),
      ctx
    )

    expect(result.status).toBe('skipped')
    expect(ctx.logDb.rows[0].status).toBe('skipped')
    expect(ctx.logDb.rows[0].error_message).toMatch(/declined to run/i)
  })

  it('does not mistake a count of skipped records for a skipped feed', async () => {
    // Ransomlook returns how many posts it had already stored. On a normal hour
    // that is most of them, and reading it as truthy marked a working feed as
    // never having run.
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: true, source: 'ransomlook', added: 2, skipped: 48 }) }),
      ctx
    )

    expect(result.status).toBe('success')
    expect(ctx.logDb.rows[0].records_added).toBe(2)
  })

  it('treats a string reason as a skip', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: true, skipped: 'ip_geo_ranges is empty' }) }),
      ctx
    )

    expect(result.status).toBe('skipped')
    expect(ctx.logDb.rows[0].error_message).toBe('ip_geo_ranges is empty')
  })

  it('does not call a run successful when it wrote none of what it fetched', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: true, source: 'threatfox', updated: 0, failed: 1296 }) }),
      ctx
    )

    expect(result.status).toBe('error')
    expect(ctx.logDb.rows[0].error_message).toMatch(/wrote none of them/)
    expect(ctx.logDb.rows[0].records_failed).toBe(1296)
  })

  it('keeps a partly successful run successful', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: true, updated: 100, failed: 3 }) }),
      ctx
    )

    expect(result.status).toBe('success')
    expect(ctx.logDb.rows[0].records_failed).toBe(3)
  })

  it('counts a feed that checked and found nothing new as a successful run', async () => {
    // OFAC HEADs the list and returns without downloading when Last-Modified has
    // not moved. Having checked is exactly what the feed asserts, so this must not
    // be read as a skip - ofac-sdn is critical, and a skip would make feed_health
    // call it stale and ingestion_is_healthy() answer false.
    const ctx = context()
    const result = await runJob(
      job({
        run: async () => ({
          success: true,
          source: 'ofac-sdn',
          unchanged: true,
          last_modified: 'Fri, 18 Sep 2026 14:01:54 GMT',
          addresses: 1043,
        }),
      }),
      ctx
    )

    expect(result.status).toBe('success')
    expect(ctx.logDb.rows[0].status).toBe('success')
  })

  it('records a reported failure as an error', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => ({ success: false, error: 'HTTP 401' }) }),
      ctx
    )

    expect(result.status).toBe('error')
    expect(ctx.logDb.rows[0].error_message).toBe('HTTP 401')
  })

  it('does not throw when a feed throws, and still writes a row', async () => {
    const ctx = context()
    const result = await runJob(
      job({ run: async () => { throw new Error('socket hang up') } }),
      ctx
    )

    expect(result.status).toBe('error')
    expect(ctx.logDb.rows[0]).toMatchObject({
      source: 'test-feed',
      status: 'error',
      error_message: 'socket hang up'
    })
  })

  it('separates running out of subrequests from the feed being broken', async () => {
    const ctx = context()
    const result = await runJob(
      job({
        run: async () => {
          throw new SubrequestBudgetError('subrequest budget exhausted (32/32)')
        }
      }),
      ctx
    )

    expect(result.status).toBe('budget_exhausted')
    expect(ctx.logDb.rows[0].status).toBe('budget_exhausted')
  })
})

describe('runDueJobs', () => {
  const healthDb = health => ({
    select: async () => ({ data: health, error: null })
  })

  it('records every job it runs, one row each', async () => {
    const logDb = fakeLog()
    const summary = await runDueJobs({
      jobs: [
        job({ id: 'one', cost: 2 }),
        job({ id: 'two', cost: 2 })
      ],
      feedDb: {},
      logDb,
      healthDb: healthDb([]),
      env: {},
      budget: createSubrequestBudget({ limit: 50, reserve: 18 }),
      trigger: 'test'
    })

    expect(summary.ran.map(r => r.id)).toEqual(['one', 'two'])
    expect(logDb.rows.map(r => r.source)).toEqual(['one', 'two'])
  })

  it('defers what will not fit and still runs what will', async () => {
    // A budget with almost nothing left: the expensive job is passed over, the
    // cheap one behind it still runs. This is the case the old code got wrong -
    // it ran everything in order until the platform killed the invocation.
    const budget = createSubrequestBudget({ limit: 24, reserve: 18 }) // ceiling 6
    const logDb = fakeLog()

    const summary = await runDueJobs({
      jobs: [
        job({ id: 'expensive', priority: 1, cost: 30 }),
        job({ id: 'cheap', priority: 2, cost: 2 })
      ],
      feedDb: {},
      logDb,
      healthDb: healthDb([]),
      env: {},
      budget,
      trigger: 'test'
    })

    expect(summary.deferred).toEqual(['expensive'])
    expect(summary.ran.map(r => r.id)).toEqual(['cheap'])
  })

  it('will not start a job that only partly fits', async () => {
    // The case NVD hit every run: admitted with a third of what it needed, it spent
    // the rest of the invocation and wrote nothing for it. A job either has room to
    // finish or waits for a trigger that has room.
    const budget = createSubrequestBudget({ limit: 30, reserve: 18 }) // ceiling 12
    const logDb = fakeLog()

    const summary = await runDueJobs({
      jobs: [job({ id: 'needs-20', cost: 20 })],
      feedDb: {},
      logDb,
      healthDb: healthDb([]),
      env: {},
      budget,
      trigger: 'test'
    })

    expect(summary.ran).toEqual([])
    expect(summary.deferred).toEqual(['needs-20'])
    expect(logDb.rows).toEqual([])
  })

  it('runs a job whose full cost is exactly what remains', async () => {
    const budget = createSubrequestBudget({ limit: 30, reserve: 18 }) // ceiling 12
    const logDb = fakeLog()

    const summary = await runDueJobs({
      jobs: [job({ id: 'needs-12', cost: 12 })],
      feedDb: {},
      logDb,
      healthDb: healthDb([]),
      env: {},
      budget,
      trigger: 'test'
    })

    expect(summary.ran.map(r => r.id)).toEqual(['needs-12'])
  })

  it('still runs when feed_health cannot be read, rather than running nothing', async () => {
    const logDb = fakeLog()
    const summary = await runDueJobs({
      jobs: [job({ id: 'one', cost: 2 })],
      feedDb: {},
      logDb,
      healthDb: { select: async () => ({ data: null, error: { message: 'boom' } }) },
      env: {},
      budget: createSubrequestBudget({ limit: 50, reserve: 18 }),
      trigger: 'test'
    })

    expect(summary.ran.map(r => r.id)).toEqual(['one'])
  })
})

describe('createSubrequestBudget', () => {
  it('refuses its own calls before the platform refuses the invocation', () => {
    const budget = createSubrequestBudget({ limit: 10, reserve: 4 }) // ceiling 6

    for (let i = 0; i < 6; i++) budget.spend()

    expect(budget.remaining).toBe(0)
    expect(() => budget.spend()).toThrow(SubrequestBudgetError)
  })
})
