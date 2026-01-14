#!/usr/bin/env node
/**
 * Run SQL Migration via Supabase pg API
 *
 * Uses the Supabase pg/v1/query endpoint to execute SQL migrations.
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import './env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const migrationFile = process.argv[2] || 'supabase/migrations/010_notifications_and_alerts.sql'
const migrationPath = join(__dirname, '..', migrationFile)

async function runSQL(sql) {
  // Try the pg/v1/query endpoint (experimental)
  const response = await fetch(`${supabaseUrl}/pg/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SQL execution failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║   Running SQL Migration                            ║')
  console.log('╚════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Migration: ${migrationFile}`)
  console.log()

  const sql = readFileSync(migrationPath, 'utf-8')
  console.log(`SQL length: ${sql.length} characters`)
  console.log()

  try {
    console.log('Executing migration...')
    const result = await runSQL(sql)
    console.log('✓ Migration applied successfully!')
    console.log()
    if (result) {
      console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500))
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message)
    console.log()
    console.log('The pg/v1/query endpoint may not be available.')
    console.log('Please apply the migration manually via the Supabase dashboard:')
    console.log()
    console.log('  https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql')
    process.exit(1)
  }
}

main().catch(console.error)
