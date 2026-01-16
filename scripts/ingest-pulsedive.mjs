// Pulsedive Community Threat Intelligence Ingestion
// Fetches community threat intelligence with risk scoring from Pulsedive
// Run: node scripts/ingest-pulsedive.mjs
//
// Pulsedive aggregates OSINT feeds with automated risk assessment
// Free tier available: https://pulsedive.com/api/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, pulsediveApiKey } from './env.mjs'

const PULSEDIVE_API_BASE = 'https://pulsedive.com/api'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!pulsediveApiKey) {
  console.error('Missing PULSEDIVE_API_KEY. Get a free key at https://pulsedive.com/api/')
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
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          } else {
            resolve(JSON.parse(data))
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    }).on('error', reject)
  })
}

// Fetch recent threats from Pulsedive
async function fetchRecentThreats(type = 'indicator', limit = 100, page = 0) {
  const url = `${PULSEDIVE_API_BASE}/explore.php?q=risk%3Ahigh+OR+risk%3Acritical&type=${type}&limit=${limit}&page=${page}&key=${pulsediveApiKey}`
  return await fetch(url)
}

// Fetch threat details by ID
async function fetchThreatDetails(iid) {
  const url = `${PULSEDIVE_API_BASE}/info.php?iid=${iid}&key=${pulsediveApiKey}`
  return await fetch(url)
}

// Fetch feed data (curated threat feeds)
async function fetchFeeds() {
  const url = `${PULSEDIVE_API_BASE}/explore.php?q=feed&type=feed&limit=50&key=${pulsediveApiKey}`
  return await fetch(url)
}

// Fetch indicators from a specific feed
async function fetchFeedIndicators(feedId, limit = 100) {
  const url = `${PULSEDIVE_API_BASE}/explore.php?q=feed%3D${feedId}&type=indicator&limit=${limit}&key=${pulsediveApiKey}`
  return await fetch(url)
}

async function ingestPulsedive() {
  console.log('Starting Pulsedive ingestion...')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0

  // Fetch high and critical risk indicators
  const indicatorTypes = ['ip', 'domain', 'url', 'hash']

  for (const type of indicatorTypes) {
    console.log(`Fetching ${type} indicators...`)

    try {
      // Fetch critical risk indicators
      const criticalResponse = await fetch(
        `${PULSEDIVE_API_BASE}/explore.php?q=risk%3Acritical+type%3A${type}&limit=100&key=${pulsediveApiKey}`
      )

      // Fetch high risk indicators
      const highResponse = await fetch(
        `${PULSEDIVE_API_BASE}/explore.php?q=risk%3Ahigh+type%3A${type}&limit=100&key=${pulsediveApiKey}`
      )

      const indicators = [
        ...(criticalResponse.results || []),
        ...(highResponse.results || [])
      ]

      console.log(`  Found ${indicators.length} ${type} indicators`)

      for (const indicator of indicators) {
        try {
          processed++

          // Map Pulsedive indicator to our IOC schema
          const record = {
            value: indicator.indicator,
            type: mapIndicatorType(indicator.type),
            source: 'pulsedive',
            confidence: mapRiskToConfidence(indicator.risk),
            severity: indicator.risk || 'medium',
            first_seen: indicator.stamp_added ? new Date(indicator.stamp_added).toISOString() : null,
            last_seen: indicator.stamp_updated ? new Date(indicator.stamp_updated).toISOString() : null,
            tags: indicator.threats || [],
            metadata: {
              pulsedive_id: indicator.iid,
              risk: indicator.risk,
              risk_factors: indicator.riskfactors || [],
              feeds: indicator.feeds || [],
              threats: indicator.threats || [],
              summary: indicator.summary || null
            },
            updated_at: new Date().toISOString()
          }

          const { error } = await supabase
            .from('iocs')
            .upsert(record, {
              onConflict: 'value,type',
              ignoreDuplicates: false
            })

          if (error) {
            failed++
            if (failed <= 5) {
              console.error(`    Error upserting ${indicator.indicator}:`, error.message)
            }
          } else {
            updated++
          }

        } catch (e) {
          failed++
        }
      }

      // Rate limiting - Pulsedive free tier has limits
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (e) {
      console.error(`  Error fetching ${type} indicators:`, e.message)
    }
  }

  // Also fetch from curated threat feeds
  console.log('')
  console.log('Fetching curated threat feeds...')

  try {
    const feedsResponse = await fetchFeeds()
    const feeds = feedsResponse.results || []

    console.log(`  Found ${feeds.length} feeds`)

    // Process top feeds
    const topFeeds = feeds.slice(0, 10)

    for (const feed of topFeeds) {
      try {
        console.log(`  Processing feed: ${feed.indicator}`)

        const feedIndicators = await fetchFeedIndicators(feed.iid, 50)
        const indicators = feedIndicators.results || []

        for (const indicator of indicators) {
          processed++

          const record = {
            value: indicator.indicator,
            type: mapIndicatorType(indicator.type),
            source: 'pulsedive',
            source_feed: feed.indicator,
            confidence: mapRiskToConfidence(indicator.risk),
            severity: indicator.risk || 'medium',
            first_seen: indicator.stamp_added ? new Date(indicator.stamp_added).toISOString() : null,
            last_seen: indicator.stamp_updated ? new Date(indicator.stamp_updated).toISOString() : null,
            tags: indicator.threats || [],
            metadata: {
              pulsedive_id: indicator.iid,
              feed_id: feed.iid,
              feed_name: feed.indicator,
              risk: indicator.risk
            },
            updated_at: new Date().toISOString()
          }

          const { error } = await supabase
            .from('iocs')
            .upsert(record, {
              onConflict: 'value,type',
              ignoreDuplicates: false
            })

          if (error) {
            failed++
          } else {
            updated++
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (e) {
        console.error(`    Error processing feed ${feed.indicator}:`, e.message)
      }
    }

  } catch (e) {
    console.error('  Error fetching feeds:', e.message)
  }

  console.log('')
  console.log('Pulsedive Ingestion Complete:')
  console.log(`  Processed: ${processed}`)
  console.log(`  Added/Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'pulsedive',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: added,
    records_updated: updated,
    metadata: { failed }
  })

  return { processed, added, updated, failed }
}

function mapIndicatorType(pulsediveType) {
  const typeMap = {
    'ip': 'ip',
    'ipv6': 'ip',
    'domain': 'domain',
    'url': 'url',
    'hash': 'hash',
    'md5': 'hash',
    'sha1': 'hash',
    'sha256': 'hash'
  }
  return typeMap[pulsediveType?.toLowerCase()] || 'unknown'
}

function mapRiskToConfidence(risk) {
  const confidenceMap = {
    'critical': 95,
    'high': 80,
    'medium': 60,
    'low': 40,
    'none': 20,
    'unknown': 50
  }
  return confidenceMap[risk?.toLowerCase()] || 50
}

// Main execution
ingestPulsedive().catch(console.error)
