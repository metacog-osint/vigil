/**
 * Washington's own record of each breach's cause, through the wa-breach-causes
 * Edge Function (migration 174). One subrequest from here; the fetch and the
 * matching happen in the function and in apply_wa_breach_causes.
 */

export async function ingestWaBreachCauses(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'wa-breach-causes',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the wa-breach-causes function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/wa-breach-causes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`wa-breach-causes function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('WA breach cause ingestion error:', error.message)
    return { success: false, source: 'wa-breach-causes', error: error.message }
  }
}
