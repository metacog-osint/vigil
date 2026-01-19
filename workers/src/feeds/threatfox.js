/**
 * ThreatFox IOC Ingestion
 * Cloudflare Worker version
 */

const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/'

export async function ingestThreatFox(supabase, env) {
  console.log('Starting ThreatFox ingestion...')

  const apiKey = env.ABUSECH_API_KEY
  if (!apiKey) {
    console.log('No ABUSECH_API_KEY configured, skipping ThreatFox')
    return { success: true, source: 'threatfox', skipped: true }
  }

  let updated = 0
  let failed = 0

  try {
    const response = await fetch(THREATFOX_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Auth-Key': apiKey,
        'User-Agent': 'Vigil-ThreatIntel/1.0'
      },
      body: JSON.stringify({ query: 'get_iocs', days: 1 })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.query_status !== 'ok') {
      throw new Error(`ThreatFox API error: ${data.query_status}`)
    }

    const iocs = data.data || []
    console.log(`Fetched ${iocs.length} IOCs from ThreatFox`)

    const batchSize = 100
    for (let i = 0; i < iocs.length; i += batchSize) {
      const batch = iocs.slice(i, i + batchSize)

      const records = batch.map(ioc => ({
        value: ioc.ioc,
        type: mapIocType(ioc.ioc_type),
        source: 'threatfox',
        malware_family: ioc.malware_printable || ioc.malware || null,
        confidence: mapConfidence(ioc.confidence_level),
        first_seen: ioc.first_seen ? new Date(ioc.first_seen).toISOString() : null,
        last_seen: ioc.last_seen ? new Date(ioc.last_seen).toISOString() : null,
        source_url: `https://threatfox.abuse.ch/ioc/${ioc.id}/`,
        tags: ioc.tags || [],
        metadata: {
          threatfox_id: ioc.id,
          threat_type: ioc.threat_type,
          reporter: ioc.reporter,
          reference: ioc.reference
        }
      }))

      const { error } = await supabase
        .from('iocs')
        .upsert(records, { onConflict: 'type,value' })

      if (error) {
        console.error(`ThreatFox batch failed:`, error.message)
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('ThreatFox ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`ThreatFox complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'threatfox', updated, failed }
}

function mapIocType(threatfoxType) {
  const typeMap = {
    'ip:port': 'ip',
    'domain': 'domain',
    'url': 'url',
    'md5_hash': 'hash_md5',
    'sha256_hash': 'hash_sha256',
    'sha1_hash': 'hash_sha1'
  }
  return typeMap[threatfoxType] || 'unknown'
}

function mapConfidence(level) {
  if (level >= 75) return 'high'
  if (level >= 50) return 'medium'
  return 'low'
}
