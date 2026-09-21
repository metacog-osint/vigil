/**
 * SEC 8-K Item 1.05 - what the victim told its regulator.
 *
 * Every incident Vigil holds is the attacker's claim. Since December 2023 a
 * registrant has had to report a material cybersecurity incident within four
 * business days, filed by the victim under penalty. That is the one
 * corroboration no leak-site feed can supply at any price.
 *
 * The work happens in the sec-cyber-disclosures Edge Function, for the same
 * reason ofac-sdn and threatcluster do: this job spends one subrequest, and
 * the parse and the matching happen where there is CPU to do them.
 *
 * Filings are ingested as facts. Whether a filing corroborates a particular
 * claim is a judgment call - Stryker filed in April and was claimed in July,
 * which may be two different incidents - so matches are queued for review and
 * never applied.
 */

export async function ingestSecDisclosures(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'sec-edgar',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the sec-cyber-disclosures function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/sec-cyber-disclosures`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `sec-cyber-disclosures function HTTP ${response.status}: ${body.slice(0, 200)}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error('SEC disclosure ingestion error:', error.message)
    return { success: false, source: 'sec-edgar', error: error.message }
  }
}
