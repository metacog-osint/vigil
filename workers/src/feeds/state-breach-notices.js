/**
 * State AG breach registries - the feed that makes Vigil less
 * ransomware-heavy.
 *
 * Every one of Vigil's 39,575 incidents is a ransomware leak-site claim, and
 * the whole non-ransomware corpus was about 500 rows. This is 8,812
 * notifications from California, Washington and Oregon, back to January 2012,
 * covering every cause of breach rather than ransomware alone - and each is
 * the victim's own account to a regulator, the same class of evidence as the
 * SEC filings they sit beside in victim_disclosures.
 *
 * A scheduled run reads the few most recent pages of each registry; the lists
 * are newest-first, so that covers everything new several times over. The full
 * walk is a backfill, requested with {"backfill": true}, and is not what this
 * calls.
 *
 * All three are US state public records, so unlike ETDA there is no licence
 * constraint - these are sellable.
 */

export async function ingestStateBreachNotices(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'state-breach-notices',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the state-breach-notices function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/state-breach-notices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `state-breach-notices function HTTP ${response.status}: ${body.slice(0, 200)}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error('California breach notice ingestion error:', error.message)
    return { success: false, source: 'state-breach-notices', error: error.message }
  }
}
