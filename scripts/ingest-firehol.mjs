// Firehol Level 1 IP Blocklist Ingestion
// Fetches aggregated malicious IP list from Firehol project
// Run: node scripts/ingest-firehol.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// Firehol Level 1 - mass attacks, high confidence blocklist
const FIREHOL_LEVEL1_URL = 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return fetchText(res.headers.location).then(resolve).catch(reject)
      }
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

function expandCIDR(cidr) {
  // For simplicity, we'll only handle /24 and larger subnets
  // Smaller subnets would generate too many IPs
  const [ip, prefix] = cidr.split('/')
  const prefixNum = parseInt(prefix, 10)

  if (prefixNum < 24) {
    // Too many IPs, just store the CIDR notation as-is
    return [cidr]
  }

  if (prefixNum === 32 || !prefix) {
    return [ip]
  }

  // For /24, return just the base IP with CIDR notation
  // (expanding would create 256 entries per /24)
  return [cidr]
}

async function ingestFirehol() {
  console.log('Fetching Firehol Level 1 blocklist...')

  const text = await fetchText(FIREHOL_LEVEL1_URL)
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  // Separate IPs and CIDRs
  const ips = []
  const cidrs = []

  for (const line of lines) {
    if (line.includes('/')) {
      cidrs.push(line)
    } else if (isValidIPv4(line)) {
      ips.push(line)
    }
  }

  console.log(`Found ${ips.length} IPs and ${cidrs.length} CIDR ranges`)

  // Combine IPs and CIDR notations (store CIDRs as-is for range matching)
  const allEntries = [...ips, ...cidrs]
  console.log(`Processing ${allEntries.length} total entries`)

  let added = 0
  let updated = 0
  let failed = 0
  const now = new Date().toISOString()

  // Process in batches
  const BATCH_SIZE = 100
  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE)

    const records = batch.map(entry => ({
      type: entry.includes('/') ? 'cidr' : 'ip',
      value: entry,
      malware_family: null,
      confidence: 'high', // Firehol Level 1 is curated
      first_seen: now,
      last_seen: now,
      source: 'firehol',
      source_url: 'https://iplists.firehol.org/',
      tags: ['blocklist', 'firehol', 'level1', 'mass-attack'],
      metadata: {
        blocklist: 'firehol_level1',
        note: 'Mass attacks, high confidence - full bogons, spamhaus drop, dshield',
      }
    }))

    const { error } = await supabase
      .from('iocs')
      .upsert(records, {
        onConflict: 'type,value',
        ignoreDuplicates: false
      })

    if (error) {
      failed += batch.length
      if (failed <= 5) console.error(`Batch error: ${error.message}`)
    } else {
      added += batch.length
    }

    // Progress indicator
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= allEntries.length) {
      console.log(`Processed ${Math.min(i + BATCH_SIZE, allEntries.length)}/${allEntries.length} entries...`)
    }
  }

  console.log(`\nFirehol Level 1 Ingestion Complete:`)
  console.log(`  Processed: ${allEntries.length}`)
  console.log(`  IPs: ${ips.length}`)
  console.log(`  CIDRs: ${cidrs.length}`)
  console.log(`  Failed: ${failed}`)

  await supabase.from('sync_log').insert({
    source: 'firehol',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: allEntries.length,
    records_added: added,
    metadata: {
      ips: ips.length,
      cidrs: cidrs.length,
      blocklist: 'firehol_level1'
    }
  })

  return { added, failed, ips: ips.length, cidrs: cidrs.length }
}

ingestFirehol().catch(console.error)
