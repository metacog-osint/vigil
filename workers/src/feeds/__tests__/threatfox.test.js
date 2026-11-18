/**
 * ThreatFox can list one indicator twice in a day. Two rows with the same
 * (type, value) in one upsert make Postgres refuse the whole batch, which cost
 * 250 indicators an hour from 18:15 UTC on 18 Nov 2026.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestThreatFox, latestPerKey } from '../threatfox.js'

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
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query_status: 'ok',
              data: [
                ioc(1, 'bad.example', '2026-11-18 12:00:00 UTC'),
                ioc(2, 'bad.example', '2026-11-18 15:00:00 UTC'),
                ioc(3, 'other.example', null),
              ],
            }),
        })
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
