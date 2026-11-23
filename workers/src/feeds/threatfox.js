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
    const data = await fetchIocs(apiKey, env.THREATFOX_RETRY_WAIT_MS)
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

      const saved = await saveBatch(supabase, records)
      failed += saved.failed
      updated += saved.written - inserts.record(saved.inserted)
    }
  } catch (error) {
    console.error('ThreatFox ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`ThreatFox complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'threatfox', added: inserts.added, updated, failed, duplicates }
}

/**
 * One read of the last day's indicators, tried up to three times.
 *
 * From 05:15 to 23:45 UTC on 22 Nov 2026 ThreatFox's replies stopped part way
 * (bodies cut at 16 KiB boundaries: JSON broke at character 31,639, 47,999,
 * 64,375 or 80,735), plus one HTTP 502. 37 runs in a row failed, the feed went
 * stale, and Vigil's feed check failed twice. Most hours a second try a few
 * seconds later gets a whole reply, so a cut-off or 5xx reply is tried again.
 * An error that survives the third try is labelled as the source's, so the
 * feed check can say the problem is outside Vigil.
 */
export const SOURCE_ERROR_PREFIX = 'source: '

async function fetchIocs(apiKey, waitMs = 3000) {
  let last
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, waitMs * (attempt - 1)))
    let response
    try {
      response = await fetch(THREATFOX_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Auth-Key': apiKey,
          'User-Agent': 'Vigil-ThreatIntel/1.0',
        },
        body: JSON.stringify({ query: 'get_iocs', days: 1 }),
      })
    } catch (error) {
      if (error?.name === 'SubrequestBudgetError') throw error
      last = `ThreatFox could not be reached (${error.message})`
      continue
    }
    if (!response.ok) {
      last = `ThreatFox answered HTTP ${response.status}: ${response.statusText}`
      if (response.status >= 500 || response.status === 429) continue
      throw new Error(last) // 4xx: our key or request, not worth repeating
    }
    let data
    try {
      data = JSON.parse(await response.text())
    } catch (error) {
      last = `ThreatFox sent a cut-off or unreadable reply (${error.message})`
      continue
    }
    if (data.query_status !== 'ok') {
      throw new Error(`ThreatFox API error: ${data.query_status}`)
    }
    return data
  }
  throw new Error(`${SOURCE_ERROR_PREFIX}${last} (3 tries)`)
}

/** Postgres's code for "canceling statement due to statement timeout". */
const STATEMENT_TIMEOUT = '57014'
const SMALLEST_BATCH = 25

/**
 * Upsert one batch. A batch that runs into the 8 s statement timeout is split
 * in two and each half tried, down to SMALLEST_BATCH rows.
 *
 * Every ThreatFox run that reported failed records from 21 to 23 Nov 2026
 * (500, 323, 500, 500 and 196 rows) lined up with "canceling statement due to
 * statement timeout" in the Postgres log: a 250-row upsert, with three row
 * triggers on iocs, now and then takes longer than the 8 s that PostgREST's
 * role allows. The run still read as a success, because some batches saved.
 */
export async function saveBatch(supabase, records) {
  const { error, inserted } = await supabase
    .from('iocs')
    .upsert(stampListed(records), { onConflict: 'type,value', countInserted: true })

  if (!error) return { written: records.length, inserted, failed: 0 }
  if (error.code === STATEMENT_TIMEOUT && records.length > SMALLEST_BATCH) {
    const half = Math.ceil(records.length / 2)
    const a = await saveBatch(supabase, records.slice(0, half))
    const b = await saveBatch(supabase, records.slice(half))
    return { written: a.written + b.written, inserted: sumInserted(a.inserted, b.inserted), failed: a.failed + b.failed }
  }
  console.error(`IOC batch of ${records.length} failed:`, error.message)
  return { written: 0, inserted: 0, failed: records.length }
}

function sumInserted(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) ? a + b : undefined
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
