// C2-Tracker Ingestion
// Fetches known C2 framework IPs (Cobalt Strike, Metasploit, etc.)
// Source: https://github.com/montysecurity/C2-Tracker
// Run: node scripts/ingest-c2-tracker.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// C2-Tracker GitHub raw URLs
const C2_FEEDS = [
  {
    name: 'Cobalt Strike',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/CobaltStrike.txt',
    tags: ['cobalt-strike', 'c2', 'apt-tool'],
    malware: 'Cobalt Strike'
  },
  {
    name: 'Metasploit',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Metasploit.txt',
    tags: ['metasploit', 'c2', 'pentest-tool'],
    malware: 'Metasploit'
  },
  {
    name: 'Havoc',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Havoc.txt',
    tags: ['havoc', 'c2'],
    malware: 'Havoc C2'
  },
  {
    name: 'Brute Ratel',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/BruteRatel.txt',
    tags: ['brute-ratel', 'c2', 'apt-tool'],
    malware: 'Brute Ratel'
  },
  {
    name: 'Sliver',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Sliver.txt',
    tags: ['sliver', 'c2'],
    malware: 'Sliver C2'
  },
  {
    name: 'Posh C2',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/PoshC2.txt',
    tags: ['posh-c2', 'c2'],
    malware: 'Posh C2'
  },
  {
    name: 'Mythic',
    url: 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Mythic.txt',
    tags: ['mythic', 'c2'],
    malware: 'Mythic C2'
  }
]

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 404) {
        resolve('') // File doesn't exist, return empty
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject)
      } else {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(data))
      }
    }).on('error', reject)
  })
}

function isValidIP(ip) {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.')
    return parts.every(part => {
      const num = parseInt(part, 10)
      return num >= 0 && num <= 255
    })
  }
  return false
}

async function ingestC2Feed(feed) {
  console.log(`\nFetching ${feed.name} C2 servers...`)

  const text = await fetchText(feed.url)
  if (!text) {
    console.log(`  No data found for ${feed.name}`)
    return { added: 0, failed: 0, name: feed.name }
  }

  const ips = text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && isValidIP(line))

  console.log(`  Found ${ips.length} IPs`)

  if (ips.length === 0) {
    return { added: 0, failed: 0, name: feed.name }
  }

  let added = 0
  let failed = 0
  const now = new Date().toISOString()

  // Process in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < ips.length; i += BATCH_SIZE) {
    const batch = ips.slice(i, i + BATCH_SIZE)

    const records = batch.map(ip => ({
      type: 'ip',
      value: ip,
      malware_family: feed.malware,
      confidence: 'high',
      first_seen: now,
      last_seen: now,
      source: 'c2_tracker',
      source_url: 'https://github.com/montysecurity/C2-Tracker',
      tags: ['c2-server', ...feed.tags],
      metadata: {
        c2_framework: feed.name,
        threat_type: 'command_and_control',
        note: `Active ${feed.name} C2 server`
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
      if (failed <= 3) console.error(`  Batch error: ${error.message}`)
    } else {
      added += batch.length
    }
  }

  console.log(`  Added/Updated: ${added}, Failed: ${failed}`)
  return { added, failed, name: feed.name }
}

async function ingestC2Tracker() {
  console.log('=== C2-Tracker Ingestion ===')
  console.log('Fetching known C2 framework servers...\n')

  const results = []
  let totalAdded = 0
  let totalFailed = 0

  for (const feed of C2_FEEDS) {
    try {
      const result = await ingestC2Feed(feed)
      results.push(result)
      totalAdded += result.added
      totalFailed += result.failed
    } catch (err) {
      console.error(`Error processing ${feed.name}:`, err.message)
      results.push({ name: feed.name, added: 0, failed: 0, error: err.message })
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total Added/Updated: ${totalAdded}`)
  console.log(`Total Failed: ${totalFailed}`)
  console.log('\nBy Framework:')
  results.forEach(r => {
    console.log(`  ${r.name}: ${r.added} IPs`)
  })

  await supabase.from('sync_log').insert({
    source: 'c2_tracker',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalAdded + totalFailed,
    records_added: totalAdded,
    metadata: {
      frameworks: results.map(r => ({ name: r.name, count: r.added }))
    }
  })

  return { totalAdded, totalFailed, results }
}

ingestC2Tracker().catch(console.error)
