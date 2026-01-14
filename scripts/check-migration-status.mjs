#!/usr/bin/env node
/**
 * Check Migration Status
 *
 * Checks which Sprint 2 tables exist and provides
 * instructions for applying the migration.
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

const SPRINT2_TABLES = [
  { name: 'notifications', description: 'In-app notifications for users' },
  { name: 'user_alert_rules', description: 'Custom alert rule configurations' },
  { name: 'alert_triggers', description: 'Audit log of triggered alerts' },
  { name: 'threat_hunts', description: 'Actionable threat detection guides' },
  { name: 'user_hunt_progress', description: 'User progress on threat hunts' },
]

const SPRINT2_COLUMNS = [
  { table: 'user_preferences', column: 'digest_frequency', description: 'Email digest frequency setting' },
  { table: 'user_preferences', column: 'email_alerts', description: 'Email alerts enabled flag' },
]

async function checkTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('id').limit(1)
  if (error?.code === '42P01') {
    return { exists: false, error: 'Table does not exist' }
  }
  if (error?.code === 'PGRST116') {
    return { exists: true, error: null } // Table exists but is empty
  }
  if (error) {
    return { exists: false, error: error.message }
  }
  return { exists: true, count: data?.length || 0 }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║   Sprint 2 Migration Status Check                  ║')
  console.log('╚════════════════════════════════════════════════════╝')
  console.log()

  let needsMigration = false

  // Check tables
  console.log('Checking Sprint 2 tables...')
  console.log()

  for (const table of SPRINT2_TABLES) {
    const result = await checkTable(table.name)
    if (result.exists) {
      console.log(`  ✓ ${table.name}`)
      console.log(`    ${table.description}`)
    } else {
      console.log(`  ✗ ${table.name} - MISSING`)
      console.log(`    ${table.description}`)
      needsMigration = true
    }
  }

  console.log()

  // Check user_preferences columns
  console.log('Checking user_preferences columns...')
  const { data: prefsData } = await supabase.from('user_preferences').select('*').limit(1)

  if (prefsData && prefsData.length > 0) {
    const sample = prefsData[0]
    for (const col of SPRINT2_COLUMNS) {
      if (col.column in sample) {
        console.log(`  ✓ ${col.column}`)
      } else {
        console.log(`  ✗ ${col.column} - MISSING`)
        needsMigration = true
      }
    }
  } else {
    console.log('  ? Could not check columns (no user_preferences rows)')
  }

  console.log()
  console.log('═'.repeat(56))
  console.log()

  if (needsMigration) {
    console.log('⚠️  MIGRATION REQUIRED')
    console.log()
    console.log('Please apply migration 010_notifications_and_alerts.sql:')
    console.log()
    console.log('1. Open Supabase SQL Editor:')
    console.log('   https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql')
    console.log()
    console.log('2. Copy the contents of:')
    console.log('   supabase/migrations/010_notifications_and_alerts.sql')
    console.log()
    console.log('3. Paste into the SQL Editor and click "Run"')
    console.log()
  } else {
    console.log('✓ All Sprint 2 tables exist!')
    console.log()
    console.log('Migration 010 has already been applied.')
  }
}

main().catch(console.error)
