/**
 * The job invokes the Edge Function that does the work. What must not fail
 * quietly: a corroboration feed reporting success while ingesting nothing
 * would let Vigil imply it checks regulatory filings when it does not.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestSecDisclosures } from '../sec-disclosures.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestSecDisclosures', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestSecDisclosures(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/sec-cyber-disclosures')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the count of queued candidates through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'sec-edgar',
              fetched: 101,
              item_105: 83,
              filings_new: 83,
              candidates_queued: 17,
            }),
        })
      )
    )

    const result = await ingestSecDisclosures(null, ENV)

    // Queued, not applied: whether a filing corroborates a claim is a verdict.
    expect(result.candidates_queued).toBe(17)
    expect(result.filings_new).toBe(83)
  })

  it('reports an error when EDGAR or the function fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('down') }))
    )

    const result = await ingestSecDisclosures(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('503')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestSecDisclosures(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
