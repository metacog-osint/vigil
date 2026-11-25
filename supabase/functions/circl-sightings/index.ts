/**
 * Reported exploitation from CIRCL Vulnerability-Lookup sightings, hourly (194).
 *
 * Reads type=exploited in date windows from a cursor, at most PAGE_BUDGET pages
 * a run and well under CIRCL's anonymous limit of 20 requests a minute. The
 * first runs walk the history; after that each run re-reads the current day.
 * Re-reading is harmless because apply_circl_sightings only widens dates.
 *
 * Only allow-listed sources are stored (_shared/circlSightings.ts). What was
 * left out is counted by reason in the result. Never touches KEV columns.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  classifySighting,
  windowEnd,
  type RawSighting,
  type SightingRow,
} from '../_shared/circlSightings.ts'

const API = 'https://vulnerability.circl.lu/api/sighting/'
const UA = 'TIC-Vigil/1.0 (+https://vigil.theintelligence.company)'
const PER_PAGE = 100
const PAGE_BUDGET = 10
const DELAY_MS = 3500

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readPage(from: string, to: string, page: number) {
  const query = new URLSearchParams({
    type: 'exploited',
    date_from: from,
    date_to: to,
    per_page: String(PER_PAGE),
    page: String(page),
  })
  const response = await fetch(`${API}?${query}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!response.ok) throw new Error(`CIRCL HTTP ${response.status} on page ${page}`)
  const body = await response.json()
  if (!Array.isArray(body?.data)) throw new Error('CIRCL response has no data array')
  return body.data as RawSighting[]
}

Deno.serve(async () => {
  const started = Date.now()
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json(
      { success: false, source: 'circl-sightings', error: 'missing SUPABASE_URL or key' },
      500
    )
  }
  const supabase = createClient(url, key)

  try {
    const { data: cursor, error: cursorError } = await supabase
      .from('circl_sightings_cursor')
      .select('day,next_page')
      .eq('id', 'exploited')
      .single()
    if (cursorError) throw new Error(`cursor read: ${cursorError.message}`)

    const today = new Date().toISOString().slice(0, 10)
    let day: string = cursor.day
    let page: number = cursor.next_page
    let pages = 0
    let read = 0
    let added = 0
    let updated = 0
    let caughtUp = false
    const excluded: Record<string, number> = {}

    while (pages < PAGE_BUDGET) {
      const end = windowEnd(day, today)
      if (pages > 0) await wait(DELAY_MS)
      const batch = await readPage(day, end, page)
      pages++
      read += batch.length

      const rows: SightingRow[] = []
      for (const sighting of batch) {
        const result = classifySighting(sighting)
        if ('row' in result) rows.push(result.row)
        else excluded[result.excluded] = (excluded[result.excluded] ?? 0) + 1
      }
      if (rows.length) {
        const { data, error } = await supabase.rpc('apply_circl_sightings', { p_rows: rows })
        if (error) throw new Error(`apply: ${error.message}`)
        added += data?.added ?? 0
        updated += data?.updated ?? 0
      }

      const windowDone = batch.length < PER_PAGE
      if (windowDone && end >= today) {
        // Stay on today, so the next run re-reads it and picks up what arrives later.
        day = today
        page = 1
        caughtUp = true
      } else if (windowDone) {
        day = end
        page = 1
      } else {
        page++
      }

      const { error } = await supabase
        .from('circl_sightings_cursor')
        .update({ day, next_page: page, updated_at: new Date().toISOString() })
        .eq('id', 'exploited')
      if (error) throw new Error(`cursor write: ${error.message}`)
      if (caughtUp) break
    }

    return json({
      success: true,
      source: 'circl-sightings',
      pages,
      read,
      excluded,
      caught_up: caughtUp,
      cursor: { day, next_page: page },
      // The scheduler logs `added` as records_added and `updated` as records_updated.
      added,
      updated,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: 'circl-sightings', error: (e as Error).message }, 500)
  }
})
