#!/usr/bin/env node
/**
 * Execute a SQL migration file against Supabase
 * Uses the Supabase Management API to execute SQL
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { supabaseUrl, supabaseKey } from './env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function executeMigration(migrationFile) {
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile)

  console.log('Reading migration:', migrationPath)
  const sql = readFileSync(migrationPath, 'utf-8')
  console.log('SQL length:', sql.length, 'characters')

  // Split into individual statements (simple split on semicolons not inside quotes)
  // For complex migrations, we execute statement by statement
  const statements = sql
    .split(/;[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements`)
  console.log('')

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ')

    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}...`)

    try {
      // Use Supabase's REST API to execute SQL via rpc
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql: stmt + ';' })
      })

      if (response.ok) {
        console.log(' ✓')
        succeeded++
      } else {
        const errorText = await response.text()
        // Check if it's just a "function not found" error
        if (errorText.includes('function') && errorText.includes('does not exist')) {
          // Try alternative: execute via postgres protocol if available
          console.log(' (rpc not available)')
          failed++
        } else {
          console.log(` ✗ ${errorText.substring(0, 100)}`)
          failed++
        }
      }
    } catch (e) {
      console.log(` ✗ ${e.message}`)
      failed++
    }
  }

  console.log('')
  console.log('=== Migration Summary ===')
  console.log(`Succeeded: ${succeeded}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log('')
    console.log('Some statements failed. You may need to run this migration manually:')
    console.log('1. Open Supabase Dashboard > SQL Editor')
    console.log('2. Paste the contents of:', migrationPath)
    console.log('3. Run the query')
  }
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.log('Usage: node execute-migration.mjs <migration-file>')
  console.log('Example: node execute-migration.mjs 061_cyber_events.sql')
  process.exit(1)
}

executeMigration(migrationFile)
