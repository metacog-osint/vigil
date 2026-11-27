/**
 * Washington's own record of each breach's cause (migration 174).
 *
 * Vigil's state feed (state-breach-notices) reads the Attorney General's web
 * page, which gives no cause. The same notices are published as an open
 * dataset on data.wa.gov (sb4j-ca4h), and that dataset records the cause:
 * databreachcause and cyberattacktype. This reads the whole dataset (about
 * 1,700 rows, one request) and hands the two fields to apply_wa_breach_causes,
 * which writes them onto Vigil's own wa-ag notice rows by name and date.
 *
 * It decides nothing about any claim. The cause is shown on the review card as
 * the Attorney General's record; the verdict stays a person's.
 *
 * The dataset states no licence. Approval was given to store and show these two
 * fields, credited to the Attorney General, on 16 Nov 2026 (source_licences
 * row wa-ag-open-data).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DATASET =
  'https://data.wa.gov/resource/sb4j-ca4h.json' +
  '?$select=name,datesubmitted,databreachcause,cyberattacktype&$limit=50000'
const UA = 'Vigil Threat Intelligence (vigil.theintelligence.company)'
const APPLY_CHUNK = 1000

interface DatasetRow {
  name?: string
  datesubmitted?: string
  databreachcause?: string
  cyberattacktype?: string
}

export interface CauseRow {
  name: string
  submitted: string
  cause: string | null
  attack_type: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Rows with no name or no submission date cannot be matched and are dropped. */
export function toRows(data: DatasetRow[]): CauseRow[] {
  const rows: CauseRow[] = []
  for (const r of data ?? []) {
    const name = (r.name ?? '').trim()
    const submitted = (r.datesubmitted ?? '').slice(0, 10)
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(submitted)) continue
    rows.push({
      name,
      submitted,
      cause: r.databreachcause?.trim() || null,
      attack_type: r.cyberattacktype?.trim() || null,
    })
  }
  return rows
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'wa-breach-causes', error: 'missing SUPABASE_URL or key' }, 500)
  }
  const supabase = createClient(url, key)

  try {
    const response = await fetch(DATASET, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    })
    if (!response.ok) throw new Error(`data.wa.gov HTTP ${response.status}`)
    const rows = toRows(await response.json())
    if (rows.length === 0) throw new Error('data.wa.gov returned no usable rows')

    let updated = 0
    let withCause = 0
    for (let i = 0; i < rows.length; i += APPLY_CHUNK) {
      const { data, error } = await supabase.rpc('apply_wa_breach_causes', {
        p_rows: rows.slice(i, i + APPLY_CHUNK),
      })
      if (error) throw new Error(`apply_wa_breach_causes: ${error.message}`)
      updated += Number(data?.updated ?? 0)
      withCause = Number(data?.with_cause ?? withCause)
    }

    const latest = rows.map((r) => r.submitted).sort().at(-1) ?? null
    return json({
      success: true,
      source: 'wa-breach-causes',
      dataset_rows: rows.length,
      latest_submitted: latest,
      // The scheduler logs `updated` as records_updated.
      updated,
      notices_with_cause: withCause,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: 'wa-breach-causes', error: (e as Error).message }, 500)
  }
})
