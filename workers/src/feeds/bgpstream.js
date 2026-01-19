/**
 * BGPStream - BGP Routing Anomaly Detection
 * Cloudflare Worker version
 *
 * Fetches BGP hijack and anomaly data from multiple sources
 */

// RIPE Stat API for routing data
const RIPE_STAT_API = 'https://stat.ripe.net/data'

// Known BGP hijack trackers
const BGPSTREAM_ALERTS = 'https://bgpstream.crosswork.cisco.com/api/alerts'

export async function ingestBGPStream(supabase) {
  console.log('Starting BGPStream ingestion...')

  let updated = 0
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
      // Try alternate source - use a fallback approach
      console.log(`BGPStream API returned ${response.status}, trying alternate source...`)
      return await ingestFromRIPEStat(supabase)
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

    const { error } = await supabase
      .from('iocs')
      .upsert(records, { onConflict: 'type,value' })

    if (error) {
      console.error(`BGPStream batch error: ${error.message}`)
      lastError = error.message
      failed += records.length
    } else {
      updated += records.length
    }

  } catch (error) {
    console.error('BGPStream error:', error.message)
    // Try alternate source on error
    return await ingestFromRIPEStat(supabase)
  }

  console.log(`BGPStream complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'bgpstream', updated, failed, lastError }
}

/**
 * Fallback: Fetch from RIPE Stat announced prefixes for known bad ASNs
 */
async function ingestFromRIPEStat(supabase) {
  console.log('Using RIPE Stat fallback...')

  let updated = 0
  let failed = 0

  try {
    // Known malicious/suspicious ASNs (bulletproof hosting, frequent hijackers)
    // This is a curated list - in production, this would be dynamically updated
    const suspiciousASNs = [
      '62904',  // Known bulletproof hosting
      '197540', // Known bulletproof hosting
      '48715',  // Frequently involved in spam
    ]

    const records = []

    for (const asn of suspiciousASNs.slice(0, 3)) { // Limit to avoid subrequest limits
      try {
        const response = await fetch(
          `${RIPE_STAT_API}/announced-prefixes/data.json?resource=AS${asn}`,
          { headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' } }
        )

        if (response.ok) {
          const data = await response.json()
          const prefixes = data.data?.prefixes || []

          // Create one record per ASN, aggregating all prefixes
          if (prefixes.length > 0) {
            records.push({
              value: `AS${asn}`,
              type: 'asn',
              source: 'ripe-stat',
              confidence: 'medium',
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              tags: ['bgp', 'suspicious-asn', 'bulletproof-hosting'],
              metadata: {
                announced_prefixes: prefixes.slice(0, 20).map(p => p.prefix),
                prefix_count: prefixes.length,
                asn: asn
              }
            })
          }
        }
      } catch (e) {
        console.log(`Failed to fetch ASN ${asn}: ${e.message}`)
      }
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('iocs')
        .upsert(records, { onConflict: 'type,value' })

      if (error) {
        failed = records.length
      } else {
        updated = records.length
      }
    }

  } catch (error) {
    console.error('RIPE Stat error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`RIPE Stat fallback complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'bgpstream-ripe', updated, failed }
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
