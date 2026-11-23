/**
 * ThreatFox can list one indicator twice in a day. Two rows with the same
 * (type, value) in one upsert make Postgres refuse the whole batch, which cost
 * 250 indicators an hour from 18:15 UTC on 18 Nov 2026.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestThreatFox, latestPerKey, saveBatch } from '../threatfox.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const ioc = (id, value, lastSeen, type = 'domain') => ({
  id,
  ioc: value,
  ioc_type: type,
  malware_printable: `family-${id}`,
  confidence_level: 75,
  first_seen: '2026-11-18 10:00:00 UTC',
  last_seen: lastSeen,
})

const reply = (body, status = 200) => ({
  ok: status < 400,
  status,
  statusText: status === 502 ? 'Bad Gateway' : 'OK',
  text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
})

const ENV = { ABUSECH_API_KEY: 'k', THREATFOX_RETRY_WAIT_MS: 0 }

describe('latestPerKey', () => {
  it('keeps one entry per type and value, the most recently seen', () => {
    const out = latestPerKey([
      ioc(1, 'bad.example', '2026-11-18 12:00:00 UTC'),
      ioc(2, 'bad.example', '2026-11-18 15:00:00 UTC'),
      ioc(3, 'other.example', null),
    ])
    expect(out.map((i) => i.id)).toEqual([2, 3])
  })

  it('treats the same value under different types as different indicators', () => {
    const out = latestPerKey([ioc(1, 'x', null, 'domain'), ioc(2, 'x', null, 'url')])
    expect(out).toHaveLength(2)
  })

  it('lets the later entry win a tie', () => {
    const out = latestPerKey([ioc(1, 'a', null), ioc(2, 'a', null)])
    expect(out.map((i) => i.id)).toEqual([2])
  })
})

describe('ingestThreatFox', () => {
  it('sends no duplicate keys to the upsert and reports how many it dropped', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          reply({
            query_status: 'ok',
            data: [
              ioc(1, 'bad.example', '2026-11-18 12:00:00 UTC'),
              ioc(2, 'bad.example', '2026-11-18 15:00:00 UTC'),
              ioc(3, 'other.example', null),
            ],
          })
        )
      )
    )
    const upsert = vi.fn(() => Promise.resolve({ error: null, inserted: 1 }))
    const supabase = { from: vi.fn(() => ({ upsert })) }

    const result = await ingestThreatFox(supabase, { ABUSECH_API_KEY: 'k' })

    const rows = upsert.mock.calls[0][0]
    const keys = rows.map((r) => `${r.type}|${r.value}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(rows.find((r) => r.value === 'bad.example').metadata.threatfox_id).toBe(2)
    expect(result).toMatchObject({ success: true, failed: 0, duplicates: 1, added: 1, updated: 1 })
  })
})

describe('a cut-off or failing reply from ThreatFox (22 Nov 2026)', () => {
  const whole = { query_status: 'ok', data: [ioc(1, 'a.example', null)] }
  const cut = JSON.stringify(whole).slice(0, 40)
  const db = () => ({ from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: null, inserted: 1 })) })) })

  it('tries again and keeps the whole reply', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(reply(cut))
      .mockResolvedValueOnce(reply('', 502))
      .mockResolvedValueOnce(reply(whole))
    vi.stubGlobal('fetch', fetch)
    const result = await ingestThreatFox(db(), ENV)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ success: true, added: 1, failed: 0 })
  })

  it('after three bad replies, fails with an error marked as the source', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply(cut))))
    const result = await ingestThreatFox(db(), ENV)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/^source: ThreatFox sent a cut-off or unreadable reply/)
  })

  it('does not repeat a refused key', async () => {
    const fetch = vi.fn(() => Promise.resolve(reply('', 401)))
    vi.stubGlobal('fetch', fetch)
    const result = await ingestThreatFox(db(), ENV)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.error).not.toMatch(/^source:/)
  })
})

describe('saveBatch', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ type: 'domain', value: `d${i}.example` }))
  const timeout = { code: '57014', message: 'canceling statement due to statement timeout' }

  it('splits a batch that hits the statement timeout and saves both halves', async () => {
    const upsert = vi.fn((batch) =>
      Promise.resolve(batch.length > 125 ? { error: timeout } : { error: null, inserted: 2 })
    )
    const out = await saveBatch({ from: () => ({ upsert }) }, rows(250))
    expect(out).toEqual({ written: 250, inserted: 4, failed: 0 })
    expect(upsert.mock.calls.map((c) => c[0].length)).toEqual([250, 125, 125])
  })

  it('gives up below the smallest batch and counts the rows as failed', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: timeout }))
    const out = await saveBatch({ from: () => ({ upsert }) }, rows(40))
    expect(out.failed).toBe(40)
    expect(out.written).toBe(0)
  })

  it('does not split on other errors', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: { code: '23505', message: 'duplicate' } }))
    const out = await saveBatch({ from: () => ({ upsert }) }, rows(250))
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(out.failed).toBe(250)
  })
})
