// Process Saved Search Alerts
// Checks saved searches for new results and queues alerts
// Run: node scripts/process-search-alerts.mjs [--frequency=daily]

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Page to table mapping
const PAGE_TABLES = {
  actors: 'threat_actors',
  incidents: 'incidents',
  vulnerabilities: 'vulnerabilities',
  iocs: 'iocs',
  events: 'cyber_events',
  advisories: 'advisories',
  malware: 'malware_samples',
}

// Frequency intervals in milliseconds
const FREQUENCY_INTERVALS = {
  realtime: 5 * 60 * 1000,      // 5 minutes
  hourly: 60 * 60 * 1000,       // 1 hour
  daily: 24 * 60 * 60 * 1000,   // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
}

function hashResults(results) {
  const ids = results.map(r => r.id || r.cve_id || r.value).sort().join(',')
  return crypto.createHash('md5').update(ids).digest('hex')
}

function buildFilterQuery(table, filters) {
  // Build Supabase query from saved filter configuration
  let query = supabase.from(table).select('*', { count: 'exact' })

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue

    switch (key) {
      case 'search':
      case 'query':
        // Text search - depends on table
        if (table === 'threat_actors') {
          query = query.or(`name.ilike.%${value}%,aliases.cs.{${value}}`)
        } else if (table === 'incidents') {
          query = query.or(`victim_name.ilike.%${value}%,description.ilike.%${value}%`)
        } else if (table === 'vulnerabilities') {
          query = query.or(`cve_id.ilike.%${value}%,description.ilike.%${value}%`)
        } else if (table === 'iocs') {
          query = query.ilike('value', `%${value}%`)
        }
        break

      case 'status':
      case 'trend_status':
        query = query.eq('trend_status', value)
        break

      case 'sector':
      case 'target_sector':
        if (Array.isArray(value)) {
          query = query.overlaps('target_sectors', value)
        } else {
          query = query.contains('target_sectors', [value])
        }
        break

      case 'severity':
        query = query.eq('severity', value)
        break

      case 'is_kev':
      case 'in_kev':
        if (value === true || value === 'true') {
          query = query.eq('is_kev', true)
        }
        break

      case 'type':
        query = query.eq('type', value)
        break

      case 'source':
        query = query.eq('source', value)
        break

      case 'dateRange':
        const days = parseInt(value.replace('d', ''), 10)
        if (!isNaN(days)) {
          const since = new Date()
          since.setDate(since.getDate() - days)
          query = query.gte('created_at', since.toISOString())
        }
        break

      case 'minCvss':
        query = query.gte('cvss_score', parseFloat(value))
        break

      case 'minEpss':
        query = query.gte('epss_score', parseFloat(value))
        break

      default:
        // Try exact match for unknown filters
        if (typeof value === 'boolean' || typeof value === 'number') {
          query = query.eq(key, value)
        } else if (typeof value === 'string' && !value.includes('%')) {
          query = query.eq(key, value)
        }
    }
  }

  return query
}

async function checkSavedSearch(search) {
  const table = PAGE_TABLES[search.page]
  if (!table) {
    console.log(`  Unknown page type: ${search.page}`)
    return null
  }

  try {
    // Build and execute query
    let query = buildFilterQuery(table, search.filters || {})

    // Apply sort
    if (search.sort_by) {
      query = query.order(search.sort_by, { ascending: search.sort_order === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Limit to recent results for comparison
    query = query.limit(100)

    const { data: results, count, error } = await query

    if (error) {
      console.log(`  Query error: ${error.message}`)
      return null
    }

    const resultHash = hashResults(results || [])
    const newCount = count || 0

    return {
      results: results || [],
      count: newCount,
      hash: resultHash,
      hasNewResults: resultHash !== search.last_result_hash && newCount > (search.last_result_count || 0),
      newResultsCount: Math.max(0, newCount - (search.last_result_count || 0)),
    }
  } catch (error) {
    console.log(`  Error: ${error.message}`)
    return null
  }
}

async function queueSearchAlert(search, checkResult) {
  // Create alert history record
  const sampleResults = checkResult.results.slice(0, 5).map(r => ({
    id: r.id || r.cve_id,
    name: r.name || r.victim_name || r.cve_id || r.value,
    type: search.page,
    created_at: r.created_at,
  }))

  const { error: historyError } = await supabase
    .from('search_alert_history')
    .insert({
      saved_search_id: search.id,
      user_id: search.user_id,
      new_results_count: checkResult.newResultsCount,
      previous_count: search.last_result_count || 0,
      sample_results: sampleResults,
      channels_sent: search.alert_channels || ['email'],
    })

  if (historyError) {
    console.log(`  Failed to create alert history: ${historyError.message}`)
  }

  // Queue alert for processing
  const { error: queueError } = await supabase
    .from('alert_queue')
    .insert({
      event_type: 'search.new_results',
      event_id: search.id,
      user_id: search.user_id,
      priority: 'normal',
      payload: {
        search_id: search.id,
        search_name: search.name,
        page: search.page,
        new_count: checkResult.newResultsCount,
        total_count: checkResult.count,
        sample_results: sampleResults,
        filters: search.filters,
      },
    })

  if (queueError) {
    console.log(`  Failed to queue alert: ${queueError.message}`)
  }

  // Update saved search with new state
  await supabase
    .from('saved_searches')
    .update({
      last_result_count: checkResult.count,
      last_result_hash: checkResult.hash,
      last_alert_at: new Date().toISOString(),
    })
    .eq('id', search.id)
}

async function processSearchAlerts(frequency = null) {
  console.log('=== Processing Saved Search Alerts ===')
  console.log(`Frequency filter: ${frequency || 'all'}`)
  console.log('')

  // Get saved searches with alerting enabled
  let query = supabase
    .from('saved_searches')
    .select('*')
    .eq('alert_enabled', true)

  if (frequency) {
    query = query.eq('alert_frequency', frequency)
  }

  const { data: searches, error } = await query

  if (error) {
    console.error('Error fetching saved searches:', error)
    return
  }

  if (!searches || searches.length === 0) {
    console.log('No saved searches with alerting enabled')
    return
  }

  console.log(`Found ${searches.length} saved searches to check`)

  let checked = 0
  let alerted = 0
  let skipped = 0

  for (const search of searches) {
    console.log(`\nChecking: ${search.name} (${search.page})`)

    // Check if enough time has passed since last alert
    if (search.last_alert_at) {
      const interval = FREQUENCY_INTERVALS[search.alert_frequency] || FREQUENCY_INTERVALS.daily
      const lastAlert = new Date(search.last_alert_at)
      const nextCheck = new Date(lastAlert.getTime() + interval)

      if (new Date() < nextCheck) {
        console.log(`  Skipped - next check at ${nextCheck.toISOString()}`)
        skipped++
        continue
      }
    }

    const checkResult = await checkSavedSearch(search)

    if (!checkResult) {
      console.log(`  Failed to check search`)
      continue
    }

    checked++
    console.log(`  Results: ${checkResult.count} (previous: ${search.last_result_count || 0})`)

    if (checkResult.hasNewResults) {
      console.log(`  New results found: ${checkResult.newResultsCount}`)
      await queueSearchAlert(search, checkResult)
      alerted++
    } else {
      // Update hash even if no new results
      await supabase
        .from('saved_searches')
        .update({
          last_result_count: checkResult.count,
          last_result_hash: checkResult.hash,
        })
        .eq('id', search.id)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total searches: ${searches.length}`)
  console.log(`Checked: ${checked}`)
  console.log(`Skipped (not due): ${skipped}`)
  console.log(`Alerts queued: ${alerted}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'search_alerts',
    status: 'completed',
    records_processed: checked,
    records_inserted: alerted,
    metadata: {
      frequency,
      total_searches: searches.length,
      skipped,
    },
  })
}

// Main
const args = process.argv.slice(2)
const frequency = args.find(a => a.startsWith('--frequency='))?.split('=')[1]

if (args.includes('--help') || args.includes('-h')) {
  console.log('Process Saved Search Alerts')
  console.log('')
  console.log('Usage: node scripts/process-search-alerts.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --frequency=TYPE   Process only searches with this frequency')
  console.log('                     (realtime, hourly, daily, weekly)')
  console.log('')
  console.log('Typically run via cron:')
  console.log('  */5 * * * * --frequency=realtime')
  console.log('  0 * * * *   --frequency=hourly')
  console.log('  0 8 * * *   --frequency=daily')
  console.log('  0 8 * * 1   --frequency=weekly')
} else {
  processSearchAlerts(frequency)
}
