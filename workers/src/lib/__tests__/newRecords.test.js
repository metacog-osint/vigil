import { describe, it, expect, vi, afterEach } from 'vitest'

import { runJob, newRecordCount } from '../scheduler.js'
import {
  countInsertedRows,
  createSupabaseClient,
  createSubrequestBudget,
  INSERT_CLOCK_SLACK_MS,
} from '../supabase.js'
import { createInsertTally } from '../inserts.js'
import { JOBS_BY_ID } from '../../feeds/registry.js'

/**
 * records_added has to be a count of genuinely new records, because
 * feed_health.stalled (163, 167) reads it. Until 15 November 2026 every job but
 * ransomlook and ioc-geo logged 0 there whatever happened, which made the stall
 * check impossible to extend. These cases hold the three ways a count now
 * arrives, and the rule that a count nobody has is null, not 0.
 */

const SENT = Date.parse('2026-11-15T20:00:00.000Z')

describe('countInsertedRows', () => {
  it('counts the rows stamped with this statement’s transaction time', () => {
    const rows = [
      { created_at: '2026-11-15T20:00:00.412345+00:00' },
      { created_at: '2026-10-02T08:11:00.000001+00:00' }, // already there, updated
      { created_at: '2026-11-15T20:00:00.412345+00:00' },
    ]
    expect(countInsertedRows(rows, SENT)).toBe(2)
  })

  it('counts nothing when every row already existed', () => {
    // The newest is an hour old: an earlier run inserted it, this one did not.
    const rows = [
      { created_at: '2026-11-15T19:00:00.100000+00:00' },
      { created_at: '2026-11-15T19:00:00.100000+00:00' },
    ]
    expect(countInsertedRows(rows, SENT)).toBe(0)
  })

  it('allows for the database clock running a little behind the worker', () => {
    const behind = new Date(SENT - INSERT_CLOCK_SLACK_MS + 1000).toISOString()
    expect(countInsertedRows([{ created_at: behind }], SENT)).toBe(1)
  })

  it('returns null, not 0, when the response cannot say', () => {
    expect(countInsertedRows(null, SENT)).toBeNull()
    expect(countInsertedRows([{ id: 1 }], SENT)).toBeNull()
  })

  it('returns 0 for an empty response', () => {
    expect(countInsertedRows([], SENT)).toBe(0)
  })
})

describe('upsert with countInserted', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks for created_at back in the same request, and returns the count', async () => {
    const calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url, init })
        const now = new Date().toISOString()
        return new Response(
          JSON.stringify([{ created_at: now }, { created_at: '2026-01-01T00:00:00Z' }])
        )
      })
    )
    const budget = createSubrequestBudget({ limit: 50, reserve: 0 })
    const db = createSupabaseClient(
      { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: 'k' },
      { budget }
    )

    const { error, inserted } = await db
      .from('iocs')
      .upsert([{ value: 'a' }, { value: 'b' }], { onConflict: 'type,value', countInserted: true })

    expect(error).toBeNull()
    expect(inserted).toBe(1)
    expect(budget.used).toBe(1)
    expect(calls[0].url).toContain('on_conflict=type%2Cvalue&select=created_at')
    expect(calls[0].init.headers.Prefer).toBe('resolution=merge-duplicates,return=representation')
  })

  it('leaves the plain upsert as it was', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const db = createSupabaseClient({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: 'k' })

    const result = await db.from('iocs').upsert([{ value: 'a' }], { onConflict: 'type,value' })

    expect(result).toEqual({ data: null, error: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain('select=')
    expect(init.headers.Prefer).toBe('resolution=merge-duplicates,return=minimal')
  })
})

describe('createInsertTally', () => {
  it('adds up the batches and returns each one for the updated count', () => {
    const t = createInsertTally()
    expect(t.record(3)).toBe(3)
    expect(t.record(0)).toBe(0)
    expect(t.added).toBe(3)
  })

  it('is null once any batch could not say', () => {
    const t = createInsertTally()
    t.record(3)
    expect(t.record(null)).toBe(0)
    expect(t.added).toBeNull()
  })
})

describe('newRecordCount', () => {
  it('reads `added` from the worker feeds', () => {
    expect(newRecordCount({}, { added: 4, updated: 96 })).toBe(4)
    expect(newRecordCount({}, { added: 0, updated: 100 })).toBe(0)
  })

  it('is null for a job that does not know, not 0', () => {
    expect(newRecordCount({}, { updated: 100 })).toBeNull()
    expect(newRecordCount({}, { success: false, error: 'HTTP 500' })).toBeNull()
    expect(newRecordCount({}, undefined)).toBeNull()
  })

  it('uses the job’s own reader when it has one', () => {
    const job = { countNew: (r) => r.advisories_new }
    expect(newRecordCount(job, { advisories_new: 2, parsed: 10 })).toBe(2)
    expect(newRecordCount(job, { parsed: 10 })).toBeNull()
  })
})

describe('the registry’s readers, against results as the jobs logged them', () => {
  // Shapes copied from sync_log.metadata.result, 15 November 2026.
  const count = (id, result) => newRecordCount(JOBS_BY_ID[id], result)

  it('cisa-advisories and ncsc-advisories', () => {
    expect(count('cisa-advisories', { parsed: 10, advisories_new: 0, queued_for_review: 0 })).toBe(
      0
    )
    expect(count('ncsc-advisories', { parsed: 9, advisories_new: 2 })).toBe(2)
  })

  it('sec-edgar and fincen-advisories', () => {
    expect(count('sec-edgar', { fetched: 105, item_105: 85, filings_new: 0 })).toBe(0)
    expect(count('fincen-advisories', { new: 1, held: 187, parsed: 15 })).toBe(1)
  })

  it('ofac-sdn, including a run that finds the list unchanged', () => {
    expect(count('ofac-sdn', { addresses: 1064, unchanged: true })).toBe(0)
    expect(count('ofac-sdn', { addresses: 1066, new: 2, refreshed: 1064 })).toBe(2)
  })

  it('vendor-research sums the blogs, and state-breach-notices the states', () => {
    expect(
      count('vendor-research', {
        feeds: { eset: { reports_new: 1 }, talos: { reports_new: 0 }, unit42: { reports_new: 2 } },
        failures: [],
      })
    ).toBe(3)
    expect(
      count('state-breach-notices', {
        states: { 'ca-ag': { new: 4 }, 'wa-ag': { new: 0 }, 'or-ag': { error: 'timeout' } },
      })
    ).toBe(4)
    expect(count('state-breach-notices', { states: {} })).toBeNull()
  })

  it('leaves enrichment and checks without a count', () => {
    // threatcluster's `filled` fills fields on existing rows; data-quality adds nothing.
    expect(count('threatcluster', { filled: 18, updated: 18 })).toBeNull()
    expect(count('data-quality', { success: true, links: 3 })).toBeNull()
  })
})

describe('runJob and the count', () => {
  const context = () => {
    const rows = []
    return {
      rows,
      feedDb: {},
      logDb: {
        insert: async (row) => {
          rows.push(row)
          return { error: null }
        },
      },
      env: {},
      budget: createSubrequestBudget({ limit: 50, reserve: 18 }),
      trigger: 'test',
    }
  }
  const job = (overrides) => ({ id: 'f', priority: 3, cost: 1, intervalMinutes: 60, ...overrides })

  it('logs a known count and marks the row as counted', async () => {
    const ctx = context()
    await runJob(job({ run: async () => ({ success: true, added: 0, updated: 250 }) }), ctx)
    expect(ctx.rows[0].records_added).toBe(0)
    expect(ctx.rows[0].records_processed).toBe(250)
    expect(ctx.rows[0].metadata.new_counted).toBe(true)
  })

  it('logs null and no mark when the job cannot say', async () => {
    const ctx = context()
    await runJob(job({ run: async () => ({ success: true, updated: 250 }) }), ctx)
    expect(ctx.rows[0].records_added).toBeNull()
    expect(ctx.rows[0].records_processed).toBe(250)
    expect(ctx.rows[0].metadata).not.toHaveProperty('new_counted')
  })

  it('uses countNew', async () => {
    const ctx = context()
    await runJob(
      job({ countNew: (r) => r.filings_new, run: async () => ({ success: true, filings_new: 3 }) }),
      ctx
    )
    expect(ctx.rows[0].records_added).toBe(3)
    expect(ctx.rows[0].metadata.new_counted).toBe(true)
  })

  it('still calls a run that wrote nothing an error when the count is unknown', async () => {
    const ctx = context()
    await runJob(job({ run: async () => ({ success: true, updated: 0, failed: 40 }) }), ctx)
    expect(ctx.rows[0].status).toBe('error')
  })
})
