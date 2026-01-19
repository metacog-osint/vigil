/**
 * VulnCheck KEV Ingestion
 * Cloudflare Worker version
 */

const VULNCHECK_API = 'https://api.vulncheck.com/v3'

export async function ingestVulnCheck(supabase, env) {
  console.log('Starting VulnCheck KEV ingestion...')

  const apiKey = env.VULNCHECK_API_KEY
  if (!apiKey) {
    console.log('No VULNCHECK_API_KEY configured, skipping')
    return { success: true, source: 'vulncheck', skipped: true }
  }

  let updated = 0
  let failed = 0
  let cursor = null
  let pageCount = 0
  let lastError = null
  const maxPages = 5  // Limit to stay under Cloudflare subrequest limit

  try {
    do {
      let url = `${VULNCHECK_API}/index/vulncheck-kev`
      if (cursor) url += `?cursor=${cursor}`
      pageCount++

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Vigil-ThreatIntel/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      const items = data.data || []
      cursor = data._meta?.next_cursor || null

      console.log(`Fetched ${items.length} VulnCheck KEV entries`)

      const records = items.map(item => {
        // VulnCheck returns cve as an array
        const cveId = Array.isArray(item.cve) ? item.cve[0] : item.cve
        const dateAdded = item.date_added ? item.date_added.split('T')[0] : null

        return {
          cve_id: cveId,
          description: item.shortDescription || item.description,
          exploited_in_wild: true,
          ransomware_campaign_use: item.knownRansomwareCampaignUse === 'Known',
          affected_vendors: item.vendorProject ? [item.vendorProject] : [],
          affected_products: item.product ? [item.product] : [],
          kev_date: dateAdded,
          source: 'vulncheck-kev',
          metadata: {
            title: item.vulnerabilityName,
            required_action: item.required_action,
            xdb: item.vulncheck_xdb || [],
            cwes: item.cwes || [],
            reported_exploitation: item.vulncheck_reported_exploitation || []
          }
        }
      })

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(records, { onConflict: 'cve_id' })

      if (error) {
        console.error(`VulnCheck batch error:`, JSON.stringify(error))
        lastError = error.message || JSON.stringify(error)
        failed += items.length
      } else {
        updated += items.length
      }

    } while (cursor && pageCount < maxPages)

  } catch (error) {
    console.error('VulnCheck error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`VulnCheck complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'vulncheck', updated, failed, lastError }
}

function mapSeverity(cvssScore) {
  if (!cvssScore) return 'medium'
  if (cvssScore >= 9.0) return 'critical'
  if (cvssScore >= 7.0) return 'high'
  if (cvssScore >= 4.0) return 'medium'
  return 'low'
}

function determineExploitMaturity(item) {
  if (item.known_ransomware_campaign_use === 'Known') return 'weaponized'
  if (item.xdb && item.xdb.length > 0) return 'poc'
  if (item.in_the_wild) return 'active'
  return 'reported'
}
