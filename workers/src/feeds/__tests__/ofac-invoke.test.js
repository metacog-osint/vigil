/**
 * The OFAC job no longer fetches Treasury; it invokes the Edge Function that
 * can. These cover the part that would fail silently: a job that cannot reach
 * the function must report an error, because ofac-sdn is marked critical and
 * "no news" from a sanctions feed must never read as success.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestOFAC } from '../ofac-sdn.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestOFAC', () => {
  it('calls the edge function with the service key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, source: 'ofac-sdn', unchanged: true }),
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await ingestOFAC(null, ENV)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/ofac-sdn')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('passes the function\'s own account of the run straight through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              source: 'ofac-sdn',
              unchanged: true,
              addresses: 1043,
            }),
        })
      )
    )

    const result = await ingestOFAC(null, ENV)

    // Unchanged is success - having checked is the assertion being made.
    expect(result).toEqual({
      success: true,
      source: 'ofac-sdn',
      unchanged: true,
      addresses: 1043,
    })
  })

  it('reports an error when the function refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') })
      )
    )

    const result = await ingestOFAC(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
  })

  it('reports an error when the function cannot be reached at all', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    const result = await ingestOFAC(null, ENV)

    expect(result.success).toBe(false)
    expect(result.error).toContain('network down')
  })

  it('refuses rather than pretending, when it has no credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestOFAC(null, {})

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
