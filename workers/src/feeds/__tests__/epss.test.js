/**
 * The EPSS job no longer fetches FIRST; it invokes the Edge Function that can.
 * These cover the part that would fail silently. The job it replaces reported
 * success every day while refreshing the same 40 CVEs, so a job that cannot
 * reach the function must say so.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestEPSS } from '../epss.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestEPSS', () => {
  it('calls the epss-scores function with the service key, once', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, updated: 6100 }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestEPSS(null, ENV)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/epss-scores')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the function’s own account of the run through', async () => {
    const account = {
      success: true,
      source: 'epss',
      scored: 17890,
      updated: 6100,
      date: '2026-10-26',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(account) }))
    )
    expect(await ingestEPSS(null, ENV)).toEqual(account)
  })

  it('reports an HTTP failure as an error, not as a run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 546, text: () => Promise.resolve('timeout') })
      )
    )
    const result = await ingestEPSS(null, ENV)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/HTTP 546/)
  })

  it('reports missing configuration as an error', async () => {
    const result = await ingestEPSS(null, {})
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/SUPABASE_URL/)
  })
})
