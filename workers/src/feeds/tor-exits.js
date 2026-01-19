/**
 * Tor Exit Nodes Ingestion
 * Cloudflare Worker version
 */

const TOR_EXIT_URL = 'https://check.torproject.org/torbulkexitlist'

export async function ingestTorExits(supabase) {
  console.log('Starting Tor exit nodes ingestion...')

  let updated = 0
  let failed = 0

  try {
    const response = await fetch(TOR_EXIT_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
    const ips = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && /^\d+\.\d+\.\d+\.\d+$/.test(line))

    console.log(`Fetched ${ips.length} Tor exit nodes`)

    const now = new Date().toISOString()
    const batchSize = 200
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize)

      const records = batch.map(ip => ({
        type: 'ip',
        value: ip,
        malware_family: null,
        confidence: 'high',
        first_seen: now,
        last_seen: now,
        source: 'tor_project',
        source_url: 'https://check.torproject.org/torbulkexitlist',
        tags: ['tor', 'exit-node', 'anonymization'],
        metadata: {
          network_type: 'tor_exit',
          note: 'Current Tor network exit node'
        }
      }))

      const { error } = await supabase
        .from('iocs')
        .upsert(records, { onConflict: 'type,value' })

      if (error) {
        console.error(`Batch ${i}-${i+batch.length} failed:`, error.message)
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('Tor exits error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Tor exits complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'tor-exits', updated, failed }
}
