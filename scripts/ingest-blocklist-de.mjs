// Blocklist.de Data Ingestion
// Source: https://www.blocklist.de/
// Provides free lists of IPs involved in attacks (SSH, mail, web, etc.)
// Run: node scripts/ingest-blocklist-de.mjs

import { createClient } from '@supabase/supabase-js'
import { fetchText, sleep } from './lib/http.mjs'
import { supabaseUrl, supabaseKey } from './env.mjs'

// Blocklist.de feeds
const FEEDS = {
  all: {
    url: 'https://lists.blocklist.de/lists/all.txt',
    description: 'All attack types combined',
    threat_type: 'attack_source',
  },
  ssh: {
    url: 'https://lists.blocklist.de/lists/ssh.txt',
    description: 'SSH brute force attacks',
    threat_type: 'brute_force',
  },
  mail: {
    url: 'https://lists.blocklist.de/lists/mail.txt',
    description: 'Mail server attacks/spam',
    threat_type: 'spam',
  },
  apache: {
    url: 'https://lists.blocklist.de/lists/apache.txt',
    description: 'Apache/web server attacks',
    threat_type: 'web_attack',
  },
  imap: {
    url: 'https://lists.blocklist.de/lists/imap.txt',
    description: 'IMAP attacks',
    threat_type: 'brute_force',
  },
  ftp: {
    url: 'https://lists.blocklist.de/lists/ftp.txt',
    description: 'FTP attacks',
    threat_type: 'brute_force',
  },
  sip: {
    url: 'https://lists.blocklist.de/lists/sip.txt',
    description: 'SIP/VoIP attacks',
    threat_type: 'attack_source',
  },
  bots: {
    url: 'https://lists.blocklist.de/lists/bots.txt',
    description: 'Known bot IPs',
    threat_type: 'bot',
  },
  strongips: {
    url: 'https://lists.blocklist.de/lists/strongips.txt',
    description: 'Persistent attackers (7+ days)',
    threat_type: 'persistent_attack',
    confidence: 0.95,
  },
  bruteforcelogin: {
    url: 'https://lists.blocklist.de/lists/bruteforcelogin.txt',
    description: 'Brute force login attempts',
    threat_type: 'brute_force',
  },
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function isValidIP(ip) {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number)
    return parts.every(p => p >= 0 && p <= 255)
  }
  return false
}

async function fetchFeed(feed) {
  console.log(`\nFetching ${feed.description}...`)
  console.log(`  URL: ${feed.url}`)

  try {
    const text = await fetchText(feed.url)
    const ips = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && isValidIP(line))

    console.log(`  Found ${ips.length} IPs`)
    return ips
  } catch (error) {
    console.error(`  Error: ${error.message}`)
    return []
  }
}

async function ingestIOCs(ips, feedConfig, feedName) {
  if (ips.length === 0) return { inserted: 0, updated: 0 }

  let inserted = 0
  let updated = 0

  // Process in batches
  const batchSize = 500
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize)

    const iocs = batch.map(ip => ({
      type: 'ip',
      value: ip,
      source: 'blocklist_de',
      source_ref: feedName,
      threat_type: feedConfig.threat_type,
      confidence_score: feedConfig.confidence || 0.75,
      is_active: true,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      tags: ['blocklist.de', feedName, feedConfig.threat_type],
      metadata: {
        feed: feedName,
        feed_description: feedConfig.description,
        source_url: feedConfig.url,
      },
    }))

    // Upsert with conflict handling
    const { data, error } = await supabase
      .from('iocs')
      .upsert(iocs, {
        onConflict: 'type,value',
        ignoreDuplicates: false,
      })
      .select('id')

    if (error) {
      // If bulk fails, try individual inserts
      for (const ioc of iocs) {
        const { error: singleError } = await supabase
          .from('iocs')
          .upsert(ioc, { onConflict: 'type,value' })

        if (!singleError) inserted++
      }
    } else {
      inserted += batch.length
    }

    // Small delay between batches
    if (i + batchSize < ips.length) {
      await sleep(100)
    }
  }

  return { inserted, updated }
}

async function ingestBlocklistDe(selectedFeeds = null) {
  console.log('=== Blocklist.de Ingestion ===')
  console.log('Source: https://www.blocklist.de/')
  console.log('')

  const feedsToProcess = selectedFeeds
    ? Object.entries(FEEDS).filter(([name]) => selectedFeeds.includes(name))
    : Object.entries(FEEDS)

  if (feedsToProcess.length === 0) {
    console.log('No feeds selected')
    return
  }

  let totalInserted = 0
  let totalIPs = 0

  for (const [name, config] of feedsToProcess) {
    const ips = await fetchFeed(config)
    totalIPs += ips.length

    if (ips.length > 0) {
      const result = await ingestIOCs(ips, config, name)
      totalInserted += result.inserted
      console.log(`  Ingested: ${result.inserted}`)
    }

    // Rate limiting between feeds
    await sleep(1000)
  }

  console.log('\n=== Summary ===')
  console.log(`Feeds processed: ${feedsToProcess.length}`)
  console.log(`Total IPs found: ${totalIPs}`)
  console.log(`IOCs ingested: ${totalInserted}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'blocklist_de',
    status: 'completed',
    records_processed: totalIPs,
    records_inserted: totalInserted,
    metadata: {
      feeds: feedsToProcess.map(([name]) => name),
    },
  })
}

// List available feeds
function listFeeds() {
  console.log('\nAvailable Blocklist.de feeds:\n')
  Object.entries(FEEDS).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(18)} - ${config.description}`)
  })
  console.log('\nUsage: node scripts/ingest-blocklist-de.mjs [feed1 feed2 ...]')
  console.log('Example: node scripts/ingest-blocklist-de.mjs ssh apache strongips')
}

// Main
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  listFeeds()
} else if (args.includes('--list')) {
  listFeeds()
} else if (args.length > 0 && !args[0].startsWith('-')) {
  ingestBlocklistDe(args)
} else {
  // Default: ingest key feeds only (not "all" to avoid duplicates)
  ingestBlocklistDe(['ssh', 'apache', 'mail', 'strongips', 'bots', 'bruteforcelogin'])
}
