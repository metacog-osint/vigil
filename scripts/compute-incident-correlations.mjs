#!/usr/bin/env node
/**
 * Compute Incident Correlations
 *
 * Analyzes incidents and computes correlation scores between them based on:
 * - Same actor (highest weight)
 * - Same sector
 * - Same campaign (if detected)
 * - TTP overlap
 * - Shared IOCs
 *
 * Results are stored in the incident_correlations table.
 *
 * Usage:
 *   npm run compute:incident-correlations
 *   node scripts/compute-incident-correlations.mjs
 *   node scripts/compute-incident-correlations.mjs --days=30 --min-score=25
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse command line args
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith('--days='))
const minScoreArg = args.find(a => a.startsWith('--min-score='))
const ANALYSIS_DAYS = daysArg ? parseInt(daysArg.split('=')[1]) : 90
const MIN_CORRELATION_SCORE = minScoreArg ? parseInt(minScoreArg.split('=')[1]) : 25

// Correlation weights
const WEIGHTS = {
  SAME_ACTOR: 40,
  SAME_SECTOR: 15,
  SAME_CAMPAIGN: 25,
  TTP_OVERLAP_BASE: 5,      // Per shared TTP
  TTP_OVERLAP_MAX: 20,      // Max from TTPs
  IOC_SHARED_BASE: 10,      // Per shared IOC
  IOC_SHARED_MAX: 15,       // Max from IOCs
  TEMPORAL_PROXIMITY: 5,    // Within same week
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate TTP overlap score
 */
function calculateTTPOverlap(ttps1, ttps2) {
  if (!ttps1?.length || !ttps2?.length) return { score: 0, shared: [] }

  const set1 = new Set(ttps1)
  const shared = ttps2.filter(ttp => set1.has(ttp))

  if (shared.length === 0) return { score: 0, shared: [] }

  const score = Math.min(shared.length * WEIGHTS.TTP_OVERLAP_BASE, WEIGHTS.TTP_OVERLAP_MAX)
  return { score, shared }
}

/**
 * Check if two incidents share IOCs
 */
function checkSharedIOCs(iocs1, iocs2) {
  if (!iocs1?.length || !iocs2?.length) return { score: 0, shared: [] }

  const values1 = new Set(iocs1.map(i => i.value))
  const shared = iocs2.filter(i => values1.has(i.value))

  if (shared.length === 0) return { score: 0, shared: [] }

  const score = Math.min(shared.length * WEIGHTS.IOC_SHARED_BASE, WEIGHTS.IOC_SHARED_MAX)
  return { score, shared: shared.map(i => i.value) }
}

/**
 * Check temporal proximity (same week)
 */
function checkTemporalProximity(date1, date2) {
  if (!date1 || !date2) return false

  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffDays = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24))

  return diffDays <= 7
}

/**
 * Compute correlation between two incidents
 */
function computeCorrelation(incidentA, incidentB, iocMap) {
  let score = 0
  const factors = []

  // Same actor (strongest signal)
  if (incidentA.threat_actor_id && incidentA.threat_actor_id === incidentB.threat_actor_id) {
    score += WEIGHTS.SAME_ACTOR
    factors.push({
      type: 'same_actor',
      weight: WEIGHTS.SAME_ACTOR,
      detail: incidentA.threat_actor?.name || incidentA.threat_actor_id
    })
  }

  // Same sector
  if (incidentA.sector && incidentA.sector === incidentB.sector) {
    score += WEIGHTS.SAME_SECTOR
    factors.push({
      type: 'same_sector',
      weight: WEIGHTS.SAME_SECTOR,
      detail: incidentA.sector
    })
  }

  // TTP overlap
  const ttpResult = calculateTTPOverlap(incidentA.ttps, incidentB.ttps)
  if (ttpResult.score > 0) {
    score += ttpResult.score
    factors.push({
      type: 'ttp_overlap',
      weight: ttpResult.score,
      detail: ttpResult.shared.slice(0, 5).join(', '),
      count: ttpResult.shared.length
    })
  }

  // Shared IOCs
  const iocsA = iocMap.get(incidentA.id) || []
  const iocsB = iocMap.get(incidentB.id) || []
  const iocResult = checkSharedIOCs(iocsA, iocsB)
  if (iocResult.score > 0) {
    score += iocResult.score
    factors.push({
      type: 'ioc_shared',
      weight: iocResult.score,
      detail: iocResult.shared.slice(0, 3).join(', '),
      count: iocResult.shared.length
    })
  }

  // Temporal proximity bonus
  if (checkTemporalProximity(incidentA.discovered_at, incidentB.discovered_at)) {
    score += WEIGHTS.TEMPORAL_PROXIMITY
    factors.push({
      type: 'temporal_proximity',
      weight: WEIGHTS.TEMPORAL_PROXIMITY,
      detail: 'Within same week'
    })
  }

  // Determine primary correlation type
  let correlationType = 'unknown'
  if (factors.length > 0) {
    const primaryFactor = factors.reduce((a, b) => a.weight > b.weight ? a : b)
    correlationType = primaryFactor.type
  }

  return {
    score: Math.min(100, score),  // Cap at 100
    correlationType,
    factors
  }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function computeIncidentCorrelations() {
  console.log('=== Computing Incident Correlations ===\n')
  console.log(`Analysis period: ${ANALYSIS_DAYS} days`)
  console.log(`Minimum correlation score: ${MIN_CORRELATION_SCORE}`)

  // Step 1: Load incidents
  console.log('\nStep 1: Loading incidents...')
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - ANALYSIS_DAYS)

  const { data: incidents, error: incError } = await supabase
    .from('incidents')
    .select(`
      id,
      victim_name,
      sector,
      threat_actor_id,
      threat_actor:threat_actors(id, name),
      ttps,
      discovered_at,
      created_at
    `)
    .gte('discovered_at', startDate.toISOString())
    .order('discovered_at', { ascending: false })
    .limit(1000)  // Limit to prevent memory issues

  if (incError) {
    console.error('Error fetching incidents:', incError.message)
    return
  }

  console.log(`  Loaded ${incidents?.length || 0} incidents`)

  if (!incidents || incidents.length < 2) {
    console.log('  Not enough incidents for correlation analysis')
    return
  }

  // Step 2: Load IOCs for incidents
  console.log('\nStep 2: Loading IOCs for incidents...')
  const incidentIds = incidents.map(i => i.id)

  const { data: iocs, error: iocError } = await supabase
    .from('iocs')
    .select('id, value, type, incident_id')
    .in('incident_id', incidentIds)

  if (iocError && !iocError.message?.includes('does not exist')) {
    console.log(`  Warning: ${iocError.message}`)
  }

  // Group IOCs by incident
  const iocMap = new Map()
  for (const ioc of (iocs || [])) {
    if (!iocMap.has(ioc.incident_id)) {
      iocMap.set(ioc.incident_id, [])
    }
    iocMap.get(ioc.incident_id).push(ioc)
  }
  console.log(`  Loaded ${iocs?.length || 0} IOCs across ${iocMap.size} incidents`)

  // Step 3: Compute correlations
  console.log('\nStep 3: Computing correlations...')
  const correlationsToInsert = []
  let pairsChecked = 0
  let correlationsFound = 0

  // Compare each pair of incidents (O(n^2) but limited by sample size)
  for (let i = 0; i < incidents.length; i++) {
    for (let j = i + 1; j < incidents.length; j++) {
      pairsChecked++

      const incidentA = incidents[i]
      const incidentB = incidents[j]

      const result = computeCorrelation(incidentA, incidentB, iocMap)

      if (result.score >= MIN_CORRELATION_SCORE) {
        correlationsFound++
        correlationsToInsert.push({
          incident_a_id: incidentA.id,
          incident_b_id: incidentB.id,
          correlation_type: result.correlationType,
          correlation_score: result.score,
          factors: result.factors
        })
      }
    }

    // Progress update every 100 incidents
    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${incidents.length} incidents...`)
    }
  }

  console.log(`  Checked ${pairsChecked} pairs, found ${correlationsFound} correlations`)

  if (correlationsToInsert.length === 0) {
    console.log('\n  No significant correlations found')
    return
  }

  // Step 4: Clear existing correlations for these incidents
  console.log('\nStep 4: Clearing existing correlations...')
  const { error: deleteError } = await supabase
    .from('incident_correlations')
    .delete()
    .or(`incident_a_id.in.(${incidentIds.join(',')}),incident_b_id.in.(${incidentIds.join(',')})`)

  if (deleteError && !deleteError.message?.includes('does not exist')) {
    console.log(`  Warning: ${deleteError.message}`)
  }

  // Step 5: Insert new correlations
  console.log('\nStep 5: Inserting correlations...')
  const batchSize = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < correlationsToInsert.length; i += batchSize) {
    const batch = correlationsToInsert.slice(i, i + batchSize)
    const { error } = await supabase
      .from('incident_correlations')
      .insert(batch)

    if (error) {
      console.log(`  Batch error: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
    }
  }

  console.log(`  Inserted: ${inserted}, Errors: ${errors}`)

  // Step 6: Summary
  console.log('\n=== Summary ===')

  const { count: totalCorrelations } = await supabase
    .from('incident_correlations')
    .select('*', { count: 'exact', head: true })

  console.log(`Total correlations in database: ${totalCorrelations}`)

  // Show distribution by type
  const { data: byType } = await supabase
    .from('incident_correlations')
    .select('correlation_type')

  const typeCounts = {}
  for (const c of (byType || [])) {
    typeCounts[c.correlation_type] = (typeCounts[c.correlation_type] || 0) + 1
  }

  console.log('\nBy correlation type:')
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  ${type}: ${count}`)
  }

  // Show score distribution
  const { data: scoreDistribution } = await supabase
    .from('incident_correlations')
    .select('correlation_score')

  const scoreBuckets = { high: 0, medium: 0, low: 0 }
  for (const c of (scoreDistribution || [])) {
    if (c.correlation_score >= 70) scoreBuckets.high++
    else if (c.correlation_score >= 40) scoreBuckets.medium++
    else scoreBuckets.low++
  }

  console.log('\nBy score:')
  console.log(`  High (70+): ${scoreBuckets.high}`)
  console.log(`  Medium (40-69): ${scoreBuckets.medium}`)
  console.log(`  Low (25-39): ${scoreBuckets.low}`)

  // Show top correlations
  const { data: topCorrelations } = await supabase
    .from('incident_correlations')
    .select(`
      correlation_score,
      correlation_type,
      factors,
      incident_a:incidents!incident_correlations_incident_a_id_fkey(victim_name),
      incident_b:incidents!incident_correlations_incident_b_id_fkey(victim_name)
    `)
    .order('correlation_score', { ascending: false })
    .limit(5)

  console.log('\nTop 5 correlations:')
  for (const c of (topCorrelations || [])) {
    const victimA = c.incident_a?.victim_name || 'Unknown'
    const victimB = c.incident_b?.victim_name || 'Unknown'
    console.log(`  [${c.correlation_score}] ${victimA} ↔ ${victimB} (${c.correlation_type})`)
  }
}

computeIncidentCorrelations().catch(console.error)
