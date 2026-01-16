// Emerging Threats Data Ingestion
// Source: https://rules.emergingthreats.net/
// Provides free community blocklists and compromised IP lists
// Run: node scripts/ingest-emerging-threats.mjs

import { createClient } from '@supabase/supabase-js'
import { fetchText, sleep } from './lib/http.mjs'
import { supabaseUrl, supabaseKey } from './env.mjs'

// Emerging Threats free feeds
const FEEDS = {
  block_ips: {
    url: 'https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt',
    description: 'IPs recommended for blocking',
    threat_type: 'malicious_host',
    confidence: 0.85,
  },
  compromised: {
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
    description: 'Known compromised hosts',
    threat_type: 'compromised_host',
    confidence: 0.80,
  },
  tor_exit: {
    url: 'https://rules.emergingthreats.net/blockrules/emerging-tor.rules',
    description: 'Tor exit nodes (from rules file)',
    threat_type: 'tor_exit',
    confidence: 0.95,
    parser: 'rules',
  },
  botcc: {
    url: 'https://rules.emergingthreats.net/blockrules/emerging-botcc.rules',
    description: 'Botnet C2 servers',
    threat_type: 'c2_server',
    confidence: 0.90,
    parser: 'rules',
  },
  ciarmy: {
    url: 'https://rules.emergingthreats.net/fwrules/emerging-PIX-CC.rules',
    description: 'CI Army malicious IPs',
    threat_type: 'attack_source',
    confidence: 0.75,
    parser: 'pix',
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

function isValidCIDR(cidr) {
  const [ip, prefix] = cidr.split('/')
  if (!isValidIP(ip)) return false
  const prefixNum = parseInt(prefix, 10)
  return prefixNum >= 0 && prefixNum <= 32
}

function parseIPList(text) {
  // Simple IP list format (one IP per line)
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .filter(line => isValidIP(line) || isValidCIDR(line))
}

function parseRulesFile(text) {
  // Extract IPs from Suricata/Snort rules
  // Format: alert ... [IP] ... or $HOME_NET -> [IP]
  const ips = new Set()
  const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) continue

    let match
    while ((match = ipRegex.exec(line)) !== null) {
      const ip = match[1]
      // Skip common non-threat IPs
      if (!ip.startsWith('0.') &&
          !ip.startsWith('127.') &&
          !ip.startsWith('255.') &&
          !ip.startsWith('224.') &&
          isValidIP(ip)) {
        ips.add(ip)
      }
    }
  }

  return Array.from(ips)
}

function parsePIXRules(text) {
  // Parse PIX/ASA firewall rules format
  // Format: access-list emerging-block-IPs deny ip host 1.2.3.4 any
  const ips = new Set()
  const hostRegex = /host\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi

  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.startsWith('!')) continue

    let match
    while ((match = hostRegex.exec(line)) !== null) {
      const ip = match[1]
      if (isValidIP(ip)) {
        ips.add(ip)
      }
    }
  }

  return Array.from(ips)
}

async function fetchFeed(feed) {
  console.log(`\nFetching ${feed.description}...`)
  console.log(`  URL: ${feed.url}`)

  try {
    const text = await fetchText(feed.url)

    let entries
    switch (feed.parser) {
      case 'rules':
        entries = parseRulesFile(text)
        break
      case 'pix':
        entries = parsePIXRules(text)
        break
      default:
        entries = parseIPList(text)
    }

    console.log(`  Found ${entries.length} entries`)
    return entries
  } catch (error) {
    console.error(`  Error: ${error.message}`)
    return []
  }
}

async function ingestIOCs(entries, feedConfig, feedName) {
  if (entries.length === 0) return { inserted: 0, updated: 0 }

  let inserted = 0
  const now = new Date().toISOString()

  // Process in batches
  const batchSize = 500
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)

    const iocs = batch.map(entry => ({
      type: entry.includes('/') ? 'cidr' : 'ip',
      value: entry,
      source: 'emerging_threats',
      source_ref: feedName,
      threat_type: feedConfig.threat_type,
      confidence_score: feedConfig.confidence,
      is_active: true,
      first_seen: now,
      last_seen: now,
      tags: ['emerging-threats', feedName, feedConfig.threat_type],
      metadata: {
        feed: feedName,
        feed_description: feedConfig.description,
        source_url: feedConfig.url,
      },
    }))

    const { error } = await supabase
      .from('iocs')
      .upsert(iocs, {
        onConflict: 'type,value',
        ignoreDuplicates: false,
      })

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
    if (i + batchSize < entries.length) {
      await sleep(100)
    }
  }

  return { inserted, updated: 0 }
}

async function ingestEmergingThreats(selectedFeeds = null) {
  console.log('=== Emerging Threats Ingestion ===')
  console.log('Source: https://rules.emergingthreats.net/')
  console.log('')

  const feedsToProcess = selectedFeeds
    ? Object.entries(FEEDS).filter(([name]) => selectedFeeds.includes(name))
    : Object.entries(FEEDS)

  if (feedsToProcess.length === 0) {
    console.log('No feeds selected')
    return
  }

  let totalInserted = 0
  let totalEntries = 0

  for (const [name, config] of feedsToProcess) {
    const entries = await fetchFeed(config)
    totalEntries += entries.length

    if (entries.length > 0) {
      const result = await ingestIOCs(entries, config, name)
      totalInserted += result.inserted
      console.log(`  Ingested: ${result.inserted}`)
    }

    // Rate limiting between feeds
    await sleep(1000)
  }

  console.log('\n=== Summary ===')
  console.log(`Feeds processed: ${feedsToProcess.length}`)
  console.log(`Total entries found: ${totalEntries}`)
  console.log(`IOCs ingested: ${totalInserted}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'emerging_threats',
    status: 'completed',
    records_processed: totalEntries,
    records_inserted: totalInserted,
    metadata: {
      feeds: feedsToProcess.map(([name]) => name),
    },
  })
}

// List available feeds
function listFeeds() {
  console.log('\nAvailable Emerging Threats feeds:\n')
  Object.entries(FEEDS).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(15)} - ${config.description}`)
  })
  console.log('\nUsage: node scripts/ingest-emerging-threats.mjs [feed1 feed2 ...]')
  console.log('Example: node scripts/ingest-emerging-threats.mjs block_ips compromised')
}

// Main
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  listFeeds()
} else if (args.includes('--list')) {
  listFeeds()
} else if (args.length > 0 && !args[0].startsWith('-')) {
  ingestEmergingThreats(args)
} else {
  // Default: ingest primary feeds
  ingestEmergingThreats(['block_ips', 'compromised', 'botcc'])
}
