/**
 * State Attorney General breach registries - incidents that are not ransomware.
 *
 * WHY THIS IS ONE FUNCTION AND NOT THREE
 *
 * California was built alone. Washington and Oregon publish the same kind of
 * record, and a second and third function shaped like the first would be three
 * copies of one idea. A state is a REGISTRIES entry here: a URL, how it
 * paginates, and which column means what. Adding the next one is that entry.
 *
 * WHICH STATES ARE AVAILABLE, CHECKED 22 SEPTEMBER 2026
 *
 *   California    5,302 notices, paginated HTML             ingested
 *   Washington    ~1,900 notices, 38 pages                  ingested
 *   Oregon        ~1,650 notices, one page                  ingested
 *   Texas         HTTP 401 - Salesforce portal behind auth
 *   New Hampshire HTTP 403 - blocks non-browser clients
 *   Maine, Montana, Indiana, Vermont - 404 at documented paths
 *   Iowa          HTTP 200, no table on the page
 *
 * "All fifty states" is not on offer. About a dozen publish a list a machine
 * can read, and these are the three largest of those.
 *
 * WHAT IS TAKEN AND WHAT IS NOT
 *
 * The states publish more than California does: Washington gives the number of
 * its residents affected and the categories of data exposed, Oregon gives the
 * discovery date. Those are taken.
 *
 * The CAUSE is not, because none of them publishes it. Washington's
 * "Information Compromised" column lists what was exposed - "Name; Social
 * Security Number; Medical Information" - and says nothing about whether it
 * was ransomware, an insider or a lost laptop. Reading a cause out of it would
 * invent exactly what this whole source exists to avoid.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'

interface Registry {
  source: string
  state: string
  base: string
  /** How a page beyond the first is addressed, or null for a single page. */
  page: ((n: number) => string) | null
  /** Pages read on a scheduled run. Lists are newest-first. */
  recentPages: number
  maxPages: number
  /** Column positions, by index into the row's <td> cells. */
  cols: {
    company: number
    reported?: number
    incident?: number
    discovered?: number
    affected?: number
    dataTypes?: number
  }
}

const REGISTRIES: Record<string, Registry> = {
  'ca-ag': {
    source: 'ca-ag',
    state: 'CA',
    base: 'https://oag.ca.gov/privacy/databreach/list',
    page: (n) => `https://oag.ca.gov/privacy/databreach/list?page=${n}`,
    recentPages: 4,
    maxPages: 130,
    cols: { company: 0, incident: 1, reported: 2 },
  },
  'wa-ag': {
    source: 'wa-ag',
    state: 'WA',
    base: 'https://www.atg.wa.gov/data-breach-notifications',
    page: (n) => `https://www.atg.wa.gov/data-breach-notifications?page=${n}`,
    recentPages: 3,
    maxPages: 60,
    // Date Reported | Organization | Date of Breach | Washingtonians Affected | Information Compromised
    cols: { reported: 0, company: 1, incident: 2, affected: 3, dataTypes: 4 },
  },
  'or-ag': {
    source: 'or-ag',
    state: 'OR',
    base: 'https://justice.oregon.gov/consumer/DataBreach/',
    // The whole list is one page, so there is nothing to paginate.
    page: null,
    recentPages: 1,
    maxPages: 1,
    // Organization | Reported | Dates of Breach | Dates of Discovery | Notice Sent | Number Affected
    cols: { company: 0, reported: 1, incident: 2, discovered: 3, affected: 5 },
  },
}

export interface NoticeRow {
  company_name: string
  state: string
  reported_date: string | null
  incident_date: string | null
  discovered_date: string | null
  persons_affected: number | null
  data_types: string[] | null
  url: string
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;|&#8217;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A date as the registries write it, to ISO, or null.
 *
 * Oregon publishes ranges - "12/2/2025 - 12/18/2025" - and the first date is
 * taken, because that is when the breach began. Taking the last would say the
 * intrusion started on the day it ended.
 */
export function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const first = raw.split(/\s*[-–]\s*/)[0].trim()
  const m = first.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

/** "1,332" -> 1332. Anything that is not a plain count returns null. */
export function toCount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const digits = raw.replace(/[,\s]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

/** Washington separates the categories with semicolons. */
export function toDataTypes(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  const parts = raw
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length < 120)
  return parts.length ? [...new Set(parts)] : null
}

export function parseList(html: string, reg: Registry): NoticeRow[] {
  const rows: NoticeRow[] = []

  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const rawCells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (rawCells.length < 2) continue

    const cells = rawCells.map(decode)
    const company = cells[reg.cols.company]
    if (!company) continue

    const at = (i: number | undefined) => (i === undefined ? null : (cells[i] ?? null))

    const href = tr.match(/<a[^>]+href=["']([^"']+)["']/i)
    const url = href
      ? href[1].startsWith('http')
        ? href[1]
        : new URL(href[1], reg.base).toString()
      : reg.base

    rows.push({
      company_name: company,
      state: reg.state,
      reported_date: toIsoDate(at(reg.cols.reported)),
      incident_date: toIsoDate(at(reg.cols.incident)),
      discovered_date: toIsoDate(at(reg.cols.discovered)),
      persons_affected: toCount(at(reg.cols.affected)),
      data_types: toDataTypes(at(reg.cols.dataTypes)),
      url,
    })
  }

  return rows
}

Deno.serve(async (req) => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'state-breach-notices', error: 'missing SUPABASE_URL or key' }, 500)
  }

  let backfill = false
  let only: string[] | null = null
  try {
    const body = await req.json()
    backfill = !!body?.backfill
    if (Array.isArray(body?.states)) only = body.states
  } catch {
    // No body is the normal scheduled call.
  }

  const supabase = createClient(url, key)
  const perState: Record<string, unknown> = {}
  const failures: string[] = []

  for (const reg of Object.values(REGISTRIES)) {
    if (only && !only.includes(reg.source)) continue

    try {
      const pages = reg.page === null ? 1 : backfill ? reg.maxPages : reg.recentPages
      const all: NoticeRow[] = []
      let pagesRead = 0

      for (let p = 0; p < pages; p++) {
        const target = p === 0 || reg.page === null ? reg.base : reg.page(p)
        const res = await fetch(target, { headers: { 'User-Agent': UA } })
        if (!res.ok) throw new Error(`page ${p} returned HTTP ${res.status}`)

        const parsed = parseList(await res.text(), reg)
        pagesRead++
        // These lists end with an empty table rather than a 404, which is how
        // a backfill stops without hard-coding how many pages exist.
        if (parsed.length === 0) break
        all.push(...parsed)
      }

      if (all.length === 0) {
        throw new Error('no notices parsed, which this registry never legitimately returns')
      }

      const { data, error } = await supabase.rpc('apply_breach_notices', {
        p_rows: all,
        p_source: reg.source,
      })
      if (error) throw new Error(error.message)

      perState[reg.source] = { pages_read: pagesRead, parsed: all.length, ...(data ?? {}) }
    } catch (e) {
      // One state's site being down must not cost the others.
      const message = e instanceof Error ? e.message : String(e)
      perState[reg.source] = { error: message }
      failures.push(`${reg.source}: ${message}`)
    }
  }

  const attempted = Object.keys(perState).length
  return json({
    // Every registry failing is a real failure; one is a Tuesday.
    success: attempted > 0 && failures.length < attempted,
    source: 'state-breach-notices',
    backfill,
    states: perState,
    failures,
    ms: Date.now() - started,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
