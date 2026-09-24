/**
 * FinCEN's register of what it has told financial institutions to watch for.
 *
 * WHAT THIS IS FOR
 *
 * FinCEN alerts are not news. They are typology plus red-flag indicators,
 * written for institutions with a legal obligation to act on them.
 * FIN-2023-Alert005 is the pig-butchering alert; FIN-2026-Alert005 is "Money
 * Laundering Activity Associated with Digital Asset Investment Scam Centers".
 *
 * WHY IT PARSES HTML
 *
 * There is no feed. /rss.xml and /news-room/rss both return 404, checked
 * 24 September 2026. The register is server-rendered HTML - 58KB, with the
 * identifiers in it - so it is parsable without a browser, which is the only
 * reason this is an Edge Function rather than an abandoned idea.
 *
 * TWO PAGES, TWO SHAPES
 *
 * The main register carries Alerts, Notices, and Bulletins and Fact Sheets as
 * plain tables, each row linking straight to a PDF. Its "Recent Advisories"
 * section is not a table at all, so the advisory archive is read separately -
 * a Drupal view, fourteen rows to a page, linking to landing pages rather than
 * PDFs, with the date in a <time datetime> rather than as text.
 *
 * Writing one parser for both would mean a parser that is wrong about each of
 * them in a different way. There are two.
 *
 * WHAT IS NOT EXTRACTED
 *
 * The red-flag indicators. They are inside the PDFs, they are the valuable
 * part, and turning a paragraph of prose into a structured indicator is a
 * judgment. `indicators_read` stays false and review_regulatory_advisories()
 * queues the fraud-relevant ones for a person.
 *
 * Nor is a subject. FinCEN's own title is stored and nothing infers a topic
 * from it.
 *
 * Full reasoning: supabase/migrations/147_fincen_advisories.sql
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import {
  REGISTER,
  ARCHIVE,
  ARCHIVE_PAGES,
  ARCHIVE_PAGES_SHALLOW,
  UA,
  SOURCE,
  type Row,
  parseRegister,
  parseArchive,
  dedupe,
} from '../_shared/fincen.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const started = Date.now()

  // ?full=1 walks the whole archive. Everything else reads the register and the
  // first two archive pages, which is where anything new appears.
  const full = new URL(req.url).searchParams.get('full') === '1'
  const pages = full ? ARCHIVE_PAGES : ARCHIVE_PAGES_SHALLOW

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: SOURCE, error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    const get = async (target: string) => {
      const res = await fetch(target, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`${target} returned HTTP ${res.status}`)
      return await res.text()
    }

    const rows: Row[] = parseRegister(await get(REGISTER))

    // The archive is paged. A page that 404s or comes back empty ends the walk
    // rather than failing the run: the archive is finite and its length is not
    // something this function should hardcode.
    for (let page = 0; page < pages; page++) {
      let parsed: Row[] = []
      try {
        parsed = parseArchive(await get(page === 0 ? ARCHIVE : `${ARCHIVE}?page=${page}`))
      } catch {
        break
      }
      if (parsed.length === 0) break
      rows.push(...parsed)
    }

    const unique = dedupe(rows)

    // An empty parse here IS a failure, unlike the NCSC feed. The register is a
    // static archive going back to 2007 - measured, by walking it to the last
    // page - so if it reads as empty the markup changed and the parser is
    // wrong.
    if (unique.length === 0) {
      throw new Error('parsed 0 rows from the FinCEN register - the markup has probably changed')
    }

    const { data, error } = await supabase.rpc('apply_regulatory_advisories', {
      p_rows: unique,
      p_source: SOURCE,
    })
    if (error) throw new Error(`apply_regulatory_advisories failed: ${error.message}`)

    return json({
      success: true,
      source: SOURCE,
      parsed: unique.length,
      archive: full ? 'full' : 'recent',
      ...((data as Record<string, unknown>) ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json(
      { success: false, source: SOURCE, error: (error as Error).message, ms: Date.now() - started },
      500
    )
  }
})
