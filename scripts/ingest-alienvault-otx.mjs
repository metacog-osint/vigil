// AlienVault OTX (Open Threat Exchange) Ingestion
// Fetches threat pulses and IOCs from OTX
// Run: node scripts/ingest-alienvault-otx.mjs
// API Docs: https://otx.alienvault.com/api

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// OTX API - no key required for public pulses
const OTX_API = 'https://otx.alienvault.com/api/v1'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Vigil-CTI-Dashboard/1.0',
        'Accept': 'application/json',
      },
      timeout: 30000,
    }

    const req = https.get(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapOTXIndicatorType(otxType) {
  const typeMap = {
    'IPv4': 'ip',
    'IPv6': 'ip',
    'domain': 'domain',
    'hostname': 'domain',
    'URL': 'url',
    'URI': 'url',
    'FileHash-MD5': 'md5',
    'FileHash-SHA1': 'sha1',
    'FileHash-SHA256': 'sha256',
    'email': 'email',
    'CVE': 'cve',
    'YARA': 'yara',
    'Mutex': 'mutex',
    'FilePath': 'filepath',
  }
  return typeMap[otxType] || otxType.toLowerCase()
}

async function fetchSubscribedPulses(page = 1, limit = 50) {
  // Fetch recent pulses from the public feed
  const url = `${OTX_API}/pulses/subscribed?page=${page}&limit=${limit}&modified_since=30d`
  return fetchJSON(url)
}

async function fetchPulseIndicators(pulseId) {
  const url = `${OTX_API}/pulses/${pulseId}/indicators`
  return fetchJSON(url)
}

async function fetchActivityFeed(page = 1) {
  // Activity feed shows recent threat activity
  const url = `${OTX_API}/pulses/activity?page=${page}&limit=50`
  return fetchJSON(url)
}

async function ingestAlienVaultOTX() {
  console.log('Starting AlienVault OTX Ingestion...')
  console.log('Source: https://otx.alienvault.com/')
  console.log('')

  let totalPulses = 0
  let totalIndicators = 0
  let added = 0
  let skipped = 0
  let failed = 0

  // Fetch recent activity/pulses
  console.log('Fetching recent pulses from activity feed...')

  let page = 1
  const maxPages = 5 // Limit to avoid rate limits

  while (page <= maxPages) {
    try {
      const response = await fetchActivityFeed(page)
      const pulses = response.results || []

      if (pulses.length === 0) break

      console.log(`  Page ${page}: ${pulses.length} pulses`)
      totalPulses += pulses.length

      for (const pulse of pulses) {
        // Extract indicators directly from pulse if available
        const indicators = pulse.indicators || []

        if (indicators.length === 0) {
          // Try to fetch indicators separately
          try {
            const indicatorData = await fetchPulseIndicators(pulse.id)
            if (indicatorData.results) {
              indicators.push(...indicatorData.results)
            }
            await sleep(200) // Rate limit
          } catch (e) {
            // Skip if we can't get indicators
          }
        }

        totalIndicators += indicators.length

        for (const indicator of indicators) {
          try {
            const iocType = mapOTXIndicatorType(indicator.type)

            // Skip non-IOC types
            if (['cve', 'yara', 'mutex', 'filepath'].includes(iocType)) continue

            const record = {
              type: iocType,
              value: indicator.indicator,
              confidence: 'medium',
              first_seen: indicator.created || pulse.created,
              last_seen: indicator.modified || pulse.modified,
              source: 'alienvault_otx',
              source_url: `https://otx.alienvault.com/pulse/${pulse.id}`,
              tags: pulse.tags || [],
              metadata: {
                pulse_id: pulse.id,
                pulse_name: pulse.name,
                pulse_author: pulse.author_name,
                description: indicator.description,
                adversary: pulse.adversary,
                targeted_countries: pulse.targeted_countries,
                malware_families: pulse.malware_families,
                attack_ids: pulse.attack_ids,
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
              }
            } else {
              added++
            }
          } catch (e) {
            failed++
          }
        }

        // Extract threat actor info if present
        if (pulse.adversary) {
          try {
            const actorData = {
              name: pulse.adversary,
              actor_type: 'apt',
              status: 'active',
              source: 'alienvault_otx',
              metadata: {
                otx_pulse_id: pulse.id,
                targeted_countries: pulse.targeted_countries,
                malware_families: pulse.malware_families,
              }
            }

            // Check if actor exists
            const { data: existing } = await supabase
              .from('threat_actors')
              .select('id')
              .ilike('name', pulse.adversary)
              .single()

            if (!existing) {
              await supabase.from('threat_actors').insert(actorData)
            }
          } catch (e) {
            // Actor might already exist
          }
        }
      }

      page++
      await sleep(1000) // Rate limit between pages
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e.message)
      break
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('AlienVault OTX Ingestion Complete')
  console.log('='.repeat(50))
  console.log(`Pulses processed: ${totalPulses}`)
  console.log(`Indicators found: ${totalIndicators}`)
  console.log(`IOCs added: ${added}`)
  console.log(`IOCs skipped (duplicates): ${skipped}`)
  console.log(`Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'alienvault_otx',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalIndicators,
    records_added: added,
    metadata: { pulses_processed: totalPulses }
  })

  return { added, skipped, failed }
}

ingestAlienVaultOTX().catch(console.error)
