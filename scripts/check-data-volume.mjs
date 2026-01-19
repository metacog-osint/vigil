#!/usr/bin/env node
/**
 * Check data volume across all tables
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

const tables = [
  'cyber_events', 'iocs', 'vulnerabilities', 'threat_actors',
  'incidents', 'techniques', 'malware_families', 'exploits',
  'advisories', 'atlas_case_studies', 'dns_records', 'certificates',
  'ransomware_payments', 'bgp_events', 'sync_log', 'alert_queue'
]

console.log('=== Vigil Data Volume Analysis ===\n')

let totalRecords = 0

for (const table of tables) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (!error && count !== null) {
      console.log(`${table.padEnd(25)} ${count.toLocaleString().padStart(10)} records`)
      totalRecords += count
    }
  } catch (e) {
    // Table might not exist
  }
}

console.log('')
console.log('='.repeat(45))
console.log(`${'TOTAL'.padEnd(25)} ${totalRecords.toLocaleString().padStart(10)} records`)
console.log('')

// Estimate storage (rough: ~500 bytes per record average)
const estimatedMB = (totalRecords * 500) / (1024 * 1024)
console.log(`Estimated storage: ~${estimatedMB.toFixed(1)} MB`)
console.log('')
console.log('=== Supabase Free Tier Limits ===')
console.log('Database: 500 MB')
console.log('Bandwidth: 2 GB/month')
console.log('API requests: Unlimited')
console.log('')

if (estimatedMB < 400) {
  console.log('✅ Well within free tier limits')
} else if (estimatedMB < 500) {
  console.log('⚠️  Approaching free tier limit')
} else {
  console.log('❌ May exceed free tier limit')
}
