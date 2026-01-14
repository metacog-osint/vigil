// Hybrid Analysis Malware Sample Enrichment
// Enriches malware samples with sandbox analysis data
// Run: node scripts/enrich-hybridanalysis.mjs
// API Docs: https://www.hybrid-analysis.com/docs/api/v2

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, hybridAnalysisApiKey } from './env.mjs'

const HA_API = 'https://hybrid-analysis.com/api/v2'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!hybridAnalysisApiKey) {
  console.error('Missing Hybrid Analysis API key. Add HYBRID_ANALYSIS_API_KEY to .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchHA(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = `${HA_API}${endpoint}`
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'api-key': hybridAnalysisApiKey,
        'Accept': 'application/json',
        'User-Agent': 'Falcon Sandbox',
      },
    }

    if (body) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      options.headers['Content-Length'] = Buffer.byteLength(body)
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          if (data.length === 0) {
            resolve({ status: res.statusCode, data: [] })
          } else {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          }
        } catch (e) {
          console.error('Raw response:', data.substring(0, 200))
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(body)
    }
    req.end()
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function searchHash(hash) {
  // Use the /overview endpoint (search/hash was deprecated in v2.35.0)
  const { status, data } = await fetchHA(`/overview/${hash}`)

  if (status === 200 && data && data.sha256) {
    return {
      ha_checked: new Date().toISOString(),
      ha_found: true,
      ha_verdict: data.verdict,
      ha_threat_score: data.threat_score,
      ha_vx_family: data.vx_family,
      ha_type: data.type_short || data.type,
      ha_tags: data.tags,
      ha_sha256: data.sha256,
      ha_filename: data.last_file_name,
      ha_size: data.size,
      ha_multiscan: data.multiscan_result,
      ha_link: `https://hybrid-analysis.com/sample/${data.sha256}`,
    }
  } else if (status === 404) {
    return {
      ha_checked: new Date().toISOString(),
      ha_found: false,
    }
  }

  return null
}

async function enrichMalwareSamples() {
  console.log('Enriching malware samples with Hybrid Analysis data...')
  console.log('Note: Free API allows 5 requests/minute, 200/day')
  console.log('')

  // Get malware samples that haven't been enriched with HA yet
  const { data: samples, error } = await supabase
    .from('malware_samples')
    .select('id, sha256, sha1, md5, metadata')
    .is('metadata->ha_checked', null)
    .limit(50) // Stay within rate limits

  if (error) {
    console.error('Error fetching samples:', error.message)
    return { enriched: 0, threats: 0, failed: 0 }
  }

  console.log(`Found ${samples?.length || 0} samples to check`)

  let enriched = 0
  let threats = 0
  let failed = 0

  for (const sample of samples || []) {
    try {
      // Search by SHA256 first, fall back to MD5
      let haData = await searchHash(sample.sha256)

      if (!haData && sample.md5) {
        await sleep(12000) // Rate limit
        haData = await searchHash(sample.md5)
      }

      if (haData) {
        const metadata = { ...sample.metadata, ...haData }

        // Update the sample with HA data
        await supabase
          .from('malware_samples')
          .update({ metadata })
          .eq('id', sample.id)

        enriched++

        if (haData.ha_verdict === 'malicious' || haData.ha_threat_score > 50) {
          threats++
        }
      } else {
        failed++
      }

      // Rate limit - HA free tier: ~5 requests/minute
      await sleep(12000)

      // Progress update
      if ((enriched + failed) % 10 === 0) {
        console.log(`  Progress: ${enriched + failed}/${samples.length} (${threats} threats confirmed)`)
      }
    } catch (e) {
      failed++
      if (failed < 5) {
        console.error(`Error checking ${sample.sha256}:`, e.message)
      }
    }
  }

  return { enriched, threats, failed }
}

async function enrichIOCHashes() {
  console.log('\nEnriching hash IOCs with Hybrid Analysis data...')

  // Get hash IOCs that haven't been enriched
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('id, value, type, metadata')
    .in('type', ['sha256', 'sha1', 'md5'])
    .is('metadata->ha_checked', null)
    .limit(30)

  if (error) {
    console.error('Error fetching IOCs:', error.message)
    return { enriched: 0, threats: 0, failed: 0 }
  }

  console.log(`Found ${iocs?.length || 0} hash IOCs to check`)

  let enriched = 0
  let threats = 0
  let failed = 0

  for (const ioc of iocs || []) {
    try {
      const haData = await searchHash(ioc.value)

      if (haData) {
        const metadata = { ...ioc.metadata, ...haData }

        // Update confidence based on HA verdict
        let confidence = 'medium'
        if (haData.ha_verdict === 'malicious' || haData.ha_threat_score > 70) {
          confidence = 'high'
          threats++
        } else if (haData.ha_threat_score > 30) {
          confidence = 'medium'
        }

        await supabase
          .from('iocs')
          .update({ metadata, confidence })
          .eq('id', ioc.id)

        enriched++
      } else {
        failed++
      }

      await sleep(12000) // Rate limit

      if ((enriched + failed) % 10 === 0) {
        console.log(`  Progress: ${enriched + failed}/${iocs.length}`)
      }
    } catch (e) {
      failed++
    }
  }

  return { enriched, threats, failed }
}

async function ingestHybridAnalysis() {
  console.log('Starting Hybrid Analysis Enrichment...')
  console.log('Source: https://www.hybrid-analysis.com/')
  console.log('')

  // Enrich malware samples
  const samples = await enrichMalwareSamples()

  // Enrich hash IOCs
  const iocs = await enrichIOCHashes()

  const totalEnriched = samples.enriched + iocs.enriched
  const totalThreats = samples.threats + iocs.threats
  const totalFailed = samples.failed + iocs.failed

  console.log('\n' + '='.repeat(50))
  console.log('Hybrid Analysis Enrichment Complete')
  console.log('='.repeat(50))
  console.log(`Samples enriched: ${samples.enriched}`)
  console.log(`IOCs enriched: ${iocs.enriched}`)
  console.log(`Threats confirmed: ${totalThreats}`)
  console.log(`Failed lookups: ${totalFailed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'hybridanalysis',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalEnriched + totalFailed,
    records_added: totalEnriched,
    metadata: { threats_confirmed: totalThreats }
  })

  return { enriched: totalEnriched, threats: totalThreats, failed: totalFailed }
}

ingestHybridAnalysis().catch(console.error)
