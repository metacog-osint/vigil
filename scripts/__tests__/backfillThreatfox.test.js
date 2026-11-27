import { describe, it, expect } from 'vitest'
import {
  toIso,
  toRecord,
  parseIds,
  post,
  entriesFromLookup,
  fetchAll,
  buildRecords,
  insertSql,
  checkSql,
  undoSql,
  chunked,
} from '../backfill-threatfox.mjs'

const entry = (id, ioc, extra = {}) => ({
  id,
  ioc,
  ioc_type: 'url',
  threat_type: 'payload_delivery',
  malware: 'win.example',
  malware_printable: 'Example',
  confidence_level: 80,
  first_seen: '2026-11-22 04:35:04 UTC',
  last_seen: null,
  reporter: 'someone',
  reference: null,
  tags: ['x'],
  ...extra,
})

const reply = (body, { status = 200, raw } = {}) => ({
  ok: status < 400,
  status,
  text: async () => (raw !== undefined ? raw : JSON.stringify(body)),
})

describe('toIso', () => {
  it('reads ThreatFox dates as UTC', () => {
    expect(toIso('2026-11-22 04:35:04 UTC')).toBe('2026-11-22T04:35:04.000Z')
    expect(toIso(null)).toBe(null)
    expect(toIso('not a date')).toBe(null)
  })
})

describe('toRecord', () => {
  it('shapes a row as the worker does, dated by ThreatFox', () => {
    const r = toRecord(entry(2039118, 'http://a.example/'), '2026-11-26')
    expect(r).toMatchObject({
      value: 'http://a.example/',
      type: 'url',
      source: 'threatfox',
      malware_family: 'Example',
      confidence: 'high',
      first_seen: '2026-11-22T04:35:04.000Z',
      source_url: 'https://threatfox.abuse.ch/ioc/2039118/',
      first_seen_at: '2026-11-22T04:35:04.000Z',
      last_seen_at: '2026-11-22T04:35:04.000Z',
    })
    expect(r.metadata).toMatchObject({ threatfox_id: 2039118, backfill: '2026-11-26' })
  })
  it('maps ip:port to ip and unknown types to unknown', () => {
    expect(toRecord(entry(1, '1.2.3.4:80', { ioc_type: 'ip:port' }), 'd').type).toBe('ip')
    expect(toRecord(entry(1, 'x', { ioc_type: 'something_new' }), 'd').type).toBe('unknown')
  })
})

describe('parseIds', () => {
  it('expands ranges and single IDs', () => {
    expect(parseIds('5-7,10')).toEqual([5, 6, 7, 10])
    expect(parseIds(undefined)).toEqual([])
  })
  it('refuses bad input', () => {
    expect(() => parseIds('7-5')).toThrow()
    expect(() => parseIds('abc')).toThrow()
  })
})

describe('post', () => {
  it('tries again after a cut-off reply and a 502', async () => {
    const replies = [reply(null, { raw: '{"query_status":"ok","data":[{"id"' }), reply(null, { status: 502 }), reply({ query_status: 'ok', data: [] })]
    const fetchImpl = async () => replies.shift()
    expect(await post({}, 'k', { fetchImpl, waitMs: 0 })).toEqual({ query_status: 'ok', data: [] })
  })
  it('stops at once on a 401', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return reply(null, { status: 401 })
    }
    await expect(post({}, 'k', { fetchImpl, waitMs: 0 })).rejects.toThrow('401')
    expect(calls).toBe(1)
  })
  it('gives up after three cut-off replies', async () => {
    const fetchImpl = async () => reply(null, { raw: '{"query' })
    await expect(post({}, 'k', { fetchImpl, waitMs: 0 })).rejects.toThrow('3 tries')
  })
})

describe('entriesFromLookup', () => {
  it('reads the wrapped and the bare reply shapes', () => {
    expect(entriesFromLookup({ query_status: 'ok', data: [entry(1, 'a')] })).toHaveLength(1)
    expect(entriesFromLookup({ query_status: 'ok', data: entry(1, 'a') })).toHaveLength(1)
    expect(entriesFromLookup(entry(1, 'a'))).toHaveLength(1)
    expect(entriesFromLookup({ query_status: 'no_result' })).toEqual([])
  })
})

describe('fetchAll', () => {
  it('reads the last 7 days, then looks up only IDs it does not have', async () => {
    const bodies = []
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(init.body)
      bodies.push(body)
      if (body.query === 'get_iocs') return reply({ query_status: 'ok', data: [entry(10, 'a'), entry(11, 'b')] })
      if (body.id === 12) return reply({ query_status: 'ok', data: entry(12, 'c') })
      return reply({ query_status: 'no_result' })
    }
    const got = await fetchAll('k', [10, 12, 13], { fetchImpl, waitMs: 0, pauseMs: 0, log: () => {} })
    expect(bodies[0]).toEqual({ query: 'get_iocs', days: 7 })
    expect(bodies.slice(1).map((b) => b.id)).toEqual([12, 13])
    expect(got.map((e) => e.id).sort()).toEqual([10, 11, 12])
  })
})

describe('buildRecords', () => {
  it('keeps one row per indicator and filters on first_seen day', () => {
    const entries = [
      entry(1, 'http://a/', { first_seen: '2026-11-20 10:00:00 UTC' }),
      entry(2, 'http://b/'),
      entry(3, 'http://b/', { first_seen: '2026-11-22 09:00:00 UTC' }),
      entry(4, 'http://c/', { first_seen: '2026-11-25 23:59:59 UTC' }),
    ]
    const rows = buildRecords(entries, { from: '2026-11-22', to: '2026-11-25', backfillDate: 'd' })
    expect(rows.map((r) => r.metadata.threatfox_id)).toEqual([3, 4])
  })
})

describe('SQL', () => {
  const rows = [toRecord(entry(1, "http://it's.example/"), '2026-11-26')]
  it('insert adds only missing indicators and reports its count', () => {
    const sql = insertSql(rows)
    expect(sql).toContain('on conflict (type, value) do nothing')
    expect(sql).toContain("it''s")
    expect(sql).toContain('select count(*) as added')
  })
  it('check only reads', () => {
    expect(checkSql(rows)).not.toMatch(/\b(insert|update|delete)\b/i)
  })
  it('undo removes only rows tagged with the run date', () => {
    expect(undoSql('2026-11-26')).toContain("metadata->>'backfill' = '2026-11-26'")
  })
  it('splits statements under the size limit', () => {
    const many = Array.from({ length: 300 }, (_, i) => toRecord(entry(i, `http://x${i}.example/`), 'd'))
    const files = chunked(many, insertSql, 20_000)
    expect(files.length).toBeGreaterThan(1)
    for (const f of files) expect(Buffer.byteLength(f)).toBeLessThanOrEqual(20_000)
    const total = files.reduce((n, f) => n + (f.match(/"threatfox_id"/g) || []).length, 0)
    expect(total).toBe(300)
  })
})
