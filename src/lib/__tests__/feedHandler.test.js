// @vitest-environment node
/**
 * GET /api/feed (api/feed.js) end to end, against a stand-in for the database's REST interface that applies
 * the filters each query sends. It checks which rows the handler's own queries select, which the builder's tests
 * (doctrineFeed.test.js) cannot see.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../../api/feed.js'

const NOW = new Date('2026-10-30T18:00:00Z') // the window starts 23 Oct; late notices from 24 Aug

const NOTICE = {
  company_name: 'Example Corp',
  form: null,
  persons_affected: null,
  persons_affected_scope: null,
  match_status: null,
}
const TABLES = {
  victim_disclosures: [
    // Filed and first seen in the window.
    {
      ...NOTICE,
      id: 'in-window',
      source: 'ca-ag',
      filed_date: '2026-10-27',
      first_seen: '2026-10-28T03:16:00+00:00',
    },
    // Filed 12 days before Vigil first saw it: the registry posted it late.
    {
      ...NOTICE,
      id: 'late-12',
      company_name: 'Late Posting LLC',
      source: 'wa-ag',
      filed_date: '2026-10-18',
      first_seen: '2026-10-30T03:16:00+00:00',
    },
    // A registry's first read: filed years ago, first seen this week. Counted, never listed.
    {
      ...NOTICE,
      id: 'backfill',
      source: 'or-ag',
      filed_date: '2019-05-01',
      first_seen: '2026-10-29T03:16:00+00:00',
    },
    // Filed in the window, but HHS OCR stays out of the feed.
    {
      ...NOTICE,
      id: 'hhs',
      source: 'hhs-ocr',
      filed_date: '2026-10-28',
      first_seen: '2026-10-29T03:16:00+00:00',
    },
    // First seen before the window: neither listed nor counted.
    {
      ...NOTICE,
      id: 'old',
      source: 'ca-ag',
      filed_date: '2026-10-10',
      first_seen: '2026-10-12T03:16:00+00:00',
    },
  ],
}

/** One PostgREST condition, "column=op.value", as text comparison (dates and timestamps compare as text). */
function matches(row, column, cond) {
  const dot = cond.indexOf('.')
  const op = cond.slice(0, dot)
  const value = cond.slice(dot + 1)
  const have = row[column] == null ? null : String(row[column])
  if (op === 'eq') return have === value
  if (op === 'neq') return have !== value
  if (op === 'is') return value === 'true' ? row[column] === true : have === null
  if (have === null) return false
  // A timestamp column against a date or timestamp: compare in one form.
  const a = have.replace('+00:00', 'Z')
  const b = value.replace('+00:00', 'Z')
  if (op === 'gte') return a >= b
  if (op === 'gt') return a > b
  if (op === 'lte') return a <= b
  if (op === 'lt') return a < b
  if (op === 'in') return value.slice(1, -1).split(',').includes(have)
  throw new Error(`unsupported filter ${column}=${cond}`)
}

function select(path) {
  const url = new URL(`http://x/${path}`)
  const table = url.pathname.slice(1)
  let rows = TABLES[table] || []
  let limit = Infinity
  for (const [k, v] of url.searchParams) {
    if (k === 'select' || k === 'order') continue
    if (k === 'limit') {
      limit = Number(v)
      continue
    }
    if (k === 'and') {
      const parts = v.slice(1, -1).split(',')
      rows = rows.filter((r) =>
        parts.every((p) => {
          const [column, ...rest] = p.split('.')
          return matches(r, column, rest.join('.'))
        })
      )
      continue
    }
    rows = rows.filter((r) => matches(r, k, v))
  }
  return { rows: rows.slice(0, limit), total: rows.length }
}

describe('GET /api/feed: breach notices', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (href, { headers } = {}) => {
        const { rows, total } = select(String(href).split('/rest/v1/')[1])
        const h = { 'Content-Type': 'application/json' }
        if (headers?.Prefer === 'count=exact') {
          h['Content-Range'] = `${rows.length ? `0-${rows.length - 1}` : '*'}/${total}`
        }
        return new Response(JSON.stringify(rows), { status: 200, headers: h })
      })
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const load = async () => {
    const res = await handler(new Request('https://vigil.example/api/feed'))
    expect(res.status).toBe(200)
    const fc = await res.json()
    return {
      summary: fc.features[0].properties.title,
      items: Object.fromEntries(
        fc.features
          .filter((f) => f.properties.id.startsWith('vigil:disclosure:'))
          .map((f) => [f.properties.id.slice('vigil:disclosure:'.length), f.properties])
      ),
    }
  }

  it('lists a notice filed 12 days before Vigil first saw it, with both dates in its title', async () => {
    const { items } = await load()
    expect(items['late-12']).toBeDefined()
    expect(items['late-12'].title).toBe(
      'Late Posting LLC reported a data breach to the Washington attorney general (filed 18 Oct 2026; first seen by Vigil 30 Oct 2026)'
    )
    // The item is dated by its filing, as every notice is.
    expect(items['late-12'].event_start).toBe('2026-10-18T00:00:00Z')
    expect(items['late-12'].data_as_of).toBe('2026-10-18T00:00:00Z')
  })

  it('keeps a first-read backfill, HHS OCR and notices first seen before the window out', async () => {
    const { items } = await load()
    expect(Object.keys(items).sort()).toEqual(['in-window', 'late-12'])
    // A notice filed in the window carries no extra dates.
    expect(items['in-window'].title).toBe(
      'Example Corp reported a data breach to the California attorney general'
    )
  })

  it('keeps both summary counts and says how many of the older notices it lists', async () => {
    const { summary } = await load()
    expect(summary).toContain(
      '; 1 breach notice filed since 23 Oct; 2 older breach notices first seen since 23 Oct, filed before it (1 filed since 24 Aug listed in this feed)'
    )
  })
})
