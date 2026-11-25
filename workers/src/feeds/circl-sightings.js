/**
 * Reported exploitation from CIRCL sightings, through the circl-sightings Edge
 * Function (migration 194). One subrequest from here; the CIRCL reads, the
 * allow-list and the writes happen in the function.
 */

export async function ingestCirclSightings(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'circl-sightings',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the circl-sightings function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/circl-sightings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`circl-sightings function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('CIRCL sightings ingestion error:', error.message)
    return { success: false, source: 'circl-sightings', error: error.message }
  }
}
