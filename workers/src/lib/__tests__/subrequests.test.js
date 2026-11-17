import { describe, it, expect, vi, afterEach } from 'vitest'

import { installFetchMeter, withSubrequestBudget } from '../subrequests.js'
import { createSubrequestBudget, SubrequestBudgetError } from '../supabase.js'
import { runDueJobs } from '../scheduler.js'

/**
 * 17 Nov 2026, 03:15 UTC: a tick of 14 due jobs was cut off by Workers Free's
 * 50-subrequest cap during pulsedive, with nothing recorded. The budget had
 * counted only the Supabase client's calls; the feeds' own fetch() calls, their
 * Edge Function calls and a sync_log row per job sat in a fixed reserve of 18
 * that did not grow with the number of jobs. These cases hold the fix: every
 * call is counted, a feed is refused before the platform would refuse it, and
 * the bookkeeping after it is never refused.
 */

let uninstall = () => {}

function stubFetch() {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      calls.push(String(url))
      return new Response('[]')
    })
  )
  uninstall = installFetchMeter()
  return calls
}

afterEach(() => {
  uninstall()
  vi.unstubAllGlobals()
})

describe('installFetchMeter', () => {
  it('counts a feed’s own fetch(), which the old budget could not see', async () => {
    stubFetch()
    const budget = createSubrequestBudget({ limit: 50, reserve: 5 })

    await withSubrequestBudget(budget, async () => {
      await fetch('https://source.example/feed.csv')
      await fetch('https://x.supabase.co/functions/v1/some-feed')
    })

    expect(budget.used).toBe(2)
  })

  it('does not count calls made outside a budget', async () => {
    const calls = stubFetch()
    const budget = createSubrequestBudget({ limit: 50, reserve: 5 })

    await fetch('https://elsewhere.example/')

    expect(calls).toHaveLength(1)
    expect(budget.used).toBe(0)
  })

  it('refuses a feed’s call at the ceiling, before it reaches the network', async () => {
    const calls = stubFetch()
    const budget = createSubrequestBudget({ limit: 7, reserve: 5 }) // ceiling 2

    const run = withSubrequestBudget(budget, async () => {
      for (let i = 0; i < 5; i++) await fetch(`https://source.example/${i}`)
    })

    await expect(run).rejects.toBeInstanceOf(SubrequestBudgetError)
    expect(calls).toHaveLength(2)
  })

  it('counts bookkeeping past the ceiling but never refuses it', async () => {
    const calls = stubFetch()
    const budget = createSubrequestBudget({ limit: 7, reserve: 5 }) // ceiling 2

    await withSubrequestBudget(
      budget,
      async () => {
        for (let i = 0; i < 4; i++) await fetch('https://x.supabase.co/rest/v1/sync_log')
      },
      { enforce: false }
    )

    expect(calls).toHaveLength(4)
    expect(budget.used).toBe(4)
  })

  it('keeps two invocations’ counts apart when they share an isolate', async () => {
    stubFetch()
    const a = createSubrequestBudget({ limit: 50, reserve: 5 })
    const b = createSubrequestBudget({ limit: 50, reserve: 5 })

    await Promise.all([
      withSubrequestBudget(a, async () => {
        await fetch('https://one.example/')
        await fetch('https://one.example/')
      }),
      withSubrequestBudget(b, async () => {
        await fetch('https://two.example/')
      }),
    ])

    expect(a.used).toBe(2)
    expect(b.used).toBe(1)
  })

  it('wraps fetch once however many times it is installed', async () => {
    stubFetch()
    const again = installFetchMeter()
    const budget = createSubrequestBudget({ limit: 50, reserve: 5 })

    await withSubrequestBudget(budget, () => fetch('https://source.example/'))

    expect(budget.used).toBe(1)
    again()
  })
})

describe('a busy tick under the 50-subrequest cap', () => {
  it('defers what does not fit and records every job it started, inside 50 calls', async () => {
    const calls = stubFetch()
    const budget = createSubrequestBudget({ limit: 50, reserve: 5 })

    // Writes through fetch, as the real client does, so the rows are counted.
    const rows = []
    const logDb = {
      insert: async (row) => {
        await fetch('https://x.supabase.co/rest/v1/sync_log')
        rows.push(row)
        return { data: null, error: null }
      },
    }
    const healthDb = {
      select: async () => {
        await fetch('https://x.supabase.co/rest/v1/feed_health')
        return { data: [], error: null }
      },
    }

    // Fourteen jobs, as at 03:15. Each declares 2 and actually makes 3 calls:
    // its source download, an Edge Function call, and one write.
    const jobs = Array.from({ length: 14 }, (_, i) => ({
      id: `feed-${String(i).padStart(2, '0')}`,
      priority: 3,
      cost: 2,
      intervalMinutes: 60,
      run: async () => {
        await fetch('https://source.example/data')
        await fetch('https://x.supabase.co/functions/v1/feed')
        await fetch('https://x.supabase.co/rest/v1/iocs')
        return { success: true, added: 1 }
      },
    }))

    const summary = await runDueJobs({
      jobs,
      feedDb: {},
      logDb,
      healthDb,
      env: {},
      budget,
      trigger: 'test',
    })

    // Never past the platform's cap, so nothing is refused that should be written.
    expect(calls.length).toBeLessThanOrEqual(50)
    // Every job that started has its row, the one cut short included.
    expect(rows.map((r) => r.source)).toEqual(summary.ran.map((r) => r.id))
    expect(summary.ran.length).toBeGreaterThan(0)
    expect(summary.deferred.length).toBeGreaterThan(0)
    expect(summary.ran.length + summary.deferred.length).toBe(14)
    // Room is left for the summary row and its error fallback.
    expect(50 - calls.length).toBeGreaterThanOrEqual(2)
  })
})
