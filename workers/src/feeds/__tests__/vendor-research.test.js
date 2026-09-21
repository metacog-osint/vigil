/**
 * The job invokes the Edge Function that reads eight vendor blogs.
 *
 * The behaviour worth protecting here is what this feed refuses to do. It
 * never writes an attribution, because across 279 titles from these same eight
 * feeds not one carried an attribution a parser could read - and every title
 * that named a nationality named a victim or a language. A future change that
 * started inferring a country from a title would undo the whole point, so the
 * shape of the result is asserted rather than just its success.
 *
 * The other thing covered is partial failure. Eight feeds in one invocation
 * means one vendor being down must not cost the other seven.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestVendorResearch } from '../vendor-research.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestVendorResearch', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestVendorResearch(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/vendor-research')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('reports reports stored, links proposed and questions queued - and no attribution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'vendor-research',
              feeds: {
                acronis: {
                  parsed: 20,
                  reports_new: 20,
                  actor_links_proposed: 2,
                  attribution_candidates_queued: 1,
                },
                greynoise: {
                  parsed: 100,
                  reports_new: 100,
                  actor_links_proposed: 5,
                  attribution_candidates_queued: 4,
                },
              },
              failures: [],
            }),
        })
      )
    )

    const result = await ingestVendorResearch(null, ENV)

    expect(result.feeds.acronis.actor_links_proposed).toBe(2)
    expect(result.feeds.greynoise.attribution_candidates_queued).toBe(4)

    // Nothing in the result may claim an attribution was applied. Links are
    // "proposed" and attributions are "queued", and those words are the
    // contract - a key like `attributed` or `countries_applied` appearing here
    // would mean the feed had started deciding.
    for (const feed of Object.values(result.feeds)) {
      expect(Object.keys(feed)).not.toContain('attributed')
      expect(Object.keys(feed)).not.toContain('countries_applied')
    }
  })

  it('keeps going when one vendor is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              feeds: {
                greynoise: { parsed: 100, reports_new: 100 },
                talos: { error: 'HTTP 503' },
              },
              failures: ['talos: HTTP 503'],
            }),
        })
      )
    )

    const result = await ingestVendorResearch(null, ENV)

    // Seven feeds' worth of research is not thrown away because the eighth
    // returned a 503.
    expect(result.success).toBe(true)
    expect(result.feeds.greynoise.reports_new).toBe(100)
    expect(result.failures).toContain('talos: HTTP 503')
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') }))
    )

    const result = await ingestVendorResearch(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestVendorResearch(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
