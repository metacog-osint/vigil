// NVD (National Vulnerability Database) CVE Ingestion
// Fetches recent CVEs with CVSS scores
// Run: node scripts/ingest-nvd.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// NVD API - get CVEs modified in the last 30 days
const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

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
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`))
        }
      })
    }).on('error', reject)
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractCVSS(metrics) {
  // Try CVSS 3.1, then 3.0, then 2.0
  if (metrics?.cvssMetricV31?.[0]) {
    const m = metrics.cvssMetricV31[0].cvssData
    return { score: m.baseScore, vector: m.vectorString }
  }
  if (metrics?.cvssMetricV30?.[0]) {
    const m = metrics.cvssMetricV30[0].cvssData
    return { score: m.baseScore, vector: m.vectorString }
  }
  if (metrics?.cvssMetricV2?.[0]) {
    const m = metrics.cvssMetricV2[0].cvssData
    return { score: m.baseScore, vector: m.vectorString }
  }
  return { score: null, vector: null }
}

function extractProducts(configurations) {
  const vendors = new Set()
  const products = new Set()

  try {
    for (const config of configurations || []) {
      for (const node of config.nodes || []) {
        for (const match of node.cpeMatch || []) {
          const parts = match.criteria?.split(':') || []
          if (parts.length >= 5) {
            vendors.add(parts[3])
            products.add(parts[4])
          }
        }
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return {
    vendors: [...vendors].filter(v => v && v !== '*'),
    products: [...products].filter(p => p && p !== '*')
  }
}

async function ingestNVD() {
  console.log('Fetching NVD CVEs (last 30 days)...')

  // Calculate date range - last 30 days
  const endDate = new Date()
  const startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000)

  const startStr = startDate.toISOString().split('.')[0] + 'Z'
  const endStr = endDate.toISOString().split('.')[0] + 'Z'

  const url = `${NVD_API}?lastModStartDate=${startStr}&lastModEndDate=${endStr}&resultsPerPage=500`

  console.log(`Fetching from: ${startStr} to ${endStr}`)

  let response
  try {
    response = await fetch(url)
  } catch (e) {
    console.error('Failed to fetch NVD API:', e.message)
    return
  }

  const vulnerabilities = response.vulnerabilities || []
  console.log(`Found ${vulnerabilities.length} CVEs (total results: ${response.totalResults})`)

  let added = 0
  let updated = 0
  let failed = 0

  for (const item of vulnerabilities) {
    try {
      const cve = item.cve
      const cvss = extractCVSS(cve.metrics)
      const { vendors, products } = extractProducts(cve.configurations)

      // Get description in English
      const description = cve.descriptions?.find(d => d.lang === 'en')?.value || ''

      const record = {
        cve_id: cve.id,
        cvss_score: cvss.score,
        cvss_vector: cvss.vector,
        description: description.slice(0, 2000), // Limit length
        affected_vendors: vendors.slice(0, 10),
        affected_products: products.slice(0, 10),
        exploited_in_wild: false, // Will be updated by KEV data
        source: 'nvd',
        metadata: {
          published: cve.published,
          lastModified: cve.lastModified,
          vulnStatus: cve.vulnStatus,
        }
      }

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(record, {
          onConflict: 'cve_id',
          ignoreDuplicates: false
        })

      if (error) {
        failed++
        if (failed < 5) console.error(`Error inserting ${cve.id}:`, error.message)
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log(`\nNVD Ingestion Complete:`)
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Failed: ${failed}`)

  // Show severity breakdown
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
  for (const item of vulnerabilities) {
    const cvss = extractCVSS(item.cve.metrics)
    if (!cvss.score) severityCounts.unknown++
    else if (cvss.score >= 9.0) severityCounts.critical++
    else if (cvss.score >= 7.0) severityCounts.high++
    else if (cvss.score >= 4.0) severityCounts.medium++
    else severityCounts.low++
  }
  console.log('\nSeverity breakdown:')
  Object.entries(severityCounts).forEach(([sev, count]) => {
    if (count > 0) console.log(`  ${sev}: ${count}`)
  })

  await supabase.from('sync_log').insert({
    source: 'nvd',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: vulnerabilities.length,
    records_added: added,
  })

  return { added, failed }
}

ingestNVD().catch(console.error)
