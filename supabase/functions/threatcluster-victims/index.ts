/**
 * Victim country, from a source that is allowed to be redistributed.
 *
 * WHY THIS EXISTS
 *
 * ransomware.live was the only source that ever supplied victim_country -
 * 11,256 of 11,317 - and it stopped on 29 May 2026. ransomlook, which has run
 * since, returns no country field on any public endpoint. So 28,217 incidents
 * have no country and nothing was going to fill them.
 *
 * ThreatCluster's Ransomware-Intel is a daily CSV marked TLP:CLEAR - "free to
 * use, redistribute, and integrate. Attribution appreciated." Measured before
 * this was written: 91% country coverage, 85% match against our missing rows,
 * and 99% agreement with what we already hold (916 of 922 overlapping
 * victims). The agreement matters more than the coverage - it is independently
 * crawled, and it still concords.
 *
 * WHY AN EDGE FUNCTION RATHER THAN THE WORKER
 *
 * Workers Free allows 10 ms of CPU per invocation. Parsing a few thousand rows
 * of CSV with quoted fields is not a 10 ms job. This runtime allows 2 s, so
 * the parse happens here and the worker spends one subrequest invoking it -
 * the same arrangement ofac-sdn uses, and for the same reason.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not decide anything. apply_victim_countries fills only what is
 * empty, leaves a contested victim entirely alone, and queues the
 * disagreement. A country that two sources argue about is a judgment call,
 * and judgment calls go to the review queue.
 *
 * It also does not turn a claim into a confirmation. This is a leak-site
 * aggregator and says so itself: "Everything is the group's claim, not a
 * confirmed breach."
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BASE = 'https://raw.githubusercontent.com/Jam0k/Ransomware-Intel/main/data'

/** 90 days for the daily run; 365 to backfill, which is a bigger download. */
const WINDOWS: Record<string, string> = {
  '90d': `${BASE}/victims.csv`,
  '365d': `${BASE}/victims-365d.csv`,
}

const UA = 'Vigil-ThreatIntel/1.0 (+https://vigil.theintelligence.company)'

interface VictimRow {
  victim: string
  country: string
  first_party: boolean
}

/**
 * A real CSV reader. Victim names contain commas inside quotes - a naive split
 * silently shifts every later column, which during evaluation turned the
 * `discovered` column into fragments of company names.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** The columns we need, by name, because column order is not a contract. */
export function toVictimRows(rows: string[][]): VictimRow[] {
  if (rows.length < 2) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const iVictim = header.indexOf('victim')
  const iCountry = header.indexOf('country')
  const iFirstParty = header.indexOf('first_party')

  if (iVictim === -1 || iCountry === -1) {
    throw new Error(
      `expected victim and country columns, got: ${header.join(', ')}`
    )
  }

  const out: VictimRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const victim = (rows[i][iVictim] || '').trim()
    const country = (rows[i][iCountry] || '').trim()
    if (!victim || country.length !== 2) continue

    out.push({
      victim,
      country,
      first_party: iFirstParty !== -1 && (rows[i][iFirstParty] || '').trim() === 'yes',
    })
  }

  return out
}

Deno.serve(async (req) => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'threatcluster', error: 'missing SUPABASE_URL or key' }, 500)
  }

  let window = '90d'
  try {
    const body = await req.json()
    if (body?.window && WINDOWS[body.window]) window = body.window
  } catch {
    // no body is the ordinary case: the scheduler just invokes it
  }

  const supabase = createClient(url, key)

  try {
    const response = await fetch(WINDOWS[window], { headers: { 'User-Agent': UA } })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const rows = toVictimRows(parseCsv(await response.text()))
    if (rows.length === 0) {
      // An empty file is not a successful run with nothing to do; it is a
      // source that has changed shape or broken.
      throw new Error('no usable rows parsed from the victims file')
    }

    const { data, error } = await supabase.rpc('apply_victim_countries', {
      p_rows: rows,
      p_source: 'threatcluster',
    })
    if (error) throw new Error(`apply_victim_countries failed: ${error.message}`)

    return json({
      success: true,
      source: 'threatcluster',
      window,
      parsed: rows.length,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: 'threatcluster',
      window,
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
