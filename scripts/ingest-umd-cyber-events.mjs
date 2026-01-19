#!/usr/bin/env node
/**
 * UMD CISSM Cyber Events Database Ingestion
 *
 * Parses the Excel file from UMD's Cyber Events Database and uploads to Supabase.
 * The database is updated monthly and requires manual download.
 *
 * Source: https://cissm.umd.edu/cyber-events-database
 *
 * Usage:
 *   npm run ingest:umd-cyber-events
 *   node scripts/ingest-umd-cyber-events.mjs [path-to-xlsx]
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { supabaseUrl, supabaseKey } from './env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Supabase client
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Geopolitical flag columns to extract
const GEOPOLITICAL_COLUMNS = [
  'nato', 'eu', 'shanghai_coop', 'oas', 'mercosur', 'au', 'ecowas',
  'asean', 'opec', 'gulf_coop', 'g7', 'g20', 'aukus', 'csto', 'oecd', 'osce', 'five_eyes'
]

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null
  // Excel dates start from 1900-01-01, but there's a bug where 1900 is treated as leap year
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  return date.toISOString().split('T')[0]
}

/**
 * Transform a row from the Excel file to our database format
 */
function transformRow(row) {
  // Extract geopolitical flags
  const geopoliticalFlags = {}
  for (const flag of GEOPOLITICAL_COLUMNS) {
    if (row[flag] !== undefined) {
      geopoliticalFlags[flag] = row[flag] === 1 || row[flag] === '1' || row[flag] === true
    }
  }

  // Parse event date
  let eventDate = null
  if (row.event_date) {
    if (typeof row.event_date === 'number') {
      eventDate = excelDateToJS(row.event_date)
    } else if (typeof row.event_date === 'string') {
      eventDate = row.event_date
    }
  }

  // Parse reported date
  let reportedDate = null
  if (row.reported_date) {
    if (typeof row.reported_date === 'number') {
      reportedDate = excelDateToJS(row.reported_date)
    } else if (typeof row.reported_date === 'string') {
      reportedDate = row.reported_date
    }
  }

  // Clean event_type (there's a trailing space in some values)
  const eventType = row.event_type ? row.event_type.trim() : null

  return {
    slug: row.slug,
    event_date: eventDate,
    reported_date: reportedDate,
    year: row.year ? parseInt(row.year) : null,
    month: row.month ? parseInt(row.month) : null,
    actor_name: row.actor && row.actor !== 'Undetermined' ? row.actor : null,
    actor_type: row.actor_type || null,
    actor_country: row.actor_country && row.actor_country !== 'Undetermined' ? row.actor_country : null,
    target_organization: row.organization || null,
    target_industry: row.industry || null,
    target_industry_code: row.industry_code ? String(row.industry_code) : null,
    target_country: row.country || null,
    target_state: row.state || null,
    target_county: row.county || null,
    event_type: eventType,
    event_subtype: row.event_subtype || null,
    motive: row.motive && row.motive !== 'Undetermined' ? row.motive : null,
    magnitude: row.magnitude || null,
    duration: row.duration || null,
    scope: row.scope || null,
    ip_affected: row.ip === 1 || row.ip === '1' || row.ip === true,
    org_data_affected: row.org_data === 1 || row.org_data === '1' || row.org_data === true,
    customer_data_affected: row.cust_data === 1 || row.cust_data === '1' || row.cust_data === true,
    description: row.description || null,
    source_url: row.source_url || null,
    geopolitical_flags: geopoliticalFlags,
    original_method: row.original_method ? parseInt(row.original_method) : null,
    source: 'umd-cissm'
  }
}

/**
 * Find the UMD Excel file
 */
function findUmdFile(customPath) {
  // Check custom path first
  if (customPath && existsSync(customPath)) {
    return customPath
  }

  // Check umd directory
  const umdDir = join(__dirname, '..', 'umd')
  if (existsSync(umdDir)) {
    const files = readdirSync(umdDir).filter(f => f.endsWith('.xlsx'))
    if (files.length > 0) {
      // Sort to get the latest file
      files.sort().reverse()
      return join(umdDir, files[0])
    }
  }

  return null
}

/**
 * Main ingestion function
 */
async function ingestUmdCyberEvents(filePath) {
  console.log('Starting UMD Cyber Events ingestion...')

  const xlsxPath = findUmdFile(filePath)
  if (!xlsxPath) {
    console.error('No UMD Excel file found')
    console.error('Please download from: https://cissm.umd.edu/cyber-events-database')
    console.error('Place the file in the ./umd directory')
    process.exit(1)
  }

  console.log(`Reading file: ${xlsxPath}`)

  // Read the Excel file
  const workbook = XLSX.readFile(xlsxPath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet)
  console.log(`Found ${data.length} records`)

  // Transform all rows
  const records = data.map(transformRow).filter(r => r.slug)

  console.log(`Transformed ${records.length} valid records`)

  // Statistics
  const stats = {
    total: records.length,
    byActorType: {},
    byEventType: {},
    byYear: {},
    inserted: 0,
    updated: 0,
    failed: 0
  }

  // Count statistics
  records.forEach(r => {
    if (r.actor_type) {
      stats.byActorType[r.actor_type] = (stats.byActorType[r.actor_type] || 0) + 1
    }
    if (r.event_type) {
      stats.byEventType[r.event_type] = (stats.byEventType[r.event_type] || 0) + 1
    }
    if (r.year) {
      stats.byYear[r.year] = (stats.byYear[r.year] || 0) + 1
    }
  })

  // Batch upsert to Supabase
  const batchSize = 100
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const progress = Math.round((i / records.length) * 100)

    process.stdout.write(`\rUploading: ${progress}% (${i}/${records.length})`)

    const { error, count } = await supabase
      .from('cyber_events')
      .upsert(batch, {
        onConflict: 'slug',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`\nBatch error at ${i}: ${error.message}`)
      stats.failed += batch.length
    } else {
      stats.inserted += batch.length
    }
  }

  console.log('\n')

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'umd-cyber-events',
    status: stats.failed === 0 ? 'success' : 'partial',
    completed_at: new Date().toISOString(),
    metadata: {
      total_records: stats.total,
      inserted: stats.inserted,
      failed: stats.failed,
      by_actor_type: stats.byActorType,
      by_event_type: stats.byEventType,
      file: xlsxPath
    }
  })

  // Refresh materialized view
  console.log('Refreshing actor statistics...')
  const { error: refreshError } = await supabase.rpc('refresh_cyber_event_stats')
  if (refreshError) {
    console.warn('Could not refresh stats view:', refreshError.message)
  }

  // Print summary
  console.log('\n=== Ingestion Complete ===')
  console.log(`Total records: ${stats.total}`)
  console.log(`Uploaded: ${stats.inserted}`)
  console.log(`Failed: ${stats.failed}`)

  console.log('\nBy Actor Type:')
  Object.entries(stats.byActorType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${type}: ${count}`))

  console.log('\nBy Event Type:')
  Object.entries(stats.byEventType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${type}: ${count}`))

  console.log('\nBy Year (last 5):')
  Object.entries(stats.byYear)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .slice(0, 5)
    .forEach(([year, count]) => console.log(`  ${year}: ${count}`))

  return stats
}

// Run if called directly
const customPath = process.argv[2]
ingestUmdCyberEvents(customPath)
  .then(stats => {
    console.log('\nDone!')
    process.exit(stats.failed > 0 ? 1 : 0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
