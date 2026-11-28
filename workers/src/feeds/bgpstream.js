/**
 * BGPStream - BGP Routing Anomaly Detection
 * Cloudflare Worker version
 *
 * Fetches BGP hijack, leak and outage events from Cisco Crosswork (formerly BGPStream).
 * A run that cannot read Crosswork writes nothing and reports a failure, so sync_log and
 * feed health show it.
 */

import { createInsertTally } from '../lib/inserts.js'

// Known BGP hijack trackers
const BGPSTREAM_ALERTS = 'https://bgpstream.crosswork.cisco.com/api/alerts'

export async function ingestBGPStream(supabase) {
  console.log('Starting BGPStream ingestion...')

  let updated = 0
  const inserts = createInsertTally()
  let failed = 0
  let lastError = null

  try {
    // Fetch recent BGP alerts from Cisco Crosswork (formerly BGPStream)
    // This is a public API that tracks BGP hijacks, leaks, and outages
    const response = await fetch('https://bgpstream.crosswork.cisco.com/api/events?limit=100', {
      headers: {
        'User-Agent': 'Vigil-ThreatIntel/1.0',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(`BGPStream API returned ${response.status}; nothing written`)
      return { success: false, source: 'bgpstream', error: `HTTP ${response.status} from Crosswork` }
    }

    const data = await response.json()
    const events = data.events || data.data || data || []

    console.log(`Fetched ${events.length} BGP events`)

    if (events.length === 0) {
      return { success: true, source: 'bgpstream', updated: 0, skipped: true }
    }

    // Process BGP events
    const records = events.slice(0, 50).map(event => ({
      value: event.prefix || event.victim_prefix || event.as_path?.[0] || 'unknown',
      type: 'asn',
      source: 'bgpstream',
      confidence: mapConfidence(event.type),
      first_seen: event.start_time || event.detected_at || new Date().toISOString(),
      last_seen: event.end_time || event.detected_at || new Date().toISOString(),
      tags: [
        'bgp',
        event.type?.toLowerCase() || 'anomaly',
        event.country_code
      ].filter(Boolean),
      metadata: {
        event_type: event.type, // hijack, leak, outage
        victim_as: event.victim_as,
        attacker_as: event.attacker_as,
        prefix: event.prefix,
        as_path: event.as_path,
        country: event.country_code,
        duration_seconds: event.duration,
        source_url: event.url || `https://bgpstream.crosswork.cisco.com/event/${event.id}`
      }
    }))

    const { error, inserted } = await supabase
      .from('iocs')
      .upsert(records, { onConflict: 'type,value', countInserted: true })

    if (error) {
      console.error(`BGPStream batch error: ${error.message}`)
      lastError = error.message
      failed += records.length
    } else {
      updated += records.length - inserts.record(inserted)
    }

  } catch (error) {
    console.error('BGPStream error:', error.message)
    return { success: false, source: 'bgpstream', error: error.message }
  }

  console.log(`BGPStream complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'bgpstream', added: inserts.added, updated, failed, lastError }
}

function mapConfidence(eventType) {
  switch (eventType?.toLowerCase()) {
    case 'hijack':
      return 'high'
    case 'leak':
      return 'medium'
    case 'outage':
      return 'low'
    default:
      return 'medium'
  }
}
