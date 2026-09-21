/**
 * The job invokes the Edge Function that does the work. These cover what would
 * fail quietly: a job that cannot reach the function must say so, because a
 * feed reporting success while filling nothing is how victim country came to
 * be four months stale without anyone noticing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestThreatCluster } from '../threatcluster.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestThreatCluster', () => {
  it('asks the function for the daily window, not a year', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestThreatCluster(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/threatcluster-victims')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    // A backfill re-reads a year and is a deliberate act, not a daily cron.
    expect(JSON.parse(init.body)).toEqual({ window: '90d' })
  })

  it('passes the function\'s account of the run straight through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'threatcluster',
              parsed: 2634,
              filled: 2504,
              disagreements_queued: 9,
            }),
        })
      )
    )

    const result = await ingestThreatCluster(null, ENV)

    expect(result.filled).toBe(2504)
    expect(result.disagreements_queued).toBe(9)
  })

  it('reports an error when the function refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') }))
    )

    const result = await ingestThreatCluster(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
  })

  it('reports an error when the function cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    const result = await ingestThreatCluster(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('network down')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestThreatCluster(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
