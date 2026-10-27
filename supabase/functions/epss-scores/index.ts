/**
 * EPSS scores from FIRST, for the CVEs that matter, every day.
 *
 * WHY THIS EXISTS
 *
 * The worker job this replaces read the CVE list, took the first 40 rows and
 * refreshed those - the same 40 every day - while reporting success. By
 * 26 October 2026 no CVE added to KEV in the previous month had a score, and
 * the newest score anywhere was from 20 September. See migration 158.
 *
 * WHAT IT TAKES
 *
 *   1. Every CVE FIRST scores above 0.1 (about 17,500), in pages of 1,000.
 *   2. Every KEV CVE Vigil holds that step 1 did not return, by id in batches
 *      of 100, so a KEV entry's low score is current too.
 *
 * About 38 requests, then apply_epss_scores() in bulk. That function writes
 * only to CVEs Vigil holds and never replaces a newer score with an older one,
 * and each score carries the date FIRST published it.
 *
 * WHY IT IS AN EDGE FUNCTION
 *
 * The worker has 50 subrequests per invocation shared across every feed, and
 * this needs about 40. One call from the worker, the rest here.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const API = 'https://api.first.org/data/v1/epss'
const UA = 'Vigil-ThreatIntel/1.0'
const FLOOR = 0.1
const PAGE = 1000
// About 17,500 above the floor today; the guard stops a runaway, not the feed.
const MAX_PAGES = 60
const ID_BATCH = 100
const APPLY_CHUNK = 2000

interface FirstScore {
  cve?: string
  epss?: string
  percentile?: string
  date?: string
}

export interface ScoreRow {
  cve: string
  epss: number
  percentile: number
  date: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** FIRST sends numbers as strings. Anything unparseable is dropped, not zeroed. */
export function toRows(data: FirstScore[]): ScoreRow[] {
  const rows: ScoreRow[] = []
  for (const s of data ?? []) {
    const epss = Number(s.epss)
    const percentile = Number(s.percentile)
    if (!s.cve || !s.date || !Number.isFinite(epss) || !Number.isFinite(percentile)) continue
    rows.push({ cve: s.cve, epss, percentile, date: s.date })
  }
  return rows
}

async function getJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  if (!response.ok) throw new Error(`FIRST EPSS HTTP ${response.status}`)
  return await response.json()
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'epss', error: 'missing SUPABASE_URL or key' }, 500)
  }
  const supabase = createClient(url, key)

  try {
    const scores = new Map<string, ScoreRow>()

    // 1. Everything above the floor.
    let offset = 0
    let total = Number.POSITIVE_INFINITY
    let pages = 0
    while (offset < total && pages < MAX_PAGES) {
      const body = await getJson(`${API}?epss-gt=${FLOOR}&limit=${PAGE}&offset=${offset}`)
      total = Number(body?.total ?? 0)
      for (const row of toRows(body?.data ?? [])) scores.set(row.cve, row)
      offset += PAGE
      pages += 1
    }

    // 2. KEV CVEs the floor did not cover, by id.
    const { data: kevIds, error: kevError } = await supabase.rpc('epss_kev_targets')
    if (kevError) throw new Error(`epss_kev_targets: ${kevError.message}`)
    const kev: string[] = Array.isArray(kevIds) ? kevIds : []
    const byId = kev.filter((id) => !scores.has(id))
    for (let i = 0; i < byId.length; i += ID_BATCH) {
      const batch = byId.slice(i, i + ID_BATCH)
      const body = await getJson(`${API}?cve=${batch.join(',')}&limit=${ID_BATCH}`)
      for (const row of toRows(body?.data ?? [])) scores.set(row.cve, row)
    }

    // 3. Write, in chunks a single statement handles comfortably.
    const rows = [...scores.values()]
    let applied = 0
    for (let i = 0; i < rows.length; i += APPLY_CHUNK) {
      const { data, error } = await supabase.rpc('apply_epss_scores', {
        p_rows: rows.slice(i, i + APPLY_CHUNK),
      })
      if (error) throw new Error(`apply_epss_scores: ${error.message}`)
      applied += Number(data?.applied ?? 0)
    }

    const dates = rows.map((r) => r.date).sort()
    return json({
      success: true,
      source: 'epss',
      above_floor: total,
      pages,
      kev_targets: kev.length,
      kev_queried_by_id: byId.length,
      scored: rows.length,
      // The scheduler logs `updated` as records_updated.
      updated: applied,
      date: dates.length ? dates[dates.length - 1] : null,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: 'epss', error: (e as Error).message }, 500)
  }
})
