/**
 * NCSC-UK news - a second government attributing independently.
 *
 * CISA alone means "attributed to Russia" is really "the United States said
 * so". NCSC publishes its own attributions - "UK and partners expose Russian
 * state-supported actors", "spyware used by Iranian state actors" - and the
 * map can now show when two allied governments named the same country
 * separately rather than one naming it twice.
 *
 * As with the other Edge Function feeds, this is one subrequest from here and
 * the parse happens where there is CPU for it.
 *
 * Of the four national CERTs the coverage analysis proposed, this is the only
 * one that carries attribution. CERT-EU, CCCS and JPCERT publish vulnerability
 * notices; the reasoning and the evidence are in migration 132.
 */

export async function ingestNcscAdvisories(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'ncsc-uk',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the ncsc-advisories function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/ncsc-advisories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ncsc-advisories function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('NCSC advisory ingestion error:', error.message)
    return { success: false, source: 'ncsc-uk', error: error.message }
  }
}
