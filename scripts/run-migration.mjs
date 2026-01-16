// Run a migration SQL file directly against the remote database
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { supabaseUrl, supabaseKey } from './env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  const migrationFile = process.argv[2] || '051_sandbox_reports.sql'
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile)

  console.log('Running migration:', migrationFile)

  try {
    const sql = readFileSync(migrationPath, 'utf-8')
    console.log('SQL loaded, length:', sql.length)
    
    // Use Supabase's SQL execution via REST
    const response = await fetch(supabaseUrl + '/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      },
      body: JSON.stringify({ query: sql })
    })
    
    if (!response.ok) {
      console.log('RPC method not available - this is expected')
      console.log('Please run the migration manually in Supabase Dashboard > SQL Editor')
      console.log('')
      console.log('Migration file:', migrationPath)
    }
  } catch (e) {
    console.error('Error:', e.message)
  }
}

runMigration()
