/**
 * ThreatFox IOC Ingestion
 * Cloudflare Worker version
 */

import { createInsertTally } from '../lib/inserts.js'
import { stampListed } from '../lib/sightings.js'

const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/'

export async function ingestThreatFox(supabase, env) {
  console.log('Starting ThreatFox ingestion...')

  const apiKey = env.ABUSECH_API_KEY
  if (!apiKey) {
    console.log('No ABUSECH_API_KEY configured, skipping ThreatFox')
    return { success: true, source: 'threatfox', skipped: true }
  }

  let updated = 0
  const inserts = createInsertTally()
  let failed = 0
  let duplicates = 0

  try {
    const response = await fetch(THREATFOX_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Auth-Key': apiKey,
        'User-Agent': 'Vigil-ThreatIntel/1.0',
      },
      body: JSON.stringify({ query: 'get_iocs', days: 1 }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.query_status !== 'ok') {
      throw new Error(`ThreatFox API error: ${data.query_status}`)
    }

    const fetched = data.data || []
    const iocs = latestPerKey(fetched)
    duplicates = fetched.length - iocs.length
    console.log(`Fetched ${fetched.length} IOCs from ThreatFox (${duplicates} duplicates dropped)`)

    const batchSize = 250 // see cisa-kev.js on batch size and subrequests
    for (let i = 0; i < iocs.length; i += batchSize) {
      const batch = iocs.slice(i, i + batchSize)

      const records = batch.map((ioc) => ({
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
          reference: ioc.reference,
        },
      }))

      const { error, inserted } = await supabase
        .from('iocs')
        .upsert(stampListed(records), { onConflict: 'type,value', countInserted: true })

      if (error) {
        console.error(`ThreatFox batch failed:`, error.message)
        failed += batch.length
      } else {
        updated += batch.length - inserts.record(inserted)
      }
    }
  } catch (error) {
    console.error('ThreatFox ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`ThreatFox complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'threatfox', added: inserts.added, updated, failed, duplicates }
}

/**
 * One entry per indicator as Vigil keys it (type, value), the most recently seen.
 *
 * ThreatFox can list the same indicator twice in a day (two reports, two
 * malware families). Both rows in one upsert make Postgres refuse the whole
 * statement ("ON CONFLICT DO UPDATE command cannot affect row a second time"),
 * so one duplicate cost a batch of 250 at 18:15 and 19:15 UTC on 18 Nov 2026.
 * On a tie in last_seen (or first_seen), the later entry in the list wins.
 */
export function latestPerKey(iocs) {
  const seen = (ioc) => Date.parse(ioc.last_seen || ioc.first_seen || '') || 0
  const byKey = new Map()
  for (const ioc of iocs) {
    const key = `${mapIocType(ioc.ioc_type)}|${ioc.ioc}`
    const kept = byKey.get(key)
    if (!kept || seen(ioc) >= seen(kept)) byKey.set(key, ioc)
  }
  return [...byKey.values()]
}

function mapIocType(threatfoxType) {
  const typeMap = {
    'ip:port': 'ip',
    domain: 'domain',
    url: 'url',
    md5_hash: 'hash_md5',
    sha256_hash: 'hash_sha256',
    sha1_hash: 'hash_sha1',
  }
  return typeMap[threatfoxType] || 'unknown'
}

function mapConfidence(level) {
  if (level >= 75) return 'high'
  if (level >= 50) return 'medium'
  return 'low'
}
