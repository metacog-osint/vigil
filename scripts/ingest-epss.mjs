// EPSS (Exploit Prediction Scoring System) Ingestion
// Fetches EPSS scores from FIRST.org and updates vulnerabilities
// Run: node scripts/ingest-epss.mjs
//
// EPSS provides probability scores (0-1) for CVE exploitation within 30 days
// This is critical for vulnerability prioritization beyond CVSS alone

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const EPSS_API_BASE = 'https://api.first.org/data/v1/epss'
const BATCH_SIZE = 100 // EPSS API allows up to 100 CVEs per request

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
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
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    }).on('error', reject)
  })
}

// Fetch EPSS scores for a batch of CVE IDs
async function fetchEPSSBatch(cveIds) {
  if (!cveIds.length) return []

  const url = `${EPSS_API_BASE}?cve=${cveIds.join(',')}`
  const response = await fetch(url)

  if (response.status !== 'OK') {
    throw new Error(`EPSS API error: ${response.status_code || 'Unknown'}`)
  }

  return response.data || []
}

// Fetch all EPSS scores (for initial population)
async function fetchAllEPSS(limit = 50000, offset = 0) {
  const url = `${EPSS_API_BASE}?limit=${limit}&offset=${offset}`
  const response = await fetch(url)

  if (response.status !== 'OK') {
    throw new Error(`EPSS API error: ${response.status_code || 'Unknown'}`)
  }

  return {
    data: response.data || [],
    total: response.total || 0
  }
}

async function ingestEPSS() {
  console.log('Starting EPSS ingestion...')
  console.log('')

  // Get all CVEs from our database that need EPSS scores
  const { data: existingCVEs, error: fetchError } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .order('created_at', { ascending: false })

  if (fetchError) {
    console.error('Failed to fetch CVEs from database:', fetchError.message)
    process.exit(1)
  }

  console.log(`Found ${existingCVEs.length} CVEs in database`)

  let updated = 0
  let failed = 0
  let noData = 0

  // Process in batches
  const cveIds = existingCVEs.map(v => v.cve_id)
  const batches = []

  for (let i = 0; i < cveIds.length; i += BATCH_SIZE) {
    batches.push(cveIds.slice(i, i + BATCH_SIZE))
  }

  console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} CVEs each...`)
  console.log('')

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]

    try {
      const epssData = await fetchEPSSBatch(batch)

      // Create lookup map
      const epssMap = new Map()
      for (const item of epssData) {
        epssMap.set(item.cve, {
          epss_score: parseFloat(item.epss),
          epss_percentile: parseFloat(item.percentile)
        })
      }

      // Update each CVE in this batch
      for (const cveId of batch) {
        const epss = epssMap.get(cveId)

        if (epss) {
          const { error } = await supabase
            .from('vulnerabilities')
            .update({
              epss_score: epss.epss_score,
              epss_percentile: epss.epss_percentile,
              updated_at: new Date().toISOString()
            })
            .eq('cve_id', cveId)

          if (error) {
            failed++
            if (failed < 5) console.error(`  Error updating ${cveId}:`, error.message)
          } else {
            updated++
          }
        } else {
          noData++
        }
      }

      // Progress update every 10 batches
      if ((i + 1) % 10 === 0 || i === batches.length - 1) {
        console.log(`  Batch ${i + 1}/${batches.length}: Updated ${updated}, No data ${noData}, Failed ${failed}`)
      }

      // Rate limiting - be nice to the API
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (e) {
      console.error(`  Batch ${i + 1} failed:`, e.message)
      failed += batch.length
    }
  }

  console.log('')
  console.log('EPSS Ingestion Complete:')
  console.log(`  Updated: ${updated}`)
  console.log(`  No EPSS data: ${noData}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'epss',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: cveIds.length,
    records_added: 0,
    records_updated: updated,
    metadata: { no_data: noData, failed }
  })

  return { updated, noData, failed }
}

// Alternative: Fetch all high-EPSS CVEs and add them if missing
async function ingestHighRiskEPSS() {
  console.log('Fetching high-risk CVEs from EPSS (score > 0.1)...')

  // Fetch top CVEs by EPSS score
  const { data, total } = await fetchAllEPSS(10000, 0)

  console.log(`EPSS database contains ${total} CVEs`)

  // Filter to high-risk only (EPSS > 0.1 = 10% chance of exploitation)
  const highRisk = data.filter(d => parseFloat(d.epss) > 0.1)
  console.log(`Found ${highRisk.length} high-risk CVEs (EPSS > 0.1)`)

  let added = 0
  let updated = 0
  let failed = 0

  for (const item of highRisk) {
    try {
      const record = {
        cve_id: item.cve,
        epss_score: parseFloat(item.epss),
        epss_percentile: parseFloat(item.percentile),
        source: 'epss'
      }

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(record, { onConflict: 'cve_id' })

      if (error) {
        failed++
        if (failed < 5) console.error(`Error upserting ${item.cve}:`, error.message)
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log('')
  console.log('High-Risk EPSS Import Complete:')
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Failed: ${failed}`)

  return { added, failed }
}

// Main execution
const mode = process.argv[2] || 'update'

if (mode === 'full') {
  // Import high-risk CVEs that may not be in our database
  ingestHighRiskEPSS()
    .then(() => ingestEPSS())
    .catch(console.error)
} else {
  // Default: Just update existing CVEs with EPSS scores
  ingestEPSS().catch(console.error)
}
