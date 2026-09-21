/**
 * The job invokes the Edge Function that does the work.
 *
 * The behaviour worth protecting is not the fetch. It is that this source is
 * NonCommercial, and that fact has to survive: the licence is re-read from the
 * API response on every run, the rows it writes carry origin_source = 'etda',
 * and source_licences excludes them from anything sold. A run that quietly
 * stopped reporting its licence, or reported success while writing nothing,
 * would take that guarantee with it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestEtdaActors } from '../etda-actors.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestEtdaActors', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestEtdaActors(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/etda-actors')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the licence and the fill counts through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'etda',
              parsed: 355,
              licence:
                'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License',
              filled: 186,
              agreed: 433,
              queued_disagreement: 1,
              unmapped_countries: [],
            }),
        })
      )
    )

    const result = await ingestEtdaActors(null, ENV)

    expect(result.filled).toBe(186)
    // 433 independent agreements against 1 disagreement is the reason this
    // source was trusted to fill anything at all.
    expect(result.agreed).toBe(433)
    expect(result.queued_disagreement).toBe(1)
    // The licence has to reach the run record, not just the code comments.
    expect(result.licence).toMatch(/NonCommercial/)
    // A country name nobody mapped is a country being dropped silently.
    expect(result.unmapped_countries).toEqual([])
  })

  it('surfaces country names that were dropped for want of a mapping', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'etda',
              parsed: 348,
              filled: 184,
              unmapped_countries: ['UK', 'UAE', 'Canada'],
            }),
        })
      )
    )

    const result = await ingestEtdaActors(null, ENV)

    // The first real run reported exactly this, and it was how six countries
    // were found to be silently absent rather than absent from the source.
    expect(result.unmapped_countries).toContain('UK')
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('down') }))
    )

    const result = await ingestEtdaActors(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('503')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestEtdaActors(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
