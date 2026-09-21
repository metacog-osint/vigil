/**
 * Victim country, from a source that may be redistributed.
 *
 * ransomware.live was the only source that ever supplied victim_country and it
 * stopped on 29 May 2026; ransomlook carries none. This fills the gap from
 * ThreatCluster's Ransomware-Intel, a daily CSV marked TLP:CLEAR.
 *
 * The work happens in the threatcluster-victims Edge Function, for the same
 * reason ofac-sdn does: Workers Free allows 10 ms of CPU per invocation, and
 * parsing several thousand CSV rows with quoted fields is not a 10 ms job. The
 * measured run is about 7 seconds. This job spends one subrequest invoking it
 * and passes the function's own account of the run back to the scheduler,
 * which records the sync_log row as it does for every other feed.
 *
 * The function fills only what is empty. A victim both sources name but
 * disagree about is left exactly as it is - including that victim's incidents
 * with no country, because filling those would leave one victim with two
 * countries - and the disagreement is queued for review.
 */

export async function ingestThreatCluster(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'threatcluster',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the threatcluster-victims function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/threatcluster-victims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // The daily window. A backfill is a deliberate act, not something a cron
      // should do every day: `{"window":"365d"}` re-reads a year.
      body: JSON.stringify({ window: '90d' }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `threatcluster-victims function HTTP ${response.status}: ${body.slice(0, 200)}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error('ThreatCluster ingestion error:', error.message)
    return { success: false, source: 'threatcluster', error: error.message }
  }
}
