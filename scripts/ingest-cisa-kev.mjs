// CISA Known Exploited Vulnerabilities (KEV) Ingestion
// Fetches the KEV catalog and populates the vulnerabilities table
// Run: node scripts/ingest-cisa-kev.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

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
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function ingestCISAKEV() {
  console.log('Fetching CISA KEV catalog...')

  const data = await fetch(CISA_KEV_URL)
  const vulnerabilities = data.vulnerabilities || []

  console.log(`Found ${vulnerabilities.length} KEV entries`)
  console.log(`Catalog version: ${data.catalogVersion}`)
  console.log(`Last updated: ${data.dateReleased}`)

  let added = 0
  let updated = 0
  let failed = 0

  for (const vuln of vulnerabilities) {
    try {
      const record = {
        cve_id: vuln.cveID,
        description: vuln.shortDescription,
        affected_vendors: [vuln.vendorProject],
        affected_products: [vuln.product],
        kev_date: vuln.dateAdded,
        kev_due_date: vuln.dueDate,
        exploited_in_wild: true,
        ransomware_campaign_use: vuln.knownRansomwareCampaignUse === 'Known',
        source: 'cisa_kev',
        metadata: {
          vulnerability_name: vuln.vulnerabilityName,
          required_action: vuln.requiredAction,
          notes: vuln.notes,
        }
      }

      const { error } = await supabase
        .from('vulnerabilities')
        .upsert(record, { onConflict: 'cve_id' })

      if (error) {
        failed++
        if (failed < 5) console.error(`Error inserting ${vuln.cveID}:`, error.message)
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log(`\nCISA KEV Ingestion Complete:`)
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'cisa_kev',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: vulnerabilities.length,
    records_added: added,
  })

  return { added, failed }
}

ingestCISAKEV().catch(console.error)
