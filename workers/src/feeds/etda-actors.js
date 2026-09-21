/**
 * ETDA / ThaiCERT Threat Group Cards - where a threat actor is from.
 *
 * Vigil knew an origin country for 10.7% of its threat actors, all of it from
 * MISP Galaxy and MITRE ATT&CK. ETDA is 503 actors curated as an attribution
 * register, and it took that to 14.9%.
 *
 * **CC BY-NC-SA 4.0 - NonCommercial.** Registered in source_licences with
 * commercial_use = false, so everything it writes is excluded from
 * actor_origins_commercial. The Edge Function re-reads the licence out of the
 * API response on every run and queues a finding if it ever stops saying
 * NonCommercial.
 *
 * Weekly. ETDA's own last-db-change was 2025-08-16 when this was built, so a
 * daily fetch would be 365 requests a year to observe one change.
 */

export async function ingestEtdaActors(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'etda',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the etda-actors function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/etda-actors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`etda-actors function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('ETDA actor ingestion error:', error.message)
    return { success: false, source: 'etda', error: error.message }
  }
}
