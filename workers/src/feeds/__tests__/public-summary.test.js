// @vitest-environment node
/**
 * The worker's public-summary job (175): builds the hub's daily line with the anonymous key and
 * stores it with the time it was built. It never reads with the service role, and a build with
 * nothing true to state leaves the stored row alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPublicSummary } from '../public-summary.js'
import { JOBS_BY_ID } from '../registry.js'

const NOW = new Date('2026-10-31T21:30:00Z')
const ENV = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
}

const reply = (body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

/** Hourly RansomLook runs from 26 Oct to NOW, and 20 claims on 30 Oct. */
function stubReads({ count = 20 } = {}) {
  const runs = []
  for (let t = Date.parse('2026-10-26T06:15:00Z'); t <= NOW.getTime(); t += 3600000)
    runs.push({ completed_at: new Date(t).toISOString() })
  const rows = Array.from({ length: count }, (_, i) => ({ actor_id: i < 11 ? 'qilin' : 'genesis' }))
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers || {} })
      const u = String(url)
      if (u.includes('/rest/v1/sync_log?')) return reply(runs)
      if (u.includes('/rest/v1/incidents_commercial?'))
        return reply(rows, { 'Content-Range': count ? `0-${count - 1}/${count}` : '*/0' })
      if (u.includes('/rest/v1/threat_actors_commercial?'))
        return reply([{ actor_id: 'qilin', name: 'Qilin' }])
      return new Response('{}', { status: 404 })
    })
  )
  return calls
}

function fakeDb({ error = null } = {}) {
  const upserts = []
  return {
    upserts,
    from: (table) => ({
      upsert: async (records, opts) => {
        upserts.push({ table, records, opts })
        return { data: null, error }
      },
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('public-summary job', () => {
  it('is scheduled hourly', () => {
    expect(JOBS_BY_ID['public-summary']).toMatchObject({ intervalMinutes: 60, priority: 2 })
  })

  it('stores the summary as the one latest row, stamped with when it was built', async () => {
    const calls = stubReads()
    const db = fakeDb()
    const result = await buildPublicSummary(db, ENV, NOW)
    expect(result).toEqual({ success: true, stored: true, day: '2026-10-30', claims: 20 })
    expect(db.upserts).toHaveLength(1)
    const [{ table, records, opts }] = db.upserts
    expect(table).toBe('public_summary')
    expect(opts).toEqual({ onConflict: 'id' })
    expect(records[0]).toMatchObject({
      id: 'latest',
      built_at: '2026-10-31T21:30:00Z',
      day: '2026-10-30',
    })
    expect(records[0].summary.brief).toMatch(
      /^Ransomware leak sites showed 20 new victim claims on 30 Oct 2026/
    )
    // Every read as the public makes it
    for (const c of calls) {
      expect(c.headers.apikey).toBe('anon-key')
      expect(JSON.stringify(c.headers)).not.toContain('service-key')
    }
  })

  it('leaves the stored row alone when there is nothing true to state', async () => {
    stubReads({ count: 0 })
    const db = fakeDb()
    const result = await buildPublicSummary(db, ENV, NOW)
    expect(result.success).toBe(true)
    expect(result.stored).toBe(false)
    expect(result.reason).toMatch(/nothing to state/)
    expect(db.upserts).toHaveLength(0)
  })

  it('fails, and says why, without the anonymous key; it never reads with the service role', async () => {
    const calls = stubReads()
    const db = fakeDb()
    const result = await buildPublicSummary(db, { ...ENV, SUPABASE_ANON_KEY: '' }, NOW)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/SUPABASE_ANON_KEY/)
    expect(calls).toHaveLength(0)
    expect(db.upserts).toHaveLength(0)
  })

  it('fails when a read or the write fails, so the run is logged as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubReads()
    const failed = await buildPublicSummary(
      fakeDb({ error: { message: 'permission denied' } }),
      ENV,
      NOW
    )
    expect(failed).toMatchObject({
      success: false,
      error: 'public_summary upsert: permission denied',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 }))
    )
    const db = fakeDb()
    const unread = await buildPublicSummary(db, ENV, NOW)
    expect(unread).toMatchObject({ success: false, error: 'sync_log: HTTP 503' })
    expect(db.upserts).toHaveLength(0)
  })
})
