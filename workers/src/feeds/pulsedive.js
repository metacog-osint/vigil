/**
 * Pulsedive Threat Intelligence Ingestion
 * Cloudflare Worker version
 */

const PULSEDIVE_API = 'https://pulsedive.com/api'

export async function ingestPulsedive(supabase, env) {
  console.log('Starting Pulsedive ingestion...')

  const apiKey = env.PULSEDIVE_API_KEY
  if (!apiKey) {
    console.log('No PULSEDIVE_API_KEY configured, skipping')
    return { success: true, source: 'pulsedive', skipped: true }
  }

  let updated = 0
  let failed = 0

  const indicatorTypes = ['ip', 'domain', 'url']
  const riskLevels = ['critical', 'high']

  try {
    for (const type of indicatorTypes) {
      for (const risk of riskLevels) {
        // Rate limiting
        await new Promise(r => setTimeout(r, 1500))

        const url = `${PULSEDIVE_API}/explore.php?q=risk%3D${risk}+type%3D${type}&limit=50&key=${apiKey}`

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
        })

        if (!response.ok) {
          if (response.status === 429) {
            console.log(`Rate limited on ${type}/${risk}`)
            continue
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const indicators = data.results || []

        console.log(`Fetched ${indicators.length} ${risk} ${type} indicators`)

        const now = new Date().toISOString()
        const records = indicators.map(ind => ({
          value: ind.indicator,
          type: mapIndicatorType(ind.type),
          source: 'pulsedive',
          malware_family: ind.threats?.[0] || null,
          confidence: mapRiskToConfidence(ind.risk),
          first_seen: ind.stamp_added ? new Date(ind.stamp_added).toISOString() : now,
          last_seen: ind.stamp_updated ? new Date(ind.stamp_updated).toISOString() : now,
          source_url: `https://pulsedive.com/indicator/${ind.iid}`,
          tags: ind.threats || [],
          metadata: {
            pulsedive_id: ind.iid,
            risk: ind.risk,
            risk_factors: ind.riskfactors || [],
            feeds: ind.feeds || [],
            summary: ind.summary || null
          }
        }))

        if (records.length > 0) {
          const { error } = await supabase
            .from('iocs')
            .upsert(records, { onConflict: 'type,value' })

          if (error) {
            failed += records.length
          } else {
            updated += records.length
          }
        }
      }
    }

  } catch (error) {
    console.error('Pulsedive error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Pulsedive complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'pulsedive', updated, failed }
}

function mapIndicatorType(pulsediveType) {
  const typeMap = {
    'ip': 'ip',
    'ipv6': 'ip',
    'domain': 'domain',
    'url': 'url',
    'hash': 'hash_sha256'
  }
  return typeMap[pulsediveType?.toLowerCase()] || 'unknown'
}

function mapRiskToConfidence(risk) {
  const confidenceMap = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'none': 'low'
  }
  return confidenceMap[risk?.toLowerCase()] || 'medium'
}
