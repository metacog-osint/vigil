/**
 * URLhaus Malware URL Ingestion
 * Cloudflare Worker version
 */

const URLHAUS_API = 'https://urlhaus-api.abuse.ch/v1/urls/recent/'

export async function ingestURLhaus(supabase, env) {
  console.log('Starting URLhaus ingestion...')

  const apiKey = env.ABUSECH_API_KEY
  if (!apiKey) {
    console.log('No ABUSECH_API_KEY configured, skipping URLhaus')
    return { success: true, source: 'urlhaus', skipped: true }
  }

  let updated = 0
  let failed = 0

  try {
    const response = await fetch(URLHAUS_API, {
      headers: {
        'Auth-Key': apiKey,
        'User-Agent': 'Vigil-ThreatIntel/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const urls = data.urls || []

    console.log(`Fetched ${urls.length} URLs from URLhaus`)

    const batchSize = 100
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)

      const records = batch.map(item => ({
        value: item.url,
        type: 'url',
        source: 'urlhaus',
        malware_family: item.threat || null,
        confidence: 'high',
        first_seen: item.dateadded ? new Date(item.dateadded).toISOString() : null,
        last_seen: item.dateadded ? new Date(item.dateadded).toISOString() : null,
        source_url: item.urlhaus_link,
        tags: item.tags || [],
        metadata: {
          urlhaus_id: item.id,
          url_status: item.url_status,
          host: item.host,
          reporter: item.reporter
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
    console.error('URLhaus error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`URLhaus complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'urlhaus', updated, failed }
}
