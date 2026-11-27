/**
 * URLhaus saves through the same batch splitter as ThreatFox, so a statement
 * timeout no longer drops a whole batch (100 URLs at 03:46 UTC on 23 Nov 2026).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestURLhaus } from '../urlhaus.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const url = (i) => ({ id: i, url: `http://u${i}.example/x`, threat: 'malware_download', dateadded: '2026-11-23 03:00:00 UTC', urlhaus_link: `https://urlhaus.abuse.ch/url/${i}/`, tags: [] })

describe('ingestURLhaus', () => {
  it('splits a batch that hits the statement timeout instead of losing it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ urls: Array.from({ length: 100 }, (_, i) => url(i)) }) })))
    const timeout = { code: '57014', message: 'canceling statement due to statement timeout' }
    const upsert = vi.fn((batch) => Promise.resolve(batch.length > 50 ? { error: timeout } : { error: null, inserted: 1 }))
    const out = await ingestURLhaus({ from: () => ({ upsert }) }, { ABUSECH_API_KEY: 'k' })
    expect(out.success).toBe(true)
    expect(out.failed).toBe(0)
    expect(upsert.mock.calls.map((c) => c[0].length)).toEqual([100, 50, 50])
  })
})
