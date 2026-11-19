/**
 * The job invokes the Edge Function that reads HHS OCR's breach portal (192):
 * one subrequest, the service key, no body, and a failure reported rather
 * than thrown.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ingestHhsOcrBreaches } from '../hhs-ocr-breaches.js'
import { JOBS_BY_ID } from '../registry.js'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'service-key' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ingestHhsOcrBreaches', () => {
  it('calls the edge function once with the service key and no body', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, new: 3 }) })
    )
    vi.stubGlobal('fetch', fetchMock)

    const out = await ingestHhsOcrBreaches(null, ENV)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/hhs-ocr-breaches')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    expect(init.body).toBeUndefined()
    expect(out).toEqual({ success: true, new: 3 })
  })

  it('reports an HTTP failure instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 546, text: () => Promise.resolve('CPU time') })
      )
    )
    const out = await ingestHhsOcrBreaches(null, ENV)
    expect(out).toMatchObject({ success: false, source: 'hhs-ocr-breaches' })
    expect(out.error).toContain('HTTP 546')
  })

  it('says so when the worker has no Supabase settings', async () => {
    const out = await ingestHhsOcrBreaches(null, {})
    expect(out).toMatchObject({ success: false, source: 'hhs-ocr-breaches' })
  })

  it('is scheduled daily and counts the reports it added', () => {
    const job = JOBS_BY_ID['hhs-ocr-breaches']
    expect(job).toMatchObject({ intervalMinutes: 1440, cost: 1 })
    expect(job.countNew({ new: 4, changed: 9 })).toBe(4)
  })
})
