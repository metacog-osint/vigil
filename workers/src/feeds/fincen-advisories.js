/**
 * FinCEN's register of alerts, advisories, notices and bulletins.
 *
 * The first source Vigil ingests that exists to tell financial institutions
 * what to look for rather than to say what happened. FIN-2023-Alert005 is the
 * pig-butchering alert; FIN-2026-Alert005 is "Money Laundering Activity
 * Associated with Digital Asset Investment Scam Centers", published three
 * weeks before this feed was written.
 *
 * As with the other Edge Function feeds, this is one subrequest from here and
 * the parse happens where there is CPU for it. It needs to be: FinCEN has no
 * RSS, so the register is eleven pages of HTML and a routine run reads three
 * of them.
 *
 * This ingests the register, not the indicators. The red flags are inside the
 * PDFs, and reading one is queued for a person rather than parsed - see
 * review_regulatory_advisories() and migration 147.
 */

export async function ingestFincenAdvisories(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'fincen',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the fincen-advisories function',
    }
  }

  try {
    // No ?full=1. The whole archive is eleven fetches and takes nearly two
    // minutes; a scheduled run reads the register and the newest archive
    // pages, which is where anything new appears. A backfill is run by hand.
    const response = await fetch(`${url}/functions/v1/fincen-advisories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`fincen-advisories function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('FinCEN advisory ingestion error:', error.message)
    return { success: false, source: 'fincen', error: error.message }
  }
}
