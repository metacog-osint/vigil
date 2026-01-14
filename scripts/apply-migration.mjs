// Apply a single migration file to Supabase
// Usage: node scripts/apply-migration.mjs <migration-file>

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabaseUrl, supabaseKey } from './env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration(migrationFile) {
  const filePath = path.resolve(__dirname, '..', migrationFile)

  if (!fs.existsSync(filePath)) {
    console.error(`Migration file not found: ${filePath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(filePath, 'utf-8')

  console.log(`Applying migration: ${migrationFile}`)
  console.log('─'.repeat(50))

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // If rpc doesn't exist, try direct query approach
    // Note: This requires the service role key with proper permissions
    console.log('RPC not available, attempting direct execution...')

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        const { error: stmtError } = await supabase.from('_migrations_temp').select('*').limit(0)
        // This won't work directly - Supabase JS doesn't support raw SQL
      } catch (e) {
        // Expected
      }
    }

    console.error('\nCannot run raw SQL via Supabase JS client.')
    console.log('\nPlease apply the migration manually:')
    console.log('1. Go to: https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql')
    console.log('2. Copy and paste the contents of:', migrationFile)
    console.log('3. Click "Run"')
    console.log('\n─'.repeat(50))
    console.log('Migration SQL preview (first 500 chars):')
    console.log(sql.substring(0, 500))
    process.exit(1)
  }

  console.log('✓ Migration applied successfully')
}

const migrationFile = process.argv[2] || 'supabase/migrations/009_malware_samples.sql'
applyMigration(migrationFile).catch(console.error)
