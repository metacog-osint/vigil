/**
 * The job invokes the Edge Function that does the work.
 *
 * The attribution logic itself lives in the Deno function and was verified
 * against all ten advisories the live feeds return - including the two that
 * matter most, "Pro-Russia Hacktivists" reading as `aligned` rather than
 * `state`, and "China-Nexus" as `nexus`. That check is recorded in the
 * function's header. A Deno test would be better than a comment, and is worth
 * adding when this repo grows a Deno test runner.
 *
 * What is covered here is what would fail silently: a critical feed reporting
 * success while ingesting nothing would put the map back to showing one
 * Iranian event with no indication anything was wrong.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestCisaAdvisories } from '../cisa-advisories.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestCisaAdvisories', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestCisaAdvisories(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/cisa-advisories')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the attribution counts through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'cisa',
              parsed: 10,
              advisories_new: 10,
              with_attribution: 5,
            }),
        })
      )
    )

    const result = await ingestCisaAdvisories(null, ENV)

    expect(result.parsed).toBe(10)
    expect(result.with_attribution).toBe(5)
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve('bad') }))
    )

    const result = await ingestCisaAdvisories(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('502')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestCisaAdvisories(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
