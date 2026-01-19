/**
 * NVD (National Vulnerability Database) Ingestion
 * Cloudflare Worker version
 *
 * Note: NVD API has rate limits. We fetch only recent CVEs.
 */

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

export async function ingestNVD(supabase) {
  console.log('Starting NVD ingestion...')

  let updated = 0
  let failed = 0
  let lastError = null

  try {
    // Fetch CVEs from last 7 days
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const pubStartDate = weekAgo.toISOString().split('.')[0] + 'Z'
    const pubEndDate = now.toISOString().split('.')[0] + 'Z'

    const url = `${NVD_API}?pubStartDate=${pubStartDate}&pubEndDate=${pubEndDate}`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const vulnerabilities = data.vulnerabilities || []

    console.log(`Fetched ${vulnerabilities.length} CVEs from NVD`)

    const batchSize = 50
    for (let i = 0; i < vulnerabilities.length; i += batchSize) {
      const batch = vulnerabilities.slice(i, i + batchSize)

      const records = batch.map(item => {
        const cve = item.cve
        const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0]
        const cvssScore = metrics?.cvssData?.baseScore || null
        const cvssVector = metrics?.cvssData?.vectorString || null
        const vendor = cve.configurations?.[0]?.nodes?.[0]?.cpeMatch?.[0]?.criteria?.split(':')[3] || null
        const product = cve.configurations?.[0]?.nodes?.[0]?.cpeMatch?.[0]?.criteria?.split(':')[4] || null

        return {
          cve_id: cve.id,
          description: cve.descriptions?.find(d => d.lang === 'en')?.value || null,
          cvss_score: cvssScore,
          cvss_vector: cvssVector,
          affected_vendors: vendor ? [vendor] : [],
          affected_products: product ? [product] : [],
          source: 'nvd',
          metadata: {
            published: cve.published,
            lastModified: cve.lastModified,
            vulnStatus: cve.vulnStatus,
            weaknesses: cve.weaknesses?.map(w => w.description?.[0]?.value) || [],
            references: cve.references?.map(r => r.url) || []
          }
        }
      })

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(records, { onConflict: 'cve_id' })

      if (error) {
        console.error(`NVD batch error: ${error.message}`, error)
        lastError = error.message || JSON.stringify(error)
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('NVD error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`NVD complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'nvd', updated, failed, lastError }
}

function mapSeverity(cvssScore) {
  if (!cvssScore) return 'medium'
  if (cvssScore >= 9.0) return 'critical'
  if (cvssScore >= 7.0) return 'high'
  if (cvssScore >= 4.0) return 'medium'
  return 'low'
}
