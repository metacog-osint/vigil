/**
 * CERT-FR's alerts, kept as CERT-FR's notices, through the certfr-alerts
 * Edge Function (migration 188). One subrequest from here; the reads,
 * the parsing and the writes happen in the function.
 */

export async function ingestCertfrAlerts(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'certfr-alerts',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the certfr-alerts function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/certfr-alerts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`certfr-alerts function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('CERT-FR alerts ingestion error:', error.message)
    return { success: false, source: 'certfr-alerts', error: error.message }
  }
}
