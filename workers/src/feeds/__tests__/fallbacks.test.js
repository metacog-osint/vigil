/**
 * ANY.RUN trends and BGPStream used to write a fixed list when their source
 * could not be read: 15 malware families marked active and seen today, and
 * three ASNs tagged as bulletproof hosting. Nothing had been observed. A run
 * that cannot read its source must write nothing and report a failure, so the
 * scheduler records it as an error in sync_log.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestAnyRun } from '../anyrun.js'
import { ingestBGPStream } from '../bgpstream.js'

function fakeDb() {
  const upsert = vi.fn(() => Promise.resolve({ error: null, inserted: 0 }))
  const from = vi.fn(() => ({ upsert }))
  return { from, upsert }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ingestAnyRun without a readable trends page', () => {
  it('writes nothing and fails when the page returns an error', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' })))
    const db = fakeDb()

    const result = await ingestAnyRun(db, {})

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/403/)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('writes nothing and fails when the page names no families', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') })))
    const db = fakeDb()

    const result = await ingestAnyRun(db, {})

    expect(result.success).toBe(false)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('writes nothing and fails when the fetch throws', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))
    const db = fakeDb()

    const result = await ingestAnyRun(db, {})

    expect(result).toMatchObject({ success: false, error: 'network down' })
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('ingestBGPStream without a readable Crosswork API', () => {
  it('writes nothing, fetches nothing else, and fails on an HTTP error', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const db = fakeDb()

    const result = await ingestBGPStream(db)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('writes nothing and fails when the fetch throws', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(() => Promise.reject(new Error('timeout')))
    vi.stubGlobal('fetch', fetchMock)
    const db = fakeDb()

    const result = await ingestBGPStream(db)

    expect(result).toMatchObject({ success: false, error: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.from).not.toHaveBeenCalled()
  })
})
