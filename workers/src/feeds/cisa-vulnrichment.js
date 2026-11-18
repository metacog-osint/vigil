/**
 * CISA's SSVC exploitation judgments from Vulnrichment, through the cisa-vulnrichment
 * Edge Function (migration 176). One subrequest from here; the GitHub reads,
 * the record fetches and the writes happen in the function.
 */

export async function ingestCisaVulnrichment(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'cisa-vulnrichment',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the cisa-vulnrichment function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/cisa-vulnrichment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`cisa-vulnrichment function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('CISA Vulnrichment ingestion error:', error.message)
    return { success: false, source: 'cisa-vulnrichment', error: error.message }
  }
}
