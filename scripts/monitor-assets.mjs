// Asset Monitoring Script
// Checks monitored assets against IOC feeds and creates alerts
// Run: node scripts/monitor-assets.mjs
// Schedule: Every 30 minutes via cron

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Get all monitored assets
async function getMonitoredAssets() {
  const { data, error } = await supabase
    .from('assets')
    .select('id, user_id, asset_type, value, name, criticality, notify_on_match')
    .eq('is_monitored', true)

  if (error) {
    console.error('Error fetching assets:', error.message)
    return []
  }

  return data || []
}

// Check domain/email domain assets against IOCs
async function checkDomainAsset(asset) {
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('id, value, ioc_type, threat_type, confidence, source')
    .or(`value.ilike.%${asset.value}%,value.eq.${asset.value}`)
    .limit(50)

  if (error) {
    console.error(`Error checking domain ${asset.value}:`, error.message)
    return []
  }

  return iocs || []
}

// Check IP assets against IOCs
async function checkIPAsset(asset) {
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('id, value, ioc_type, threat_type, confidence, source')
    .eq('value', asset.value)
    .limit(50)

  if (error) {
    console.error(`Error checking IP ${asset.value}:`, error.message)
    return []
  }

  return iocs || []
}

// Check keyword assets against incidents
async function checkKeywordAsset(asset) {
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('id, victim_name, sector, discovered_at')
    .ilike('victim_name', `%${asset.value}%`)
    .limit(50)

  if (error) {
    console.error(`Error checking keyword ${asset.value}:`, error.message)
    return []
  }

  return incidents || []
}

// Check if match already exists
async function matchExists(assetId, sourceTable, sourceId) {
  const { data, error } = await supabase
    .from('asset_matches')
    .select('id')
    .eq('asset_id', assetId)
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .single()

  return !error && data
}

// Create a new match
async function createMatch(asset, matchType, sourceTable, sourceId, matchedValue, context) {
  // Determine severity based on asset criticality
  const severityMap = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  }

  const { data, error } = await supabase
    .from('asset_matches')
    .insert({
      asset_id: asset.id,
      user_id: asset.user_id,
      match_type: matchType,
      source_table: sourceTable,
      source_id: sourceId,
      matched_value: matchedValue,
      context: context,
      severity: severityMap[asset.criticality] || 'medium',
      status: 'new',
    })
    .select()
    .single()

  if (error) {
    if (!error.message.includes('duplicate')) {
      console.error(`Error creating match:`, error.message)
    }
    return null
  }

  // Update asset match count and last_match_at using RPC
  await supabase.rpc('increment_asset_match_count', { p_asset_id: asset.id })

  return data
}

// Queue alert for new match
async function queueAssetAlert(asset, match) {
  if (!asset.notify_on_match) {
    return
  }

  const eventData = {
    user_id: asset.user_id,
    asset_id: asset.id,
    asset_value: asset.value,
    asset_type: asset.asset_type,
    asset_name: asset.name,
    asset_criticality: asset.criticality,
    match_id: match.id,
    match_type: match.match_type,
    matched_value: match.matched_value,
    severity: match.severity,
    context: match.context,
  }

  // Priority based on criticality
  const priorityMap = { critical: 1, high: 2, medium: 5, low: 8 }
  const priority = priorityMap[asset.criticality] || 5

  const { error } = await supabase.rpc('queue_alert_event', {
    p_event_type: 'ioc.matched_asset',
    p_event_id: `${match.id}`,
    p_event_data: eventData,
    p_priority: priority,
  })

  if (error && !error.message.includes('duplicate')) {
    console.error('Error queueing alert:', error.message)
  }
}

// Main monitoring function
async function runAssetMonitoring() {
  console.log('=== Asset Monitoring ===')
  console.log(`Started at: ${new Date().toISOString()}\n`)

  const assets = await getMonitoredAssets()
  console.log(`Found ${assets.length} monitored assets`)

  if (assets.length === 0) {
    console.log('No assets to monitor.')
    return { processed: 0, matches: 0 }
  }

  let processed = 0
  let newMatches = 0
  let errors = 0

  for (const asset of assets) {
    processed++
    let matches = []

    try {
      // Check based on asset type
      switch (asset.asset_type) {
        case 'domain':
        case 'email_domain':
          matches = await checkDomainAsset(asset)
          break
        case 'ip':
          matches = await checkIPAsset(asset)
          break
        case 'keyword':
        case 'executive':
          const incidents = await checkKeywordAsset(asset)
          matches = incidents.map((inc) => ({
            id: inc.id,
            value: inc.victim_name,
            type: 'incident_mention',
            source: 'incidents',
            context: { sector: inc.sector, discovered_at: inc.discovered_at },
          }))
          break
        case 'ip_range':
          // Skip CIDR ranges for now - would need more complex matching
          break
      }

      // Process IOC matches
      for (const ioc of matches) {
        const sourceTable = ioc.source === 'incidents' ? 'incidents' : 'iocs'
        const matchType = ioc.type === 'incident_mention' ? 'mention' : 'ioc'

        // Check if match already exists
        const exists = await matchExists(asset.id, sourceTable, ioc.id)
        if (exists) continue

        // Create new match
        const context = ioc.context || {
          ioc_type: ioc.ioc_type,
          threat_type: ioc.threat_type,
          confidence: ioc.confidence,
          source: ioc.source,
        }

        const match = await createMatch(
          asset,
          matchType,
          sourceTable,
          ioc.id,
          ioc.value,
          context
        )

        if (match) {
          newMatches++
          console.log(`  [NEW] ${asset.asset_type}:${asset.value} matched ${ioc.value}`)

          // Queue alert
          await queueAssetAlert(asset, match)
        }
      }

      // Update last_checked_at
      await supabase
        .from('assets')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', asset.id)

    } catch (err) {
      errors++
      console.error(`Error processing asset ${asset.value}:`, err.message)
    }

    // Progress indicator
    if (processed % 50 === 0) {
      console.log(`  Processed ${processed}/${assets.length} assets...`)
    }
  }

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'asset-monitoring',
    status: errors === 0 ? 'success' : 'partial',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: newMatches,
    metadata: {
      total_assets: assets.length,
      new_matches: newMatches,
      errors: errors,
    },
  })

  console.log('\n=== Summary ===')
  console.log(`Assets Processed: ${processed}`)
  console.log(`New Matches Found: ${newMatches}`)
  console.log(`Errors: ${errors}`)
  console.log(`Completed at: ${new Date().toISOString()}`)

  return { processed, matches: newMatches, errors }
}

// Run monitoring
runAssetMonitoring().catch(console.error)
