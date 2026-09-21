/**
 * The job invokes the Edge Function that does the work.
 *
 * The parsing and attribution live in the Deno function; the attribution table
 * itself is tested directly in attribution.test.js, which is where the logic
 * that has actually been wrong lives.
 *
 * What is covered here is the failure mode that would be invisible: a feed
 * reporting success while ingesting nothing. NCSC differs from CISA in that an
 * empty result is legitimate - the feed is a rolling window of everything NCSC
 * publishes and a fortnight of blog posts would contain no news items at all -
 * so "parsed: 0, success: true" has to survive, and an HTTP failure still has
 * to surface.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestNcscAdvisories } from '../ncsc-advisories.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestNcscAdvisories', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestNcscAdvisories(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/ncsc-advisories')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the attribution and review counts through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'ncsc-uk',
              parsed: 6,
              advisories_new: 6,
              with_attribution: 3,
              queued_for_review: 1,
            }),
        })
      )
    )

    const result = await ingestNcscAdvisories(null, ENV)

    expect(result.parsed).toBe(6)
    expect(result.with_attribution).toBe(3)
    // The advisory NCSC did not attribute has to be visible as queued work,
    // not silently absent from the count.
    expect(result.queued_for_review).toBe(1)
  })

  it('accepts a window with no news items as a success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, source: 'ncsc-uk', parsed: 0 }),
        })
      )
    )

    const result = await ingestNcscAdvisories(null, ENV)

    // Unlike CISA's feed, this one legitimately empties. Treating that as a
    // failure would make the feed go red during a quiet fortnight.
    expect(result.success).toBe(true)
    expect(result.parsed).toBe(0)
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve('bad') }))
    )

    const result = await ingestNcscAdvisories(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('502')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestNcscAdvisories(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
