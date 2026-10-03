/**
 * Censys ran out of budget on every tick from September: it selected every IOC
 * in the table and filtered client-side on a column it had not selected. These
 * pin the query it makes now, and that a refused key is an error rather than a
 * run of quiet per-IP failures.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { enrichCensys, CENSYS_BATCH } from '../censys.js'
import { JOBS, JOBS_BY_ID, SCHEDULED_JOBS } from '../registry.js'

vi.useFakeTimers({ toFake: ['setTimeout'] })

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeDb(rows) {
  const select = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  const updates = []
  const db = {
    from: () => ({
      select,
      update: (record) => ({
        eq: (column, value) => {
          updates.push({ record, column, value })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }
  return { db, select, updates }
}

async function run(db, env) {
  const promise = enrichCensys(db, env)
  await vi.runAllTimersAsync()
  return promise
}

const ENV = { CENSYS_API_KEY: 'key' }

describe('enrichCensys', () => {
  it('asks the database for the next few IPs, not the whole table', async () => {
    const { db, select } = fakeDb([])
    vi.stubGlobal('fetch', vi.fn())

    await run(db, ENV)

    expect(select).toHaveBeenCalledTimes(1)
    const [columns, query, options] = select.mock.calls[0]
    expect(columns).toBe('id,value,metadata')
    expect(query).toContain('type=eq.ip')
    expect(query).toContain('metadata->censys_enriched=is.null')
    expect(query).toContain('order=created_at.desc')
    expect(options).toEqual({ maxRows: CENSYS_BATCH })
  })

  it('records what it enriched as updates, so the run is not read as empty', async () => {
    const { db, updates } = fakeDb([{ id: 1, value: '192.0.2.1', metadata: {} }])
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {} }) }))
    )

    const result = await run(db, ENV)

    expect(result).toMatchObject({ success: true, enriched: 1, updated: 1, failed: 0 })
    expect(updates[0].record.metadata.censys_enriched).toBe(true)
  })

  it('fails the run when Censys refuses the key', async () => {
    const { db, updates } = fakeDb([
      { id: 1, value: '192.0.2.1', metadata: {} },
      { id: 2, value: '192.0.2.2', metadata: {} },
    ])
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(db, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(updates).toHaveLength(0)
  })
})

describe('registry', () => {
  it('declares a Censys cost that covers one select and an update per IP', () => {
    expect(JOBS_BY_ID.censys.cost).toBe(CENSYS_BATCH + 1)
  })

  it('keeps paused jobs off the schedule but runnable by hand', () => {
    expect(JOBS_BY_ID.vulncheck.paused).toBeTruthy()
    expect(SCHEDULED_JOBS.map((job) => job.id)).not.toContain('vulncheck')
    expect(SCHEDULED_JOBS).toHaveLength(JOBS.filter((job) => !job.paused).length)
  })
})
