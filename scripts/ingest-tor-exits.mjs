// Tor Exit Nodes Ingestion
// Fetches current Tor exit node IP addresses from Tor Project
// Run: node scripts/ingest-tor-exits.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function isValidIPv4(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(ip)) return false

  const parts = ip.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

async function ingestTorExitNodes() {
  console.log('Fetching Tor exit node list...')

  const text = await fetchText(TOR_EXIT_LIST_URL)
  const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'))

  // Filter valid IPs
  const exitIPs = lines.filter(isValidIPv4)
  console.log(`Found ${exitIPs.length} Tor exit node IPs`)

  // Existing rows are read only to tell added from updated. An IP that leaves the
  // list is NOT deleted: its row keeps last_seen (when it was last listed) and its
  // ioc_sightings history, which a delete would cascade away. Retention rule, 18 Nov 2026.
  const { data: existingTorIocs } = await supabase
    .from('iocs')
    .select('value')
    .eq('source', 'tor_project')
    .eq('type', 'ip')

  const existingIPs = new Set(existingTorIocs?.map(i => i.value) || [])
  const newIPSet = new Set(exitIPs)
  const ipsNoLongerListed = [...existingIPs].filter(ip => !newIPSet.has(ip))

  let added = 0
  let updated = 0
  let failed = 0
  const now = new Date().toISOString()

  // Process in batches
  const BATCH_SIZE = 100
  for (let i = 0; i < exitIPs.length; i += BATCH_SIZE) {
    const batch = exitIPs.slice(i, i + BATCH_SIZE)

    const records = batch.map(ip => ({
      type: 'ip',
      value: ip,
      malware_family: null,
      confidence: 'high', // Official Tor Project data
      first_seen: now,
      last_seen: now,
      source: 'tor_project',
      source_url: 'https://check.torproject.org/torbulkexitlist',
      tags: ['tor', 'exit-node', 'anonymization'],
      metadata: {
        network_type: 'tor_exit',
        note: 'Current Tor network exit node - traffic may be anonymized',
      }
    }))

    const { error, count } = await supabase
      .from('iocs')
      .upsert(records, {
        onConflict: 'type,value',
        ignoreDuplicates: false // Update existing records
      })

    if (error) {
      failed += batch.length
      console.error(`Batch error: ${error.message}`)
    } else {
      // Count is not reliable with upsert, estimate based on existing
      const batchExisting = batch.filter(ip => existingIPs.has(ip)).length
      updated += batchExisting
      added += batch.length - batchExisting
    }

    // Progress indicator
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= exitIPs.length) {
      console.log(`Processed ${Math.min(i + BATCH_SIZE, exitIPs.length)}/${exitIPs.length} IPs...`)
    }
  }

  console.log(`\nTor Exit Nodes Ingestion Complete:`)
  console.log(`  Added: ${added}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  No longer listed (kept): ${ipsNoLongerListed.length}`)
  console.log(`  Failed: ${failed}`)

  await supabase.from('sync_log').insert({
    source: 'tor_project',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: exitIPs.length,
    records_added: added,
    metadata: {
      no_longer_listed: ipsNoLongerListed.length,
      updated: updated
    }
  })

  return { added, updated, no_longer_listed: ipsNoLongerListed.length, failed }
}

ingestTorExitNodes().catch(console.error)
