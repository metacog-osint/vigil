/**
 * EPSS scores, through the epss-scores Edge Function.
 *
 * WHAT CHANGED
 *
 * This used to read the CVE list, take the first 40 rows and refresh those -
 * the same 40 every day, because that was what the subrequest budget allowed -
 * and report success. By 26 October 2026 no CVE added to KEV in the previous
 * month had a score, and the newest score anywhere was from 20 September.
 *
 * The fetch now happens in the Edge Function: every CVE FIRST scores above
 * 0.1, plus every KEV CVE by id, written in bulk with the date of each score.
 * One subrequest from here.
 *
 * Full reasoning: supabase/migrations/158_epss_kept_current.sql
 */

export async function ingestEPSS(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'epss',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the epss-scores function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/epss-scores`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`epss-scores function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('EPSS ingestion error:', error.message)
    return { success: false, source: 'epss', error: error.message }
  }
}
