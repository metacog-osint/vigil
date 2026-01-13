// Abuse.ch Feodo Tracker Ingestion
// Fetches botnet C2 server IPs
// Run: node scripts/ingest-feodo.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const FEODO_RECENT = 'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function ingestFeodo() {
  console.log('Fetching Feodo Tracker botnet C2 IPs...')

  const entries = await fetch(FEODO_RECENT)

  if (!Array.isArray(entries)) {
    console.error('Unexpected response format')
    return
  }

  console.log(`Found ${entries.length} botnet C2 entries`)

  let added = 0
  let skipped = 0
  let failed = 0

  for (const entry of entries) {
    try {
      const record = {
        type: 'ip',
        value: entry.ip_address,
        malware_family: entry.malware,
        confidence: 'high',
        first_seen: entry.first_seen,
        last_seen: entry.last_online || entry.first_seen,
        source: 'feodo',
        source_url: 'https://feodotracker.abuse.ch/',
        tags: ['botnet', 'c2', entry.malware?.toLowerCase()].filter(Boolean),
        metadata: {
          port: entry.port,
          status: entry.status,
          as_number: entry.as_number,
          as_name: entry.as_name,
          country: entry.country,
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

  console.log(`\nFeodo Tracker Ingestion Complete:`)
  console.log(`  Added: ${added}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)

  // Show malware breakdown
  const malware = {}
  for (const e of entries) {
    const m = e.malware || 'unknown'
    malware[m] = (malware[m] || 0) + 1
  }
  console.log('\nMalware breakdown:')
  Object.entries(malware)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => console.log(`  ${name}: ${count}`))

  await supabase.from('sync_log').insert({
    source: 'feodo',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: entries.length,
    records_added: added,
  })

  return { added, skipped, failed }
}

ingestFeodo().catch(console.error)
