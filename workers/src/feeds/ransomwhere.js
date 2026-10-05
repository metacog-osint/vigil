/**
 * Ransom payments, from the Zenodo deposit rather than the API that died.
 *
 * WHAT CHANGED
 *
 * This used to fetch api.ransomwhe.re/export directly and parse it here. That
 * endpoint has returned HTTP 502 since 20 September 2026 - verified from
 * outside the worker, where the export path 502s, api.ransomwhe.re answers 403
 * and ransomwhe.re serves 200 and still links to the same URL. The service is
 * broken, it has not moved, and it is not ours to fix. Fourteen days of that
 * left ransomware_payments holding 13 rows.
 *
 * The same dataset is deposited on Zenodo under CC-BY-4.0, which is the first
 * ransom-payment source Vigil could sell: 11,178 addresses, 136 families,
 * 21,790 transactions. The fetch and the aggregation happen in the
 * ransomwhere-archive Edge Function, where there is CPU for 5.5 MB of JSON.
 * One subrequest from here.
 *
 * WHY WEEKLY, AND WHY THAT IS NOT A DOWNGRADE
 *
 * The deposit only changes when a new version is published, so a daily run
 * would re-import an identical file. The function compares the version against
 * feed_cursors and skips the download when it matches, so most runs cost one
 * subrequest and no bandwidth.
 *
 * WHAT THIS DOES NOT RESTORE
 *
 * Current payments. v1.1.0 ends in August 2024. Every row records
 * snapshot_version and snapshot_published so the age of the data is visible
 * rather than the age of the import - a feed reporting itself fresh while
 * serving two-year-old figures is the failure this project exists to avoid.
 *
 * Full reasoning: supabase/migrations/152_ransomwhere_archive.sql
 */

export async function ingestRansomwhere(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'ransomwhere',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the ransomwhere-archive function',
    }
  }

  try {
    // No ?force=1. A scheduled run should skip an unchanged deposit; forcing a
    // re-import is a manual act, for when the aggregation itself has changed.
    const response = await fetch(`${url}/functions/v1/ransomwhere-archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ransomwhere-archive function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Ransomwhere archive ingestion error:', error.message)
    return { success: false, source: 'ransomwhere', error: error.message }
  }
}
