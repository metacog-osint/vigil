/**
 * California AG breach notifications - incidents that are not ransomware.
 *
 * WHY
 *
 * All 39,575 incidents Vigil holds are ransomware leak-site claims, and the
 * entire non-ransomware corpus is about 500 rows. The platform reads as
 * ransomware-heavy because one table outnumbers everything else eighty to one,
 * and a feed of a hundred rows does not change that.
 *
 * California publishes every breach notification filed under Civil Code
 * 1798.29 and 1798.82 - roughly 5,350 of them back to 2012, each with the
 * organisation, the date of the breach and the date it was reported. They
 * cover every cause: intrusion, insider, lost laptop, misdirected mail, vendor
 * compromise. The great majority are not ransomware.
 *
 * It is also the victim's own account to a regulator under a legal duty, which
 * is the same class of evidence as the SEC filings and the reason both live in
 * victim_disclosures.
 *
 * HOW MUCH IS FETCHED
 *
 * `backfill` walks every page; without it only the first few are read. The
 * list is ordered by report date descending, so the recent pages carry
 * everything new and a scheduled run has no reason to touch the other
 * hundred. The full walk is for the first run and for repair.
 *
 * WHAT IS NOT TAKEN
 *
 * The cause of the breach. The list page does not carry it - it is in each
 * notification's own PDF - and guessing "ransomware" from an organisation name
 * would invent exactly the thing this source was added to avoid. A notice here
 * says an organisation told California something happened, and no more.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const LIST = 'https://oag.ca.gov/privacy/databreach/list'
const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'
const SOURCE = 'ca-ag'

/** Pages read on a normal scheduled run. The list is newest-first. */
const RECENT_PAGES = 4
/** Hard ceiling for a backfill. The list was 107 pages on 21 September 2026. */
const MAX_PAGES = 130

export interface BreachRow {
  company_name: string
  incident_date: string | null
  reported_date: string | null
  url: string
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** MM/DD/YYYY as California writes it, to an ISO date, or null. */
export function toIsoDate(us: string | null | undefined): string | null {
  if (!us) return null
  const m = us.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  // Reject a date that does not survive a round trip - 02/31/2026 and such.
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

export function parseList(html: string): BreachRow[] {
  const rows: BreachRow[] = []

  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...(tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [])].map(decode)
    // Header rows have no <td> at all; anything shorter is not a data row.
    if (cells.length < 3) continue

    const [company, breachDate, reportedDate] = cells
    if (!company) continue

    // The organisation cell links to the notification itself.
    const href = tr.match(/<a[^>]+href=["']([^"']+)["']/i)
    const url = href
      ? href[1].startsWith('http')
        ? href[1]
        : `https://oag.ca.gov${href[1]}`
      : LIST

    rows.push({
      company_name: company,
      incident_date: toIsoDate(breachDate),
      reported_date: toIsoDate(reportedDate),
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
    return json({ success: false, source: SOURCE, error: 'missing SUPABASE_URL or key' }, 500)
  }

  let backfill = false
  try {
    backfill = !!(await req.json())?.backfill
  } catch {
    // No body is the normal scheduled call.
  }

  const supabase = createClient(url, key)
  const pages = backfill ? MAX_PAGES : RECENT_PAGES
  const all: BreachRow[] = []
  let pagesRead = 0

  try {
    for (let page = 0; page < pages; page++) {
      const res = await fetch(page === 0 ? LIST : `${LIST}?page=${page}`, {
        headers: { 'User-Agent': UA },
      })
      if (!res.ok) throw new Error(`${LIST} page ${page} returned HTTP ${res.status}`)

      const rows = parseList(await res.text())
      pagesRead++

      // The list ends with an empty table rather than a 404, which is how a
      // backfill knows to stop without hard-coding how many pages exist.
      if (rows.length === 0) break
      all.push(...rows)
    }

    if (all.length === 0) {
      throw new Error('no breach notices parsed, which this list never legitimately returns')
    }

    const { data, error } = await supabase.rpc('apply_breach_notices', {
      p_rows: all,
      p_source: SOURCE,
    })
    if (error) throw new Error(`apply_breach_notices failed: ${error.message}`)

    return json({
      success: true,
      source: SOURCE,
      backfill,
      pages_read: pagesRead,
      parsed: all.length,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: SOURCE,
      pages_read: pagesRead,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
