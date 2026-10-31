// @vitest-environment node
/**
 * The hub's daily line (api/summary.js, api/_lib/publicSummary.js). The rules under test are
 * Vigil's own: a claim is not an attack, a failed count is null and not zero, a zero is not
 * published as a quiet day, a figure is a database count and not a tally of returned rows, and a
 * group whose name only a restricted source supplied is never named.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildSummary,
  confirmedAt,
  latestConfirmedDay,
  plainDate,
  runsSince,
  tallyGroups,
  MAX_BRIEF,
} from '../../../api/_lib/publicSummary.js'
import handler from '../../../api/summary.js'

const NOW = new Date('2026-10-31T21:30:00Z')
const HOUR = 3600000

/** Successful runs at :15 past each hour in [from, to]. */
function hourly(from, to, skip = []) {
  const out = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += HOUR) {
    const iso = new Date(t).toISOString()
    if (!skip.some((s) => iso.startsWith(s))) out.push(iso)
  }
  return out
}
const RUNS = hourly('2026-10-26T06:15:00Z', '2026-10-31T21:15:00Z')

const claimRows = (spec) =>
  Object.entries(spec).flatMap(([actor, n]) =>
    Array.from({ length: n }, () => ({ actor_id: actor === 'null' ? null : actor }))
  )

describe('which day is summarised', () => {
  it('is yesterday (UTC) once a run after midnight has succeeded', () => {
    expect(latestConfirmedDay(RUNS, NOW)).toEqual({
      day: '2026-10-30',
      confirmedAt: '2026-10-31T00:15:00Z',
    })
  })

  it('steps back a day when nothing has run since midnight', () => {
    const runs = RUNS.filter((t) => t < '2026-10-31T00:00:00Z')
    expect(latestConfirmedDay(runs, NOW).day).toBe('2026-10-29')
  })

  it('steps back a day when a gap over 12 hours could have let posts scroll out of the fetch', () => {
    // 14 hours with no successful run (05:15 to 19:15), inside 30 Oct
    const runs = RUNS.filter((t) => t < '2026-10-30T06:00:00Z' || t > '2026-10-30T19:00:00Z')
    expect(confirmedAt('2026-10-30', runs)).toBeNull()
    expect(latestConfirmedDay(runs, NOW).day).toBe('2026-10-29')
  })

  it('accepts the gaps the live feed actually has (a missed hour or two)', () => {
    const runs = hourly('2026-10-29T12:15:00Z', '2026-10-31T21:15:00Z', [
      '2026-10-30T20',
      '2026-10-31T00',
    ])
    expect(confirmedAt('2026-10-30', runs)).toBe('2026-10-31T01:15:00Z')
  })

  it('checks the hours before UTC midnight too, because RansomLook dates ahead of UTC', () => {
    // A 14-hour gap (09:15 to 23:15 UTC on 29 Oct) runs into RansomLook's 30 Oct, which began
    // at 23:00 UTC. Measured from UTC midnight alone, 23:15 would look like a run before the day.
    const runs = RUNS.filter((t) => t < '2026-10-29T10:00:00Z' || t >= '2026-10-29T23:00:00Z')
    expect(confirmedAt('2026-10-30', runs)).toBeNull()
  })

  it('needs a run from before the day began, not only after', () => {
    const runs = RUNS.filter((t) => t >= '2026-10-30T03:00:00Z')
    expect(confirmedAt('2026-10-30', runs)).toBeNull()
  })

  it('gives up after three days rather than calling an old day the latest', () => {
    const runs = RUNS.filter((t) => t < '2026-10-27T12:00:00Z')
    expect(latestConfirmedDay(runs, NOW)).toBeNull()
    expect(latestConfirmedDay([], NOW)).toBeNull()
  })

  it('asks sync_log for enough history to check the oldest day it may try', () => {
    // Oldest day tried is 28 Oct; its window opens 2 h before, less a 12 h gap
    expect(runsSince(NOW)).toBe('2026-10-27T10:00:00Z')
  })
})

describe('the sentence', () => {
  const day = { day: '2026-10-30', confirmedAt: '2026-10-31T00:15:00Z' }
  const names = { qilin: 'Qilin', genesis: 'genesis', akira: 'Akira', play: 'Play' }

  it('states the count, the groups and the group that posted the most', () => {
    const rows = claimRows({ qilin: 11, genesis: 9, akira: 3 })
    const s = buildSummary({ ...day, claims: 23, rows, names }, NOW)
    expect(s.brief).toBe(
      'Ransomware leak sites showed 23 new victim claims on 30 Oct 2026, from 3 groups; ' +
        'Qilin posted the most (11). Claims are unverified.'
    )
    expect(s).toMatchObject({
      built_at: '2026-10-31T21:30:00Z',
      day: '2026-10-30',
      claims: 23,
      groups: 3,
      unattributed: 0,
      top: {
        claims: 11,
        groups: [{ name: 'Qilin', url: 'https://vigil.theintelligence.company/actors/qilin' }],
      },
      ingest_confirmed_at: '2026-10-31T00:15:00Z',
      link: 'https://vigil.theintelligence.company/incidents',
      source: { publisher: 'RansomLook', licence: 'CC BY 4.0' },
    })
    expect(s.day_basis).toMatch(/ahead of UTC/)
  })

  it('never says anyone was attacked', () => {
    const s = buildSummary({ ...day, claims: 2, rows: claimRows({ qilin: 2 }), names }, NOW)
    expect(s.brief).not.toMatch(/attack|breach|hacked|compromised|victims of/i)
    expect(s.brief).toMatch(/claim/)
    expect(s.brief).toMatch(/unverified/)
  })

  it('names both groups in a two-way tie', () => {
    const rows = claimRows({ qilin: 5, akira: 5, play: 1 })
    const s = buildSummary({ ...day, claims: 11, rows, names }, NOW)
    expect(s.brief).toContain('; Akira and Qilin posted the most (5 each).')
    expect(s.top.groups.map((g) => g.name)).toEqual(['Akira', 'Qilin'])
  })

  it('names no one in a wider tie', () => {
    const rows = claimRows({ qilin: 2, akira: 2, play: 2 })
    const s = buildSummary({ ...day, claims: 6, rows, names }, NOW)
    expect(s.brief).toContain('; 3 groups tied for the most (2 each).')
  })

  it('names no group when the leader has no listable name, rather than the runner-up', () => {
    const rows = claimRows({ restricted: 8, qilin: 5 })
    const s = buildSummary({ ...day, claims: 13, rows, names }, NOW)
    expect(s.top).toBeNull()
    expect(s.brief).toBe(
      'Ransomware leak sites showed 13 new victim claims on 30 Oct 2026, from 2 groups. Claims are unverified.'
    )
    expect(s.brief).not.toContain('Qilin')
  })

  it('says "all from" when one named group posted everything', () => {
    const s = buildSummary({ ...day, claims: 1, rows: claimRows({ akira: 1 }), names }, NOW)
    expect(s.brief).toBe(
      'Ransomware leak sites showed 1 new victim claim on 30 Oct 2026, all from Akira. Claims are unverified.'
    )
  })

  it('counts claims with no group apart from the groups', () => {
    const rows = claimRows({ qilin: 4, akira: 1, null: 2 })
    const s = buildSummary({ ...day, claims: 7, rows, names }, NOW)
    expect(s.groups).toBe(2)
    expect(s.unattributed).toBe(2)
    expect(s.brief).toContain(
      'from 2 groups and 2 with no group recorded; Qilin posted the most (4)'
    )
  })

  it('gives no group figures from a truncated page, only the database count', () => {
    const rows = claimRows({ qilin: 1000 })
    const s = buildSummary({ ...day, claims: 1204, rows, names }, NOW)
    expect(s.claims).toBe(1204)
    expect(s.groups).toBeNull()
    expect(s.top).toBeNull()
    expect(s.brief).toBe(
      'Ransomware leak sites showed 1,204 new victim claims on 30 Oct 2026. Claims are unverified.'
    )
  })

  it('has no summary when the count failed: absence is not zero', () => {
    expect(buildSummary({ ...day, claims: null, rows: [], names }, NOW)).toBeNull()
    expect(buildSummary({ ...day, claims: undefined, rows: [], names }, NOW)).toBeNull()
  })

  it('does not publish a zero, which could be an outage upstream rather than a quiet day', () => {
    expect(buildSummary({ ...day, claims: 0, rows: [], names }, NOW)).toBeNull()
  })

  it(`stays within ${MAX_BRIEF} characters by dropping clauses, never by cutting words`, () => {
    const long = { a: 'A'.repeat(70), b: 'B'.repeat(70) }
    const s = buildSummary({ ...day, claims: 6, rows: claimRows({ a: 3, b: 3 }), names: long }, NOW)
    expect(s.brief.length).toBeLessThanOrEqual(MAX_BRIEF)
    expect(s.brief).toBe(
      'Ransomware leak sites showed 6 new victim claims on 30 Oct 2026, from 2 groups. Claims are unverified.'
    )
    expect(s.top.groups).toHaveLength(2)
  })

  it('writes the date in the house style in every month', () => {
    expect(plainDate('2026-09-05')).toBe('5 Sep 2026')
    expect(plainDate('2026-10-30')).toBe('30 Oct 2026')
  })

  it('tallies groups', () => {
    const t = tallyGroups(claimRows({ qilin: 3, akira: 1, null: 1 }))
    expect(t.most).toBe(3)
    expect(t.leaders).toEqual(['qilin'])
    expect(t.unattributed).toBe(1)
  })
})

describe('GET /api/summary', () => {
  const ENV = { VITE_SUPABASE_URL: 'https://db.example', VITE_SUPABASE_ANON_KEY: 'anon-key' }
  let calls

  const reply = (body, headers = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
    })

  function stubDb({
    runs = RUNS,
    rows = claimRows({ qilin: 11, genesis: 9 }),
    count = rows.length,
  } = {}) {
    calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url: String(url), headers: init?.headers || {} })
        const u = String(url)
        if (u.includes('/rest/v1/sync_log?')) return reply(runs.map((t) => ({ completed_at: t })))
        if (u.includes('/rest/v1/incidents_commercial?'))
          return reply(rows, {
            'Content-Range': rows.length ? `0-${rows.length - 1}/${count}` : `*/${count}`,
          })
        if (u.includes('/rest/v1/threat_actors_commercial?'))
          return reply([
            { actor_id: 'qilin', name: 'Qilin' },
            { actor_id: 'genesis', name: 'genesis' },
          ])
        return new Response('{}', { status: 404 })
      })
    )
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const get = () => handler(new Request('https://vigil.example/api/summary'))

  it('answers with the summary, open to any origin and cached at the edge', async () => {
    stubDb()
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400'
    )
    const body = await res.json()
    expect(body.day).toBe('2026-10-30')
    expect(body.built_at).toBe('2026-10-31T21:30:00Z')
    expect(body.brief).toBe(
      'Ransomware leak sites showed 20 new victim claims on 30 Oct 2026, from 2 groups; ' +
        'Qilin posted the most (11). Claims are unverified.'
    )
  })

  it('reads only the commercial views, asks for an exact count, and uses the anonymous key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    stubDb()
    await get()
    const paths = calls.map((c) => c.url.replace('https://db.example/rest/v1/', '').split('?')[0])
    expect(paths).toEqual(['sync_log', 'incidents_commercial', 'threat_actors_commercial'])
    expect(calls[1].url).toContain('discovered_date=eq.2026-10-30')
    expect(calls[1].headers.Prefer).toBe('count=exact')
    // Names asked for only for the group the sentence names
    expect(calls[2].url).toContain('actor_id=in.(qilin)')
    for (const c of calls) {
      expect(c.headers.apikey).toBe('anon-key')
      expect(JSON.stringify(c.headers)).not.toContain('service-role-key')
    }
  })

  it('takes the figure from the count header, not the rows returned', async () => {
    stubDb({ rows: claimRows({ qilin: 3 }), count: 1500 })
    const body = await (await get()).json()
    expect(body.claims).toBe(1500)
    expect(body.groups).toBeNull()
    expect(calls.some((c) => c.url.includes('threat_actors_commercial'))).toBe(false)
  })

  it('is unavailable, uncached and silent about why, when the database fails', async () => {
    stubDb()
    fetch.mockImplementationOnce(
      async () => new Response('{"message":"secret detail"}', { status: 500 })
    )
    const res = await get()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    const text = await res.text()
    expect(text).not.toContain('secret')
    expect(text).not.toContain('sync_log')
  })

  it('is unavailable when no day has confirmed ingestion', async () => {
    stubDb({ runs: [] })
    expect((await get()).status).toBe(503)
  })

  it('is unavailable rather than reporting a zero', async () => {
    stubDb({ rows: [], count: 0 })
    expect((await get()).status).toBe(503)
  })

  it('is unavailable when the count header is missing', async () => {
    stubDb()
    fetch.mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('sync_log')) return reply(RUNS.map((t) => ({ completed_at: t })))
      return reply([{ actor_id: 'qilin' }])
    })
    expect((await get()).status).toBe(503)
  })

  it('never falls back to the service role when the anonymous key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('SUPABASE_ANON_KEY', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    stubDb()
    expect((await get()).status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  it('answers a preflight and refuses anything but GET', async () => {
    const pre = await handler(
      new Request('https://vigil.example/api/summary', { method: 'OPTIONS' })
    )
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('*')
    const post = await handler(new Request('https://vigil.example/api/summary', { method: 'POST' }))
    expect(post.status).toBe(405)
  })
})
