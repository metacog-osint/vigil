/**
 * SEC 8-K Item 1.05 - what the victim told its regulator.
 *
 * WHY THIS SOURCE IS UNLIKE THE OTHERS
 *
 * Every incident Vigil holds is the attacker's claim. The README says so, the
 * Help page says so, and ThreatCluster says it of its own data: "Everything is
 * the group's claim, not a confirmed breach." No leak-site feed can do better,
 * because the only party with an interest in publishing is the one making the
 * accusation.
 *
 * Since December 2023 an SEC registrant has had to report a material
 * cybersecurity incident on Form 8-K under Item 1.05, within four business
 * days. It is filed by the victim, under penalty, to a regulator. It is public
 * domain and free.
 *
 * That is corroboration, and it is the one thing no amount of leak-site
 * coverage buys.
 *
 * MEASURED FIRST
 *
 * 101 Item 1.05 filings exist in total - the whole population since the rule
 * took effect - from 72 distinct companies. 11 of those 72 are organisations a
 * ransomware group has also claimed, which produced 17 candidate pairs.
 *
 * Several of those companies disclosed *before* the group posted: Krispy Kreme
 * filed eight days ahead of Play's listing, Key Tronic twenty-one days ahead of
 * Black Basta's. That difference is a measurable statistic and nobody appears
 * to publish it.
 *
 * WHAT IS INGESTED AND WHAT IS NOT
 *
 * The filings are facts: they exist, they are dated, they are citable, and they
 * are stored automatically. Whether a filing corroborates a particular claim is
 * a judgment call - Stryker filed in April 2026 and was claimed by Qilin in
 * July, which may be two unrelated incidents - so every match is queued for
 * review and none is applied.
 *
 * COURTESY
 *
 * SEC asks for a User-Agent identifying the requester and no more than ten
 * requests a second. This makes two, once a day.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const EDGAR = 'https://efts.sec.gov/LATEST/search-index'
const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'
const PAGE = 100

interface Filing {
  accession: string
  company_name: string
  cik: string | null
  filed_date: string
  form: string
  items: string[]
  business_location: string | null
  filing_url: string
}

/** EDGAR renders a name as "AMGEN INC  (AMGN)  (CIK 0000318154)". */
export function cleanName(display: string): string {
  return display.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

/** The filing's own page, built from the accession number. */
export function filingUrl(cik: string, accession: string, file: string): string {
  const bare = accession.replace(/-/g, '')
  const c = String(Number(cik))
  return `https://www.sec.gov/Archives/edgar/data/${c}/${bare}/${file}`
}

export function toFilings(hits: Array<Record<string, any>>): Filing[] {
  const out: Filing[] = []

  for (const h of hits) {
    const s = h._source ?? {}
    const cik = s.ciks?.[0] ?? null
    const accession = s.adsh
    if (!accession || !s.display_names?.[0]) continue

    // _id is "<accession>:<file>" - the second half names the document.
    const file = String(h._id ?? '').split(':')[1] ?? ''

    out.push({
      accession,
      company_name: cleanName(s.display_names[0]),
      cik,
      filed_date: s.file_date,
      form: s.form ?? '8-K',
      items: s.items ?? [],
      business_location: s.biz_locations?.[0] ?? null,
      filing_url:
        cik && file
          ? filingUrl(cik, accession, file)
          : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
    })
  }

  return out
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'sec-edgar', error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    const filings: Filing[] = []

    // The whole population is about a hundred filings, so two pages covers it.
    // If it ever exceeds that, `fetched` in the result makes the shortfall
    // visible rather than silent.
    for (const from of [0, PAGE]) {
      const res = await fetch(`${EDGAR}?q=%22Item%201.05%22&forms=8-K&from=${from}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}: ${res.statusText}`)

      const body = await res.json()
      const hits = body?.hits?.hits ?? []
      filings.push(...toFilings(hits))
      if (hits.length < PAGE) break
    }

    if (filings.length === 0) {
      // EDGAR never legitimately returns nothing for this query. An empty
      // result means the endpoint or the query has changed shape.
      throw new Error('EDGAR returned no Item 1.05 filings, which it never legitimately does')
    }

    // Full-text search matches a filing that merely mentions Item 1.05 - 18 of
    // the 101 did. The structured `items` field is the real answer.
    const cyber = filings.filter((f) => f.items.length === 0 || f.items.includes('1.05'))

    const { data, error } = await supabase.rpc('apply_victim_disclosures', { p_rows: cyber })
    if (error) throw new Error(`apply_victim_disclosures failed: ${error.message}`)

    return json({
      success: true,
      source: 'sec-edgar',
      fetched: filings.length,
      item_105: cyber.length,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: 'sec-edgar',
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
