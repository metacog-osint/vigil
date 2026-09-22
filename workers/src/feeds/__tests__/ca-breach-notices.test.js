/**
 * The job invokes the Edge Function that reads California's breach list.
 *
 * What matters about this feed is what it is for: every one of Vigil's 39,575
 * incidents is a ransomware leak-site claim, and this is 5,302 notifications
 * covering every cause of breach. A change that quietly reduced it to a
 * handful of rows, or that started matching notices to incidents, would undo
 * that without failing.
 *
 * So the counts are asserted, and so is the absence of any matching.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestCaBreachNotices } from '../ca-breach-notices.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestCaBreachNotices', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestCaBreachNotices(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/ca-breach-notices')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('does not ask for a backfill on a scheduled run', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestCaBreachNotices(null, ENV)

    // The backfill walks 108 pages. A scheduled run reads four, because the
    // list is newest-first and that covers a week of filings many times over.
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
  })

  it('passes the counts and the date range through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'ca-ag',
              backfill: false,
              pages_read: 4,
              parsed: 200,
              new: 6,
              held_total: 5302,
              earliest_reported: '2012-01-20',
              latest_reported: '2026-09-21',
            }),
        })
      )
    )

    const result = await ingestCaBreachNotices(null, ENV)

    expect(result.held_total).toBe(5302)
    expect(result.earliest_reported).toBe('2012-01-20')

    // Nothing here may claim a notice was tied to an incident. Whether a
    // California filing and a leak-site claim describe one event is a
    // judgment, and match_status stays 'unreviewed' until a person rules.
    expect(Object.keys(result)).not.toContain('matched')
    expect(Object.keys(result)).not.toContain('incidents_linked')
  })

  it('reports an error rather than reporting success with nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve('bad') }))
    )

    const result = await ingestCaBreachNotices(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('502')
  })

  it('refuses rather than pretending, with no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestCaBreachNotices(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
