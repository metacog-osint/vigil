// VulnCheck KEV Ingestion
// Fetches extended KEV (Known Exploited Vulnerabilities) data from VulnCheck
// Run: node scripts/ingest-vulncheck.mjs
//
// VulnCheck's KEV catalog is 173% larger than CISA KEV and detects
// exploited CVEs 27 days faster on average. Free community tier available.
// API docs: https://docs.vulncheck.com/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, vulncheckApiKey } from './env.mjs'

const VULNCHECK_API_BASE = 'https://api.vulncheck.com/v3'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!vulncheckApiKey) {
  console.error('Missing VULNCHECK_API_KEY. Get a free key at https://vulncheck.com/')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${vulncheckApiKey}`,
        'Accept': 'application/json',
        ...options.headers
      }
    }

    const req = https.request(reqOptions, (res) => {
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
    })

    req.on('error', reject)
    req.end()
  })
}

// Fetch VulnCheck KEV data
async function fetchVulnCheckKEV(cursor = null) {
  let url = `${VULNCHECK_API_BASE}/index/vulncheck-kev?token=${vulncheckApiKey}`
  if (cursor) {
    url += `&cursor=${cursor}`
  }
  return await fetch(url)
}

// Fetch exploit intelligence for a CVE
async function fetchExploitIntel(cveId) {
  const url = `${VULNCHECK_API_BASE}/cve/${cveId}`
  try {
    return await fetch(url)
  } catch (e) {
    return null
  }
}

async function ingestVulnCheckKEV() {
  console.log('Starting VulnCheck KEV ingestion...')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let cursor = null
  let totalFetched = 0

  do {
    try {
      const response = await fetchVulnCheckKEV(cursor)
      const items = response.data || []
      cursor = response._meta?.next_cursor || null

      totalFetched += items.length
      console.log(`Fetched ${items.length} KEV entries (total: ${totalFetched})...`)

      for (const item of items) {
        try {
          // Map VulnCheck KEV fields to our schema
          const record = {
            cve_id: item.cve,
            title: item.name || item.short_description,
            description: item.description,
            severity: mapSeverity(item.cvss_score),
            cvss_score: item.cvss_score || null,
            cvss_version: item.cvss_version || null,
            is_kev: true,
            kev_date_added: item.date_added || null,
            kev_due_date: item.due_date || null,
            exploit_available: true,
            exploit_maturity: determineExploitMaturity(item),
            ransomware_use: item.known_ransomware_campaign_use === 'Known',
            vendor: item.vendor_project || null,
            product: item.product || null,
            source: 'vulncheck-kev',
            metadata: {
              vulncheck_id: item.vulncheck_id,
              xdb_ids: item.xdb || [],
              references: item.references || [],
              cwe: item.cwe || [],
              timeline: item.timeline || null,
              exploit_sources: item.exploit_sources || []
            },
            updated_at: new Date().toISOString()
          }

          // Upsert to vulnerabilities table
          const { data, error } = await supabase
            .from('vulnerabilities')
            .upsert(record, {
              onConflict: 'cve_id',
              ignoreDuplicates: false
            })
            .select('cve_id')

          if (error) {
            failed++
            if (failed <= 5) {
              console.error(`  Error upserting ${item.cve}:`, error.message)
            }
          } else {
            // Check if this was an insert or update
            updated++
          }
        } catch (e) {
          failed++
          if (failed <= 5) {
            console.error(`  Error processing ${item.cve}:`, e.message)
          }
        }
      }

      // Rate limiting
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }

    } catch (e) {
      console.error('Error fetching VulnCheck KEV data:', e.message)
      break
    }
  } while (cursor)

  console.log('')
  console.log('VulnCheck KEV Ingestion Complete:')
  console.log(`  Total fetched: ${totalFetched}`)
  console.log(`  Added/Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'vulncheck-kev',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalFetched,
    records_added: added,
    records_updated: updated,
    metadata: { failed }
  })

  return { totalFetched, added, updated, failed }
}

function mapSeverity(cvssScore) {
  if (!cvssScore) return 'medium'
  if (cvssScore >= 9.0) return 'critical'
  if (cvssScore >= 7.0) return 'high'
  if (cvssScore >= 4.0) return 'medium'
  return 'low'
}

function determineExploitMaturity(item) {
  // VulnCheck provides more granular exploit maturity data
  if (item.known_ransomware_campaign_use === 'Known') return 'weaponized'
  if (item.xdb && item.xdb.length > 0) return 'poc'
  if (item.in_the_wild) return 'active'
  return 'reported'
}

// Main execution
ingestVulnCheckKEV().catch(console.error)
