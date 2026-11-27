/**
 * URLhaus Malware URL Ingestion
 * Cloudflare Worker version
 */

import { createInsertTally } from '../lib/inserts.js'
import { createSplitBudget, saveBatch } from './threatfox.js'

const URLHAUS_API = 'https://urlhaus-api.abuse.ch/v1/urls/recent/'

export async function ingestURLhaus(supabase, env) {
  console.log('Starting URLhaus ingestion...')

  const apiKey = env.ABUSECH_API_KEY
  if (!apiKey) {
    console.log('No ABUSECH_API_KEY configured, skipping URLhaus')
    return { success: true, source: 'urlhaus', skipped: true }
  }

  let updated = 0
  const inserts = createInsertTally()
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

    const splits = createSplitBudget()
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

      // A batch that hits the database's statement timeout is split and saved in halves
      // (23 Nov 2026 03:46 UTC: 100 URLs lost to one timeout while the run logged success).
      const saved = await saveBatch(supabase, records, splits)
      failed += saved.failed
      updated += saved.written - inserts.record(saved.inserted)
    }

  } catch (error) {
    console.error('URLhaus error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`URLhaus complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'urlhaus', added: inserts.added, updated, failed }
}
