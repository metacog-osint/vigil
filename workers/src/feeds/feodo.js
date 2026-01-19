/**
 * Feodo Tracker C2 Ingestion
 * Cloudflare Worker version
 */

const FEODO_API = 'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json'

export async function ingestFeodo(supabase) {
  console.log('Starting Feodo C2 ingestion...')

  let updated = 0
  let failed = 0

  try {
    const response = await fetch(FEODO_API, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const entries = data || []

    console.log(`Fetched ${entries.length} C2 IPs from Feodo`)

    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)

      const records = batch.map(item => ({
        value: item.ip_address,
        type: 'ip',
        source: 'feodo',
        malware_family: item.malware || null,
        confidence: 'high',
        first_seen: item.first_seen ? new Date(item.first_seen).toISOString() : null,
        last_seen: item.last_online ? new Date(item.last_online).toISOString() : null,
        source_url: 'https://feodotracker.abuse.ch/',
        tags: [item.malware || 'botnet', 'c2'],
        metadata: {
          port: item.port,
          status: item.status,
          as_number: item.as_number,
          as_name: item.as_name,
          country: item.country
        }
      }))

      const { error } = await supabase
        .from('iocs')
        .upsert(records, { onConflict: 'type,value' })

      if (error) {
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('Feodo error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Feodo complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'feodo', updated, failed }
}
