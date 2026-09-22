/**
 * California AG breach notifications - the feed that makes Vigil less
 * ransomware-heavy.
 *
 * Every one of Vigil's 39,575 incidents is a ransomware leak-site claim, and
 * the whole non-ransomware corpus was about 500 rows. This is 5,302
 * notifications back to January 2012, filed under California Civil Code
 * 1798.29 and 1798.82, covering every cause of breach rather than ransomware
 * alone - and it is the victim's own account to a regulator, which is the same
 * class of evidence as the SEC filings it sits beside in victim_disclosures.
 *
 * A scheduled run reads the four most recent pages; the list is newest-first,
 * so that covers everything new several times over. The full 108-page walk is
 * a backfill and is not what this calls.
 *
 * US state public record, so no licence constraint - unlike ETDA, this one is
 * sellable.
 */

export async function ingestCaBreachNotices(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'ca-ag',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the ca-breach-notices function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/ca-breach-notices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ca-breach-notices function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('California breach notice ingestion error:', error.message)
    return { success: false, source: 'ca-ag', error: error.message }
  }
}
