/**
 * EPSS (Exploit Prediction Scoring System) Ingestion
 * Cloudflare Worker version
 */

const EPSS_API = 'https://api.first.org/data/v1/epss'

export async function ingestEPSS(supabase) {
  console.log('Starting EPSS ingestion...')

  let updated = 0
  let failed = 0

  try {
    // Fetch high-risk CVEs (EPSS > 0.1)
    // Also update any CVEs we already have
    const { data: existingCVEs } = await supabase
      .from('vulnerabilities')
      .select('cve_id')

    // Limit to 40 CVEs to stay under Cloudflare's 50 subrequest limit
    // (1 fetch for CVEs + 1 fetch for EPSS + up to 40 updates + buffer)
    const cveIds = existingCVEs?.map(v => v.cve_id).slice(0, 40) || []

    if (cveIds.length === 0) {
      console.log('No CVEs to update EPSS for')
      return { success: true, source: 'epss', updated: 0, failed: 0 }
    }

    // Batch CVEs for API calls (max 100 per request)
    const batchSize = 100
    for (let i = 0; i < cveIds.length; i += batchSize) {
      const batch = cveIds.slice(i, i + batchSize)
      const cveParam = batch.join(',')

      const response = await fetch(`${EPSS_API}?cve=${cveParam}`, {
        headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
      })

      if (!response.ok) {
        console.error(`EPSS API error: ${response.status}`)
        continue
      }

      const data = await response.json()
      const scores = data.data || []

      // Update each score
      for (const score of scores) {
        const { error } = await supabase
          .from('vulnerabilities')
          .update({
            epss_score: parseFloat(score.epss),
            epss_percentile: parseFloat(score.percentile)
          })
          .eq('cve_id', score.cve)

        if (error) {
          failed++
        } else {
          updated++
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 100))
    }

  } catch (error) {
    console.error('EPSS error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`EPSS complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'epss', updated, failed }
}
