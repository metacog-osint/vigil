/**
 * HHS Office for Civil Rights breach portal - HIPAA breach reports (192).
 *
 * Both lists, every run: Under Investigation (the last 24 months, about 700)
 * and Archive (closed or older, about 7,400, from October 2009). OCR moves
 * reports from one to the other and revises counts, so a run reads the whole
 * of both rather than the newest few, which is one 90 KB and one 5.5 MB CSV.
 * Either list failing fails the run before anything is written: accessions
 * are numbered over both lists together (_shared/hhsOcr.ts), and half of them
 * would number a split group differently.
 *
 * How the portal is read, because it has no API:
 *   1. GET the front page: a session cookie and the form's view state.
 *   2. POST the "View HIPAA Breach Reports" link: the report page.
 *   3. POST its "Export as CSV" link: the Under Investigation CSV.
 *   4. POST the ajax tab change to Archive, then the CSV link again.
 * Link ids are found by what the page says ("View HIPAA Breach Reports", the
 * CSV icon, the archive tab), not hard-coded, so a rebuilt page that numbers
 * its components differently still reads.
 *
 * The portal posts maintenance windows (one is 20-21 Nov 2026). A run during
 * one fails and the next day's run catches up; nothing is lost.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { assignAccessions, readHhsCsv, readHhsLists } from '../_shared/hhsOcr.ts'

// A site address, not a person's.
const UA = 'Vigil-ThreatIntel/1.0 (+https://vigil.theintelligence.company)'
// apply_hhs_breach_reports runs under PostgREST's 8 s statement timeout.
const CHUNK = 1000

Deno.serve(async () => {
  const started = Date.now()
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json(
      { success: false, source: 'hhs-ocr-breaches', error: 'missing SUPABASE_URL or key' },
      500
    )
  }

  try {
    const lists = await readHhsLists(UA)
    const open = readHhsCsv(lists.underInvestigation, 'under_investigation')
    const closed = readHhsCsv(lists.archive, 'archived')

    // The archive has never held fewer than several thousand; an export that
    // shrank to a handful is a broken page, not OCR deleting its history.
    if (closed.reports.length < 1000 || open.reports.length === 0) {
      throw new Error(
        `implausible lists: ${open.reports.length} under investigation, ${closed.reports.length} archived`
      )
    }

    const reports = assignAccessions([...open.reports, ...closed.reports])
    const supabase = createClient(url, key)
    const totals = { seen: 0, new: 0, changed: 0, moved_to_archive: 0, count_revised: 0 }
    let last: Record<string, unknown> = {}

    for (let i = 0; i < reports.length; i += CHUNK) {
      const { data, error } = await supabase.rpc('apply_hhs_breach_reports', {
        p_rows: reports.slice(i, i + CHUNK),
      })
      if (error) throw new Error(`apply_hhs_breach_reports, rows ${i}+: ${error.message}`)
      for (const k of Object.keys(totals) as (keyof typeof totals)[])
        totals[k] += Number(data?.[k] ?? 0)
      last = data ?? {}
    }

    return json({
      success: true,
      source: 'hhs-ocr-breaches',
      under_investigation: open.reports.length,
      archived: closed.reports.length,
      skipped_no_name_or_date: open.skipped + closed.skipped,
      ...totals,
      held_total: last.held_total ?? null,
      latest_submitted: last.latest_submitted ?? null,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({
      success: false,
      source: 'hhs-ocr-breaches',
      error: e instanceof Error ? e.message : String(e),
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
