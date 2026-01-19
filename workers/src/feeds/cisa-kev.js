/**
 * CISA Known Exploited Vulnerabilities (KEV) Ingestion
 * Cloudflare Worker version
 */

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

export async function ingestCISAKEV(supabase) {
  console.log('Starting CISA KEV ingestion...')

  let added = 0
  let updated = 0
  let failed = 0

  try {
    // Fetch KEV catalog
    const response = await fetch(CISA_KEV_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const vulnerabilities = data.vulnerabilities || []

    console.log(`Fetched ${vulnerabilities.length} KEV entries`)

    // Process in batches of 50
    const batchSize = 50
    for (let i = 0; i < vulnerabilities.length; i += batchSize) {
      const batch = vulnerabilities.slice(i, i + batchSize)

      const records = batch.map(vuln => ({
        cve_id: vuln.cveID,
        description: vuln.shortDescription,
        affected_vendors: vuln.vendorProject ? [vuln.vendorProject] : [],
        affected_products: vuln.product ? [vuln.product] : [],
        kev_date: vuln.dateAdded || null,
        kev_due_date: vuln.dueDate || null,
        ransomware_campaign_use: vuln.knownRansomwareCampaignUse === 'Known',
        exploited_in_wild: true,
        source: 'cisa-kev',
        metadata: {
          title: vuln.vulnerabilityName,
          required_action: vuln.requiredAction,
          notes: vuln.notes,
          cwe: vuln.cweID
        }
      }))

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(records, { onConflict: 'cve_id' })

      if (error) {
        console.error(`Batch error: ${error.message}`)
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('CISA KEV ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`CISA KEV complete: ${updated} updated, ${failed} failed`)

  return {
    success: true,
    source: 'cisa-kev',
    updated,
    failed
  }
}

function mapSeverity(vuln) {
  // CISA KEV doesn't include CVSS, so we infer from ransomware use
  if (vuln.knownRansomwareCampaignUse === 'Known') return 'critical'
  return 'high' // All KEV entries are high severity by definition
}
