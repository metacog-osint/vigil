#!/usr/bin/env node
/**
 * Detect Temporal Patterns
 *
 * Automated detection of temporal patterns in threat actor activity:
 * - Reactivated actors (dormant >90 days, now active)
 * - Activity spikes/anomalies
 * - Seasonal patterns
 *
 * Designed to run daily via GitHub Actions.
 *
 * Usage:
 *   npm run detect:temporal-patterns
 *   node scripts/detect-temporal-patterns.mjs
 *   node scripts/detect-temporal-patterns.mjs --dormancy-days=90
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse command line args
const args = process.argv.slice(2)
const dormancyArg = args.find(a => a.startsWith('--dormancy-days='))
const DORMANCY_THRESHOLD_DAYS = dormancyArg ? parseInt(dormancyArg.split('=')[1]) : 90
const REACTIVATION_WINDOW_DAYS = 7  // Consider active if activity in last 7 days

const PATTERN_TYPES = {
  REACTIVATED_ACTOR: 'reactivated_actor',
  ACTIVITY_SPIKE: 'activity_spike',
  DORMANT_ACTOR: 'dormant_actor',
  SEASONAL: 'seasonal',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.floor(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24))
}

function generatePatternKey(type, identifier, date) {
  return `${type}:${identifier}:${date}`
}

// ============================================
// PATTERN DETECTION FUNCTIONS
// ============================================

/**
 * Detect actors that were dormant but became active recently
 */
async function detectReactivatedActors() {
  console.log('  Checking for reactivated actors...')

  const now = new Date()
  const reactivationCutoff = new Date(now.getTime() - REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const dormancyCutoff = new Date(now.getTime() - DORMANCY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  // Get actors with recent activity
  const { data: recentActors, error: recentError } = await supabase
    .from('incidents')
    .select('threat_actor_id, threat_actor:threat_actors(id, name, last_seen)')
    .gte('discovered_at', reactivationCutoff.toISOString())
    .not('threat_actor_id', 'is', null)

  if (recentError) {
    console.log(`    Error fetching recent actors: ${recentError.message}`)
    return []
  }

  // Get unique actors with recent activity
  const recentActorIds = [...new Set((recentActors || []).map(i => i.threat_actor_id))]

  if (recentActorIds.length === 0) {
    console.log('    No actors with recent activity')
    return []
  }

  // Check their previous activity
  const patterns = []

  for (const actorId of recentActorIds) {
    // Get actor's incident history before the dormancy period
    const { data: history, error: histError } = await supabase
      .from('incidents')
      .select('discovered_at')
      .eq('threat_actor_id', actorId)
      .lt('discovered_at', dormancyCutoff.toISOString())
      .order('discovered_at', { ascending: false })
      .limit(1)

    if (histError) continue

    // If they had activity before dormancy cutoff, they might be reactivated
    if (history && history.length > 0) {
      const lastActivityBefore = new Date(history[0].discovered_at)

      // Check if there's a gap > dormancy threshold
      const { data: gapCheck, error: gapError } = await supabase
        .from('incidents')
        .select('discovered_at')
        .eq('threat_actor_id', actorId)
        .gt('discovered_at', lastActivityBefore.toISOString())
        .lt('discovered_at', reactivationCutoff.toISOString())
        .limit(1)

      if (!gapError && (!gapCheck || gapCheck.length === 0)) {
        // Gap exists - this is a reactivated actor
        const actorInfo = recentActors.find(a => a.threat_actor_id === actorId)?.threat_actor
        const dormantDays = daysBetween(lastActivityBefore, reactivationCutoff)

        if (dormantDays >= DORMANCY_THRESHOLD_DAYS) {
          patterns.push({
            type: PATTERN_TYPES.REACTIVATED_ACTOR,
            actorId,
            actorName: actorInfo?.name || actorId,
            dormantDays,
            lastSeenBefore: lastActivityBefore.toISOString(),
            reactivatedOn: reactivationCutoff.toISOString(),
            confidence: Math.min(1, dormantDays / 180),  // Higher confidence for longer dormancy
            description: `${actorInfo?.name || 'Unknown actor'} reactivated after ${dormantDays} days of dormancy`,
          })
        }
      }
    }
  }

  console.log(`    Found ${patterns.length} reactivated actors`)
  return patterns
}

/**
 * Detect actors that have been dormant for extended periods
 */
async function detectDormantActors() {
  console.log('  Checking for dormant actors...')

  const now = new Date()
  const dormancyCutoff = new Date(now.getTime() - DORMANCY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  // Get actors that were active before dormancy cutoff but not after
  const { data: previouslyActive, error: prevError } = await supabase
    .from('incidents')
    .select('threat_actor_id, threat_actor:threat_actors(id, name, trend_status)')
    .lt('discovered_at', dormancyCutoff.toISOString())
    .not('threat_actor_id', 'is', null)
    .limit(500)

  if (prevError) {
    console.log(`    Error fetching previously active actors: ${prevError.message}`)
    return []
  }

  const previouslyActiveIds = [...new Set((previouslyActive || []).map(i => i.threat_actor_id))]

  // Get actors with recent activity
  const { data: recentActive, error: recentError } = await supabase
    .from('incidents')
    .select('threat_actor_id')
    .gte('discovered_at', dormancyCutoff.toISOString())
    .not('threat_actor_id', 'is', null)

  if (recentError) {
    console.log(`    Error fetching recent actors: ${recentError.message}`)
    return []
  }

  const recentActiveIds = new Set((recentActive || []).map(i => i.threat_actor_id))

  // Find dormant actors (were active, not recently active)
  const dormantIds = previouslyActiveIds.filter(id => !recentActiveIds.has(id))
  const patterns = []

  for (const actorId of dormantIds.slice(0, 50)) {  // Limit to 50
    // Get last activity date
    const { data: lastActivity } = await supabase
      .from('incidents')
      .select('discovered_at, threat_actor:threat_actors(name)')
      .eq('threat_actor_id', actorId)
      .order('discovered_at', { ascending: false })
      .limit(1)

    if (lastActivity && lastActivity.length > 0) {
      const lastSeen = new Date(lastActivity[0].discovered_at)
      const dormantDays = daysBetween(lastSeen, now)

      patterns.push({
        type: PATTERN_TYPES.DORMANT_ACTOR,
        actorId,
        actorName: lastActivity[0].threat_actor?.name || actorId,
        dormantDays,
        lastSeen: lastSeen.toISOString(),
        confidence: Math.min(1, dormantDays / 180),
        description: `${lastActivity[0].threat_actor?.name || 'Unknown actor'} has been dormant for ${dormantDays} days`,
      })
    }
  }

  console.log(`    Found ${patterns.length} dormant actors`)
  return patterns
}

/**
 * Detect activity spikes compared to baseline
 */
async function detectActivitySpikes() {
  console.log('  Checking for activity spikes...')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Get last week's daily counts
  const { data: recentCounts, error: recentError } = await supabase
    .from('incidents')
    .select('discovered_at')
    .gte('discovered_at', weekAgo.toISOString())

  if (recentError) {
    console.log(`    Error fetching recent incidents: ${recentError.message}`)
    return []
  }

  // Get baseline (previous 3 weeks)
  const { data: baselineCounts, error: baselineError } = await supabase
    .from('incidents')
    .select('discovered_at')
    .gte('discovered_at', monthAgo.toISOString())
    .lt('discovered_at', weekAgo.toISOString())

  if (baselineError) {
    console.log(`    Error fetching baseline: ${baselineError.message}`)
    return []
  }

  // Calculate averages
  const recentPerDay = (recentCounts?.length || 0) / 7
  const baselinePerDay = (baselineCounts?.length || 0) / 21

  const patterns = []

  if (baselinePerDay > 0) {
    const ratio = recentPerDay / baselinePerDay

    if (ratio >= 1.5) {
      patterns.push({
        type: PATTERN_TYPES.ACTIVITY_SPIKE,
        recentAvg: Math.round(recentPerDay * 10) / 10,
        baselineAvg: Math.round(baselinePerDay * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        direction: 'increase',
        confidence: Math.min(1, (ratio - 1) / 2),
        description: `Activity increased ${Math.round((ratio - 1) * 100)}% compared to baseline`,
      })
    } else if (ratio <= 0.5) {
      patterns.push({
        type: PATTERN_TYPES.ACTIVITY_SPIKE,
        recentAvg: Math.round(recentPerDay * 10) / 10,
        baselineAvg: Math.round(baselinePerDay * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        direction: 'decrease',
        confidence: Math.min(1, (1 - ratio) / 2),
        description: `Activity decreased ${Math.round((1 - ratio) * 100)}% compared to baseline`,
      })
    }
  }

  console.log(`    Found ${patterns.length} activity anomalies`)
  return patterns
}

// ============================================
// PERSISTENCE
// ============================================

async function persistPatterns(patterns) {
  if (patterns.length === 0) return { inserted: 0, updated: 0 }

  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // Get existing patterns for today
  const { data: existing } = await supabase
    .from('detected_patterns')
    .select('id, pattern_key, detection_count')
    .gte('last_detected', `${today}T00:00:00Z`)

  const existingKeys = new Map()
  for (const p of (existing || [])) {
    existingKeys.set(p.pattern_key, { id: p.id, count: p.detection_count })
  }

  const toInsert = []
  const toUpdate = []

  for (const pattern of patterns) {
    const key = generatePatternKey(
      pattern.type,
      pattern.actorId || pattern.direction || 'global',
      today
    )

    const existingRecord = existingKeys.get(key)

    if (existingRecord) {
      toUpdate.push({
        id: existingRecord.id,
        data: pattern,
        confidence: pattern.confidence,
        last_detected: now,
        detection_count: existingRecord.count + 1,
      })
    } else {
      toInsert.push({
        pattern_type: pattern.type,
        pattern_key: key,
        data: pattern,
        confidence: pattern.confidence,
        first_detected: now,
        last_detected: now,
        detection_count: 1,
        status: 'active',
      })
    }
  }

  let inserted = 0
  let updated = 0

  // Insert new patterns
  if (toInsert.length > 0) {
    const { error } = await supabase.from('detected_patterns').insert(toInsert)
    if (!error) inserted = toInsert.length
  }

  // Update existing patterns
  for (const up of toUpdate) {
    const { error } = await supabase
      .from('detected_patterns')
      .update({
        data: up.data,
        confidence: up.confidence,
        last_detected: up.last_detected,
        detection_count: up.detection_count,
      })
      .eq('id', up.id)

    if (!error) updated++
  }

  return { inserted, updated }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function detectTemporalPatterns() {
  console.log('=== Temporal Pattern Detection ===\n')
  console.log(`Dormancy threshold: ${DORMANCY_THRESHOLD_DAYS} days`)
  console.log(`Reactivation window: ${REACTIVATION_WINDOW_DAYS} days`)

  console.log('\nStep 1: Detecting patterns...')

  const allPatterns = []

  // Detect reactivated actors
  const reactivated = await detectReactivatedActors()
  allPatterns.push(...reactivated)

  // Detect dormant actors
  const dormant = await detectDormantActors()
  allPatterns.push(...dormant)

  // Detect activity spikes
  const spikes = await detectActivitySpikes()
  allPatterns.push(...spikes)

  console.log(`\n  Total patterns detected: ${allPatterns.length}`)

  if (allPatterns.length === 0) {
    console.log('\nNo temporal patterns detected')
    return
  }

  console.log('\nStep 2: Persisting patterns...')
  const { inserted, updated } = await persistPatterns(allPatterns)
  console.log(`  Inserted: ${inserted}, Updated: ${updated}`)

  // Summary
  console.log('\n=== Summary ===')

  const byType = {}
  for (const p of allPatterns) {
    byType[p.type] = (byType[p.type] || 0) + 1
  }

  console.log('\nBy pattern type:')
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`)
  }

  // Show notable patterns
  const reactivatedActors = allPatterns.filter(p => p.type === PATTERN_TYPES.REACTIVATED_ACTOR)
  if (reactivatedActors.length > 0) {
    console.log('\nReactivated Actors (potential threat):')
    for (const p of reactivatedActors.slice(0, 5)) {
      console.log(`  - ${p.actorName}: dormant for ${p.dormantDays} days`)
    }
  }

  const spikePatterns = allPatterns.filter(p => p.type === PATTERN_TYPES.ACTIVITY_SPIKE)
  if (spikePatterns.length > 0) {
    console.log('\nActivity Anomalies:')
    for (const p of spikePatterns) {
      console.log(`  - ${p.direction}: ${p.recentAvg}/day vs baseline ${p.baselineAvg}/day (${p.ratio}x)`)
    }
  }
}

detectTemporalPatterns().catch(console.error)
