// GreyNoise Community API Ingestion
// Identifies mass scanners and background noise IPs
// Run: node scripts/ingest-greynoise.mjs
// API Docs: https://docs.greynoise.io/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// GreyNoise Community API - free, no key required for basic queries
const GREYNOISE_API = 'https://api.greynoise.io/v3/community'

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
          resolve({ status: res.statusCode, data: JSON.parse(data) })
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

async function lookupIP(ip) {
  const url = `${GREYNOISE_API}/${ip}`
  return fetchJSON(url)
}

async function enrichExistingIOCs() {
  console.log('Enriching existing IP IOCs with GreyNoise data...')

  // Get IP IOCs that haven't been enriched with GreyNoise yet
  const { data: ipIOCs, error } = await supabase
    .from('iocs')
    .select('id, value, metadata')
    .eq('type', 'ip')
    .is('metadata->greynoise_checked', null)
    .limit(100) // Rate limit friendly

  if (error) {
    console.error('Error fetching IOCs:', error.message)
    return { enriched: 0, noise: 0, failed: 0 }
  }

  console.log(`Found ${ipIOCs?.length || 0} IPs to check`)

  let enriched = 0
  let noise = 0
  let failed = 0

  for (const ioc of ipIOCs || []) {
    try {
      const { status, data } = await lookupIP(ioc.value)

      if (status === 200 && data) {
        const metadata = {
          ...ioc.metadata,
          greynoise_checked: new Date().toISOString(),
          greynoise_noise: data.noise,
          greynoise_riot: data.riot,
          greynoise_classification: data.classification,
          greynoise_name: data.name,
          greynoise_link: data.link,
          greynoise_last_seen: data.last_seen,
        }

        // Update tags based on GreyNoise classification
        let tags = ioc.tags || []
        if (data.noise) {
          tags = [...new Set([...tags, 'mass-scanner', 'greynoise-noise'])]
          noise++
        }
        if (data.riot) {
          tags = [...new Set([...tags, 'benign', 'greynoise-riot'])]
        }
        if (data.classification === 'malicious') {
          tags = [...new Set([...tags, 'malicious'])]
        }

        await supabase
          .from('iocs')
          .update({
            metadata,
            tags,
            confidence: data.classification === 'malicious' ? 'high' :
                       data.noise ? 'low' : 'medium'
          })
          .eq('id', ioc.id)

        enriched++
      } else if (status === 404) {
        // IP not found in GreyNoise - mark as checked
        await supabase
          .from('iocs')
          .update({
            metadata: {
              ...ioc.metadata,
              greynoise_checked: new Date().toISOString(),
              greynoise_found: false,
            }
          })
          .eq('id', ioc.id)
        enriched++
      } else {
        failed++
      }

      // Rate limit - Community API has limits
      await sleep(1500)
    } catch (e) {
      failed++
      if (failed < 5) {
        console.error(`Error checking ${ioc.value}:`, e.message)
      }
    }

    // Progress update
    if ((enriched + failed) % 20 === 0) {
      console.log(`  Progress: ${enriched + failed}/${ipIOCs.length} (${noise} noise IPs found)`)
    }
  }

  return { enriched, noise, failed }
}

async function ingestKnownScanners() {
  console.log('\nFetching known scanner/noise IPs from recent IOCs...')

  // Get recent malicious IPs from our database to check
  const { data: recentIPs } = await supabase
    .from('iocs')
    .select('value')
    .eq('type', 'ip')
    .eq('confidence', 'high')
    .order('first_seen', { ascending: false })
    .limit(50)

  let scannerCount = 0

  for (const ip of recentIPs || []) {
    try {
      const { status, data } = await lookupIP(ip.value)

      if (status === 200 && data?.noise) {
        // This is a known mass scanner - update record
        await supabase
          .from('iocs')
          .update({
            confidence: 'low', // Downgrade confidence for mass scanners
            tags: supabase.sql`array_append(tags, 'mass-scanner')`,
            metadata: supabase.sql`metadata || '{"greynoise_noise": true}'::jsonb`
          })
          .eq('value', ip.value)
          .eq('type', 'ip')

        scannerCount++
      }

      await sleep(1500) // Rate limit
    } catch (e) {
      // Continue on error
    }
  }

  console.log(`Identified ${scannerCount} mass scanner IPs`)
  return scannerCount
}

async function ingestGreyNoise() {
  console.log('Starting GreyNoise Enrichment...')
  console.log('Source: https://www.greynoise.io/')
  console.log('Note: Using Community API (rate limited)')
  console.log('')

  // Enrich existing IOCs
  const { enriched, noise, failed } = await enrichExistingIOCs()

  console.log('\n' + '='.repeat(50))
  console.log('GreyNoise Enrichment Complete')
  console.log('='.repeat(50))
  console.log(`IPs enriched: ${enriched}`)
  console.log(`Mass scanners identified: ${noise}`)
  console.log(`Failed lookups: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'greynoise',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: enriched + failed,
    records_added: enriched,
    metadata: { noise_ips: noise }
  })

  return { enriched, noise, failed }
}

ingestGreyNoise().catch(console.error)
