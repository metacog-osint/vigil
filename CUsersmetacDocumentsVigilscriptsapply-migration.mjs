#\!/usr/bin/env node

/**
 * Migration Application Helper
 *
 * This script prints the migration file contents and provides the
 * Supabase Dashboard URL for applying migrations.
 *
 * Usage: node scripts/apply-migration.mjs [migration-file]
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const migrationFile = process.argv[2] || 'supabase/migrations/028_realtime_alerts.sql'
const supabaseProjectRef = 'faqazkwdkajhxmwxchop'

console.log('=' .repeat(60))
console.log('MIGRATION APPLICATION HELPER')
console.log('=' .repeat(60))
console.log()
console.log('Migration file:', migrationFile)
console.log()
console.log('To apply this migration:')
console.log()
console.log('1. Open the Supabase SQL Editor:')
console.log(\)
console.log()
console.log('2. Copy and paste the SQL below')
console.log()
console.log('3. Click "Run" to execute')
console.log()
console.log('=' .repeat(60))
console.log('MIGRATION SQL:')
console.log('=' .repeat(60))
console.log()

try {
  const fullPath = join(__dirname, '..', migrationFile)
  const sql = readFileSync(fullPath, 'utf8')
  console.log(sql)
  console.log()
  console.log('=' .repeat(60))
  console.log('END OF MIGRATION')
  console.log('=' .repeat(60))
} catch (err) {
  console.error('Error reading migration file:', err.message)
  process.exit(1)
}

