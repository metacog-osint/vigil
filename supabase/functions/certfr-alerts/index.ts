/**
 * CERT-FR's alerts, daily (188).
 *
 * WHAT IT DOES
 *
 *   1. Reads CERT-FR's list of alerts (one request, about 400 entries, each
 *      with the date of its latest revision).
 *   2. Reads each alert that Vigil does not hold, or holds at an older
 *      revision, newest first, at most BUDGET a run.
 *   3. Upserts them into certfr_alerts as CERT-FR published them
 *      (_shared/certfr.ts). Nothing is deleted.
 *
 * A daily run reads the list and the few alerts CERT-FR opened or revised.
 *
 * BACKFILL
 *
 * A POST body {"budget": n} reads up to n alerts (at most MAX). Called by hand
 * on 19 Nov 2026 to read all 401; the worker sends no body.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { CERTFR_ORIGIN, readCertfrAlert, readCertfrList } from '../_shared/certfr.ts'

const UA = 'Vigil-ThreatIntel/1.0 (+https://vigil.theintelligence.company)'
const BUDGET = 60
const MAX = 450
const CONCURRENCY = 4
const CHUNK = 50

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getJson(path: string) {
  const response = await fetch(`${CERTFR_ORIGIN}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`)
  return await response.json()
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

Deno.serve(async (req) => {
  const started = Date.now()
  const body = await req.json().catch(() => ({}))
  const budget = Math.min(MAX, Math.max(1, Number(body?.budget) || BUDGET))
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json(
      { success: false, source: 'certfr-alerts', error: 'missing SUPABASE_URL or key' },
      500
    )
  }
  const supabase = createClient(url, key)

  try {
    const list = readCertfrList(await getJson('/alerte/json/'))
    if (list.length < 300) throw new Error(`CERT-FR listed only ${list.length} alerts`)

    const { data: heldRows, error } = await supabase
      .from('certfr_alerts')
      .select('reference, last_revision')
    if (error) throw new Error(`certfr_alerts read: ${error.message}`)
    const held = new Map<string, string | null>(
      (heldRows ?? []).map((r: { reference: string; last_revision: string | null }) => [
        r.reference,
        r.last_revision,
      ])
    )

    const due = list
      .filter((x) => {
        if (!held.has(x.reference)) return true
        const have = held.get(x.reference)
        return !have || x.last_revision_date.slice(0, 10) > have
      })
      .sort((a, b) => b.last_revision_date.localeCompare(a.last_revision_date))
    const batch = due.slice(0, budget)

    let fetchErrors = 0
    const rows = (
      await pool(batch, CONCURRENCY, async (x) => {
        try {
          const row = readCertfrAlert(await getJson(x.json_url))
          // The list's date is what `due` compares against; keep the later of
          // it and the alert's own revisions, so an alert is not re-read daily.
          const listed = x.last_revision_date.slice(0, 10)
          if (row && (!row.last_revision || listed > row.last_revision)) row.last_revision = listed
          return row
        } catch (_e) {
          fetchErrors++
          return null
        }
      })
    ).filter((r) => r !== null)

    const now = new Date().toISOString()
    const write = rows.map((r) => ({ ...r, last_seen_at: now }))
    for (let i = 0; i < write.length; i += CHUNK) {
      const { error: upsertError } = await supabase
        .from('certfr_alerts')
        .upsert(write.slice(i, i + CHUNK), { onConflict: 'reference' })
      if (upsertError) throw new Error(`certfr_alerts upsert: ${upsertError.message}`)
    }
    const added = write.filter((r) => !held.has(r.reference)).length

    return json({
      success: fetchErrors === 0,
      source: 'certfr-alerts',
      listed: list.length,
      due: due.length,
      left_for_next_run: Math.max(0, due.length - batch.length),
      fetch_errors: fetchErrors,
      ...(fetchErrors
        ? { error: `${fetchErrors} alerts could not be read; tried again next run` }
        : {}),
      // The scheduler logs `added` as records_added and `updated` as records_updated.
      added,
      updated: write.length - added,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: 'certfr-alerts', error: (e as Error).message }, 500)
  }
})
