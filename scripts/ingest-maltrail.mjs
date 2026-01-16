// Maltrail Indicators Ingestion
// Fetches malware indicators from Maltrail project
// Source: https://github.com/stamparm/maltrail
// Run: node scripts/ingest-maltrail.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// Maltrail maintains categorized threat feeds
const MALTRAIL_FEEDS = [
  {
    name: 'Malware IPs',
    url: 'https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/ip.txt',
    type: 'ip',
    tags: ['malware', 'maltrail'],
    category: 'malware'
  },
  {
    name: 'Malware Domains',
    url: 'https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/domain.txt',
    type: 'domain',
    tags: ['malware', 'maltrail'],
    category: 'malware'
  },
  {
    name: 'Ransomware IPs',
    url: 'https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/ransomware.txt',
    type: 'mixed', // Contains both IPs and domains
    tags: ['ransomware', 'maltrail'],
    category: 'ransomware'
  },
  {
    name: 'Suspicious IPs',
    url: 'https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/suspicious/ip.txt',
    type: 'ip',
    tags: ['suspicious', 'maltrail'],
    category: 'suspicious'
  },
  {
    name: 'Cryptominer IPs',
    url: 'https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/crypto.txt',
    type: 'mixed',
    tags: ['cryptominer', 'maltrail'],
    category: 'cryptominer'
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
        resolve('')
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

function isValidIP(value) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(value)) {
    const parts = value.split('.')
    return parts.every(part => {
      const num = parseInt(part, 10)
      return num >= 0 && num <= 255
    })
  }
  return false
}

function isValidDomain(value) {
  // Basic domain validation - alphanumeric with dots
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
  return domainRegex.test(value) && !isValidIP(value)
}

function detectType(value) {
  if (isValidIP(value)) return 'ip'
  if (isValidDomain(value)) return 'domain'
  return null
}

async function ingestMaltrailFeed(feed) {
  console.log(`\nFetching ${feed.name}...`)

  const text = await fetchText(feed.url)
  if (!text) {
    console.log(`  No data found`)
    return { added: 0, failed: 0, name: feed.name }
  }

  const lines = text.split('\n')
    .map(line => line.trim().split('#')[0].trim()) // Remove comments
    .filter(line => line && line.length > 0)

  // Parse indicators based on type
  const indicators = []
  for (const line of lines) {
    const value = line.toLowerCase()

    if (feed.type === 'ip' && isValidIP(value)) {
      indicators.push({ type: 'ip', value })
    } else if (feed.type === 'domain' && isValidDomain(value)) {
      indicators.push({ type: 'domain', value })
    } else if (feed.type === 'mixed') {
      const detectedType = detectType(value)
      if (detectedType) {
        indicators.push({ type: detectedType, value })
      }
    }
  }

  console.log(`  Found ${indicators.length} indicators (from ${lines.length} lines)`)

  if (indicators.length === 0) {
    return { added: 0, failed: 0, name: feed.name }
  }

  let added = 0
  let failed = 0
  const now = new Date().toISOString()

  // Process in batches
  const BATCH_SIZE = 100
  for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
    const batch = indicators.slice(i, i + BATCH_SIZE)

    const records = batch.map(ind => ({
      type: ind.type,
      value: ind.value,
      malware_family: feed.category === 'ransomware' ? 'ransomware' :
                      feed.category === 'cryptominer' ? 'cryptominer' : null,
      confidence: feed.category === 'suspicious' ? 'medium' : 'high',
      first_seen: now,
      last_seen: now,
      source: 'maltrail',
      source_url: 'https://github.com/stamparm/maltrail',
      tags: feed.tags,
      metadata: {
        maltrail_category: feed.category,
        feed_name: feed.name
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

    // Progress indicator for large feeds
    if (indicators.length > 500 && (i + BATCH_SIZE) % 500 === 0) {
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, indicators.length)}/${indicators.length}...`)
    }
  }

  console.log(`  Added/Updated: ${added}, Failed: ${failed}`)
  return { added, failed, name: feed.name }
}

async function ingestMaltrail() {
  console.log('=== Maltrail Indicators Ingestion ===')
  console.log('Fetching malware indicators from Maltrail project...\n')

  const results = []
  let totalAdded = 0
  let totalFailed = 0

  for (const feed of MALTRAIL_FEEDS) {
    try {
      const result = await ingestMaltrailFeed(feed)
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
  console.log('\nBy Category:')
  results.forEach(r => {
    console.log(`  ${r.name}: ${r.added} indicators`)
  })

  await supabase.from('sync_log').insert({
    source: 'maltrail',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalAdded + totalFailed,
    records_added: totalAdded,
    metadata: {
      feeds: results.map(r => ({ name: r.name, count: r.added }))
    }
  })

  return { totalAdded, totalFailed, results }
}

ingestMaltrail().catch(console.error)
