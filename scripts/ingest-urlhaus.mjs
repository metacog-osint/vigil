// Abuse.ch URLhaus Ingestion
// Fetches recent malicious URLs
// Run: node scripts/ingest-urlhaus.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const URLHAUS_RECENT = 'https://urlhaus-api.abuse.ch/v1/urls/recent/'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function postRequest(url, data = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function ingestURLhaus() {
  console.log('Fetching URLhaus recent malicious URLs...')

  const response = await postRequest(URLHAUS_RECENT)

  if (response.query_status !== 'ok') {
    console.error('URLhaus API error:', response.query_status)
    return
  }

  const urls = response.urls || []
  console.log(`Found ${urls.length} malicious URLs`)

  let added = 0
  let skipped = 0
  let failed = 0

  // Process only the first 1000 to avoid timeout
  const toProcess = urls.slice(0, 1000)

  for (const entry of toProcess) {
    try {
      const record = {
        type: 'url',
        value: entry.url,
        malware_family: entry.threat || 'unknown',
        confidence: 'high',
        first_seen: entry.date_added,
        last_seen: entry.date_added,
        source: 'urlhaus',
        source_url: entry.urlhaus_link,
        tags: entry.tags || [],
        metadata: {
          urlhaus_id: entry.id,
          url_status: entry.url_status,
          host: entry.host,
          reporter: entry.reporter,
          threat: entry.threat,
        }
      }

      const { error } = await supabase
        .from('iocs')
        .upsert(record, { onConflict: 'type,value' })

      if (error) {
        if (error.code === '23505') {
          skipped++
        } else {
          failed++
          if (failed < 5) console.error(`Error:`, error.message)
        }
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log(`\nURLhaus Ingestion Complete:`)
  console.log(`  Added: ${added}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)

  // Show threat breakdown
  const threats = {}
  for (const u of urls) {
    const t = u.threat || 'unknown'
    threats[t] = (threats[t] || 0) + 1
  }
  console.log('\nThreat breakdown:')
  Object.entries(threats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([threat, count]) => console.log(`  ${threat}: ${count}`))

  await supabase.from('sync_log').insert({
    source: 'urlhaus',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: toProcess.length,
    records_added: added,
  })

  return { added, skipped, failed }
}

ingestURLhaus().catch(console.error)
