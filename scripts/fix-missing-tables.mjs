import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('Supabase URL:', supabaseUrl)
console.log('Service key present:', !!supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

// Test connection
async function testConnection() {
  const { data, error } = await supabase.from('threat_actors').select('id').limit(1)
  if (error) {
    console.error('Connection error:', error.message)
    return false
  }
  console.log('Connection OK - threat_actors accessible')
  return true
}

// Check which tables are missing
async function checkTables() {
  const tables = ['alerts', 'breaches', 'malware_samples', 'blocklists', 'threat_feeds', 'sync_log']
  const missing = []
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error && error.code === 'PGRST205') {
      console.log(`❌ ${table}: MISSING`)
      missing.push(table)
    } else if (error) {
      console.log(`⚠️ ${table}: ${error.message}`)
    } else {
      console.log(`✓ ${table}: EXISTS`)
    }
  }
  
  return missing
}

async function main() {
  if (!await testConnection()) {
    process.exit(1)
  }
  
  console.log('\nChecking tables...')
  const missing = await checkTables()
  
  if (missing.length > 0) {
    console.log(`\n${missing.length} tables are missing. You need to run SQL in Supabase Dashboard.`)
    console.log('\nGo to: https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql/new')
    console.log('\nRun these SQL files in order:')
    if (missing.includes('alerts') || missing.includes('malware_samples') || missing.includes('blocklists') || missing.includes('threat_feeds') || missing.includes('sync_log')) {
      console.log('  - supabase/migrations/005_alerts_and_feeds.sql')
    }
    if (missing.includes('breaches')) {
      console.log('  - supabase/migrations/008_breaches_and_enrichment.sql')
    }
  } else {
    console.log('\nAll tables exist!')
  }
}

main().catch(console.error)
