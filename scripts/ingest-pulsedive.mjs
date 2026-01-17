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

// Fetch recent threats from Pulsedive (free tier limited to 50 results per query)
async function fetchRecentThreats(type = 'indicator', limit = 50, page = 0) {
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

// Fetch indicators from a specific feed (free tier max 50)
async function fetchFeedIndicators(feedId, limit = 50) {
  const url = `${PULSEDIVE_API_BASE}/explore.php?q=feed%3D${feedId}&type=indicator&limit=${limit}&key=${pulsediveApiKey}`
  return await fetch(url)
}

// Helper function with retry logic for rate limits
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url)
    } catch (e) {
      if (e.message.includes('429') && attempt < maxRetries - 1) {
        // Exponential backoff: 3s, 6s, 12s
        const delay = 3000 * Math.pow(2, attempt)
        console.log(`    Rate limited, waiting ${delay/1000}s...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw e
      }
    }
  }
}

async function ingestPulsedive() {
  console.log('Starting Pulsedive ingestion...')
  console.log('Free tier: 50 results per query, 1 req/sec rate limit')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0

  // Pulsedive valid types: ip, domain, url (hash is called 'artifact' or use 'sha256', 'md5')
  const indicatorTypes = ['ip', 'domain', 'url']
  const riskLevels = ['critical', 'high']  // Focus on critical/high only to reduce API calls
  const LIMIT = 50 // Free tier max

  // Strategy: Fetch critical and high risk indicators with retry logic
  for (const type of indicatorTypes) {
    console.log(`Fetching ${type} indicators...`)
    let typeCount = 0

    for (const risk of riskLevels) {
      try {
        // Wait before each request to respect rate limit
        await new Promise(resolve => setTimeout(resolve, 1500))

        const response = await fetchWithRetry(
          `${PULSEDIVE_API_BASE}/explore.php?q=risk%3D${risk}+type%3D${type}&limit=${LIMIT}&key=${pulsediveApiKey}`
        )

        const indicators = response.results || []

        if (indicators.length === 0) {
          console.log(`  ${risk} risk: no results`)
          continue
        }

        console.log(`  ${risk} risk: ${indicators.length} results`)
        typeCount += indicators.length

        for (const indicator of indicators) {
          try {
            processed++

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

      } catch (e) {
        if (e.message.includes('429')) {
          console.log(`  ${risk} risk: rate limited after retries`)
        } else {
          console.error(`  Error fetching ${risk} ${type}:`, e.message)
        }
      }
    }

    console.log(`  Total ${type}: ${typeCount} indicators`)
  }

  // Skip feed queries - Pulsedive explore API doesn't support type=feed
  // Feeds would need a different API endpoint
  console.log('')
  console.log('Skipping curated feeds (requires different API endpoint)')

  /*
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const feedsResponse = await fetchWithRetry(`${PULSEDIVE_API_BASE}/explore.php?q=type%3Dfeed&limit=50&key=${pulsediveApiKey}`)
    const feeds = feedsResponse.results || []

    console.log(`  Found ${feeds.length} feeds`)

    // Process top 5 feeds only to reduce API calls
    const topFeeds = feeds.slice(0, 5)

    for (const feed of topFeeds) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500))
        console.log(`  Processing feed: ${feed.indicator}`)

        const feedIndicators = await fetchWithRetry(
          `${PULSEDIVE_API_BASE}/explore.php?q=feed%3D${feed.iid}&limit=50&key=${pulsediveApiKey}`
        )
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

      } catch (e) {
        console.error(`    Error processing feed ${feed.indicator}:`, e.message)
      }
    }

  } catch (e) {
    console.error('  Error fetching feeds:', e.message)
  }
  */

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
