// IP Reputation Aggregation
// Aggregates reputation data from multiple sources for IP addresses
// Run: node scripts/aggregate-ip-reputation.mjs

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Reputation source weights (total = 100)
const SOURCE_WEIGHTS = {
  cisa_kev: 25,          // CISA Known Exploited Vulnerabilities
  blocklist_de: 15,      // Blocklist.de attack reports
  emerging_threats: 15,  // Emerging Threats blocklists
  firehol: 15,           // Firehol aggregated blocklists
  threatfox: 10,         // Abuse.ch ThreatFox
  feodo: 10,             // Feodo C2 tracker
  tor_exit: 5,           // Tor exit nodes (not malicious, but notable)
  greynoise: 5,          // GreyNoise internet scanner detection
}

// Threat type severity multipliers
const THREAT_MULTIPLIERS = {
  c2_server: 1.5,
  malware_distribution: 1.4,
  ransomware: 1.5,
  botnet: 1.3,
  brute_force: 1.1,
  spam: 0.9,
  scanner: 0.8,
  tor_exit: 0.6,
  unknown: 1.0,
}

async function getIPSources(ip) {
  // Query IOCs table for this IP across all sources
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('source, threat_type, confidence_score, tags, first_seen, last_seen, metadata')
    .eq('type', 'ip')
    .eq('value', ip)

  if (error) {
    console.error(`Error fetching IOCs for ${ip}:`, error.message)
    return []
  }

  return iocs || []
}

function calculateReputationScore(sources) {
  if (sources.length === 0) {
    return { score: 0, level: 'unknown', factors: [] }
  }

  let totalScore = 0
  const factors = []
  const seenSources = new Set()

  for (const source of sources) {
    const sourceName = source.source?.toLowerCase() || 'unknown'

    // Avoid double-counting same source
    if (seenSources.has(sourceName)) continue
    seenSources.add(sourceName)

    // Get base weight for source
    let weight = SOURCE_WEIGHTS[sourceName] || 5

    // Apply threat type multiplier
    const threatType = source.threat_type?.toLowerCase() || 'unknown'
    const multiplier = THREAT_MULTIPLIERS[threatType] || 1.0
    weight *= multiplier

    // Apply confidence score if available
    if (source.confidence_score) {
      weight *= source.confidence_score
    }

    // Recency bonus (within last 7 days)
    if (source.last_seen) {
      const daysSinceLastSeen = (Date.now() - new Date(source.last_seen).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastSeen <= 7) {
        weight *= 1.2
      } else if (daysSinceLastSeen <= 30) {
        weight *= 1.0
      } else if (daysSinceLastSeen <= 90) {
        weight *= 0.8
      } else {
        weight *= 0.5
      }
    }

    totalScore += weight
    factors.push({
      source: sourceName,
      threat_type: threatType,
      weight: Math.round(weight * 10) / 10,
      last_seen: source.last_seen,
    })
  }

  // Cap score at 100
  const finalScore = Math.min(Math.round(totalScore), 100)

  // Determine reputation level
  let level
  if (finalScore >= 80) {
    level = 'malicious'
  } else if (finalScore >= 60) {
    level = 'suspicious'
  } else if (finalScore >= 30) {
    level = 'risky'
  } else if (finalScore > 0) {
    level = 'low_risk'
  } else {
    level = 'unknown'
  }

  return {
    score: finalScore,
    level,
    factors: factors.sort((a, b) => b.weight - a.weight),
    sources_count: seenSources.size,
  }
}

async function aggregateIPReputation(ip) {
  console.log(`\nAggregating reputation for: ${ip}`)

  const sources = await getIPSources(ip)
  console.log(`  Found in ${sources.length} IOC records`)

  const reputation = calculateReputationScore(sources)
  console.log(`  Score: ${reputation.score}/100 (${reputation.level})`)

  if (reputation.factors.length > 0) {
    console.log(`  Top factors:`)
    reputation.factors.slice(0, 5).forEach(f => {
      console.log(`    - ${f.source}: ${f.threat_type} (+${f.weight})`)
    })
  }

  return reputation
}

async function aggregateAllIPs(options = {}) {
  const { limit = 1000, minSources = 2 } = options

  console.log('=== IP Reputation Aggregation ===')
  console.log(`Processing IPs with at least ${minSources} source(s)`)
  console.log('')

  // Get IPs that appear in multiple sources
  const { data: ips, error } = await supabase
    .from('iocs')
    .select('value')
    .eq('type', 'ip')
    .order('last_seen', { ascending: false })
    .limit(limit * 10) // Over-fetch to find duplicates

  if (error) {
    console.error('Error fetching IPs:', error)
    return
  }

  // Count occurrences
  const ipCounts = new Map()
  for (const ioc of ips || []) {
    ipCounts.set(ioc.value, (ipCounts.get(ioc.value) || 0) + 1)
  }

  // Filter to IPs with multiple sources
  const multiSourceIPs = Array.from(ipCounts.entries())
    .filter(([, count]) => count >= minSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ip]) => ip)

  console.log(`Found ${multiSourceIPs.length} IPs with ${minSources}+ sources`)

  let processed = 0
  let updated = 0
  const distribution = { malicious: 0, suspicious: 0, risky: 0, low_risk: 0, unknown: 0 }

  for (const ip of multiSourceIPs) {
    const reputation = await aggregateIPReputation(ip)
    distribution[reputation.level]++
    processed++

    // Update the IOC records with aggregated reputation
    const { error: updateError } = await supabase
      .from('iocs')
      .update({
        reputation_score: reputation.score,
        reputation_level: reputation.level,
        reputation_factors: reputation.factors,
        reputation_updated_at: new Date().toISOString(),
      })
      .eq('type', 'ip')
      .eq('value', ip)

    if (!updateError) updated++

    // Progress update
    if (processed % 100 === 0) {
      console.log(`\nProcessed ${processed}/${multiSourceIPs.length}...`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Processed: ${processed}`)
  console.log(`Updated: ${updated}`)
  console.log('\nReputation Distribution:')
  console.log(`  Malicious: ${distribution.malicious}`)
  console.log(`  Suspicious: ${distribution.suspicious}`)
  console.log(`  Risky: ${distribution.risky}`)
  console.log(`  Low Risk: ${distribution.low_risk}`)
  console.log(`  Unknown: ${distribution.unknown}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'ip_reputation',
    status: 'completed',
    records_processed: processed,
    records_inserted: updated,
    metadata: {
      distribution,
      min_sources: minSources,
    },
  })
}

// Single IP lookup
async function lookupIP(ip) {
  const reputation = await aggregateIPReputation(ip)

  console.log('\n=== Reputation Summary ===')
  console.log(`IP: ${ip}`)
  console.log(`Score: ${reputation.score}/100`)
  console.log(`Level: ${reputation.level.toUpperCase()}`)
  console.log(`Sources: ${reputation.sources_count}`)

  if (reputation.factors.length > 0) {
    console.log('\nContributing Factors:')
    reputation.factors.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.source} (${f.threat_type}): +${f.weight} points`)
      if (f.last_seen) {
        console.log(`     Last seen: ${new Date(f.last_seen).toISOString().split('T')[0]}`)
      }
    })
  }

  return reputation
}

// Main
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('IP Reputation Aggregation')
  console.log('')
  console.log('Usage: node scripts/aggregate-ip-reputation.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --ip=X.X.X.X    Look up reputation for a specific IP')
  console.log('  --limit=N       Process N IPs (default: 1000)')
  console.log('  --min-sources=N Only IPs with N+ sources (default: 2)')
} else if (args.some(a => a.startsWith('--ip='))) {
  const ip = args.find(a => a.startsWith('--ip=')).split('=')[1]
  lookupIP(ip)
} else {
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10)
  const minSources = parseInt(args.find(a => a.startsWith('--min-sources='))?.split('=')[1] || '2', 10)
  aggregateAllIPs({ limit, minSources })
}
