/**
 * The job invokes the Edge Function that reads the state AG breach registries.
 *
 * Two things matter about this feed and both are easy to break silently.
 *
 * It is what stops Vigil being a ransomware-only platform: every one of its
 * 39,575 incidents is a leak-site claim, and this is 8,812 notifications
 * covering every cause of breach. A change that quietly reduced it to a
 * handful of rows would undo that without failing.
 *
 * And `persons_affected` means different things in different states.
 * Washington counts Washingtonians; Oregon counts everyone, which is why its
 * largest row is Marriott at 500 million. Anything that adds those together
 * produces a number about nobody.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestStateBreachNotices } from '../state-breach-notices.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestStateBreachNotices', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestStateBreachNotices(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/state-breach-notices')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('does not ask for a backfill on a scheduled run', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestStateBreachNotices(null, ENV)

    // The backfill walks 108 pages of California alone. A scheduled run reads
    // the newest few of each list, which is newest-first.
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
  })

  it('reports each state separately rather than as one total', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'state-breach-notices',
              states: {
                'ca-ag': { state: 'CA', parsed: 200, new: 3, held_total: 5302 },
                'wa-ag': { state: 'WA', parsed: 150, new: 2, held_total: 1871 },
                'or-ag': { state: 'OR', parsed: 1656, new: 1, held_total: 1639 },
              },
              failures: [],
            }),
        })
      )
    )

    const result = await ingestStateBreachNotices(null, ENV)

    expect(result.states['ca-ag'].held_total).toBe(5302)
    expect(result.states['wa-ag'].held_total).toBe(1871)
    expect(result.states['or-ag'].held_total).toBe(1639)

    // No combined figure. Washington counts its residents and Oregon counts
    // everyone, so a single total across states would be meaningless - and a
    // key here claiming one would be the first sign someone had added them.
    expect(Object.keys(result)).not.toContain('persons_affected')
    expect(Object.keys(result)).not.toContain('total_affected')
  })

  it('keeps going when one state is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              states: {
                'ca-ag': { parsed: 200, new: 3 },
                'wa-ag': { error: 'page 0 returned HTTP 403' },
                'or-ag': { parsed: 1656, new: 0 },
              },
              failures: ['wa-ag: page 0 returned HTTP 403'],
            }),
        })
      )
    )

    const result = await ingestStateBreachNotices(null, ENV)

    // Several state sites block or rate-limit without warning; two states'
    // worth of filings is not thrown away because the third did.
    expect(result.success).toBe(true)
    expect(result.states['ca-ag'].new).toBe(3)
    expect(result.failures).toHaveLength(1)
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve('bad') }))
    )

    const result = await ingestStateBreachNotices(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('502')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestStateBreachNotices(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
