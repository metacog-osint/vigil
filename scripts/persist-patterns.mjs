#!/usr/bin/env node
/**
 * Persist detected patterns to database
 *
 * Runs pattern detection analysis and saves results to the detected_patterns table.
 * Tracks recurring patterns by incrementing detection_count and updating last_detected.
 *
 * Usage:
 *   npm run persist:patterns
 *   node scripts/persist-patterns.mjs
 *   node scripts/persist-patterns.mjs --days=30
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse command line args
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith('--days='))
const ANALYSIS_DAYS = daysArg ? parseInt(daysArg.split('=')[1]) : 90

// Pattern type constants (matching lib/patternDetection.js)
const PATTERN_TYPES = {
  ACTOR_SECTOR: 'actor_sector',
  ACTOR_TECHNIQUE: 'actor_technique',
  SECTOR_TECHNIQUE: 'sector_technique',
  TEMPORAL_CLUSTER: 'temporal_cluster',
  GEOGRAPHIC: 'geographic',
  CAMPAIGN: 'campaign',
  ANOMALY: 'anomaly',
}

// Minimum occurrences for a pattern to be significant
const MIN_PATTERN_OCCURRENCES = 3

// Time windows for pattern analysis
const TIME_WINDOWS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
}

// Anomaly thresholds
const ANOMALY_THRESHOLD = 2

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateStdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

function calculateMean(values) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item)
    if (key) {
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return groups
  }, {})
}

function countCoOccurrences(items, keyFn1, keyFn2) {
  const counts = {}
  items.forEach((item) => {
    const key1 = keyFn1(item)
    const key2 = keyFn2(item)
    if (key1 && key2) {
      const pairKey = `${key1}|${key2}`
      counts[pairKey] = (counts[pairKey] || 0) + 1
    }
  })
  return counts
}

/**
 * Generate a stable key for pattern deduplication
 */
function generatePatternKey(pattern) {
  switch (pattern.type) {
    case PATTERN_TYPES.ACTOR_SECTOR:
      return `${pattern.type}:${pattern.actorId}:${pattern.sector}`
    case PATTERN_TYPES.ACTOR_TECHNIQUE:
      return `${pattern.type}:${pattern.actorId}:${pattern.technique}`
    case PATTERN_TYPES.GEOGRAPHIC:
      return `${pattern.type}:${pattern.country}`
    case PATTERN_TYPES.CAMPAIGN:
      return `${pattern.type}:${pattern.actorId}:${pattern.startTime?.split('T')[0]}`
    case PATTERN_TYPES.TEMPORAL_CLUSTER:
      return `${pattern.type}:${pattern.startTime?.split('T')[0]}`
    case PATTERN_TYPES.ANOMALY:
      return `${pattern.type}:${pattern.date}:${pattern.direction}`
    default:
      return `${pattern.type}:${JSON.stringify(pattern).slice(0, 50)}`
  }
}

// ============================================
// PATTERN DETECTION FUNCTIONS
// ============================================

function detectActorSectorPatterns(incidents) {
  const counts = countCoOccurrences(
    incidents,
    (i) => i.threat_actor_id || i.threat_actor?.id,
    (i) => i.sector
  )

  return Object.entries(counts)
    .filter(([, count]) => count >= MIN_PATTERN_OCCURRENCES)
    .map(([key, count]) => {
      const [actorId, sector] = key.split('|')
      const actor = incidents.find(
        (i) => (i.threat_actor_id || i.threat_actor?.id) === actorId
      )?.threat_actor

      return {
        type: PATTERN_TYPES.ACTOR_SECTOR,
        actorId,
        actorName: actor?.name || actorId,
        sector,
        occurrences: count,
        confidence: Math.min(1, count / 10),
        description: `${actor?.name || 'Unknown actor'} frequently targets ${sector} sector`,
      }
    })
    .sort((a, b) => b.occurrences - a.occurrences)
}

function detectGeographicPatterns(incidents) {
  const patterns = []
  const countryCounts = {}

  incidents.forEach((inc) => {
    const countries = inc.target_countries || []
    countries.forEach((country) => {
      countryCounts[country] = (countryCounts[country] || 0) + 1
    })
  })

  Object.entries(countryCounts)
    .filter(([, count]) => count >= MIN_PATTERN_OCCURRENCES)
    .forEach(([country, count]) => {
      const actors = [
        ...new Set(
          incidents
            .filter((i) => i.target_countries?.includes(country))
            .map((i) => i.threat_actor?.name)
            .filter(Boolean)
        ),
      ]

      patterns.push({
        type: PATTERN_TYPES.GEOGRAPHIC,
        country,
        occurrences: count,
        actors,
        confidence: Math.min(1, count / 15),
        description: `${country} targeted ${count} times by ${actors.length} actors`,
      })
    })

  return patterns.sort((a, b) => b.occurrences - a.occurrences)
}

function detectCampaigns(incidents) {
  const campaigns = []
  const actorIncidents = groupBy(incidents, (i) => i.threat_actor_id || i.threat_actor?.id)

  Object.entries(actorIncidents).forEach(([actorId, actorIncs]) => {
    if (actorIncs.length < MIN_PATTERN_OCCURRENCES) return

    const sorted = [...actorIncs].sort(
      (a, b) => new Date(a.discovered_at || a.created_at) - new Date(b.discovered_at || b.created_at)
    )

    let campaignStart = sorted[0]
    let campaignIncidents = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].discovered_at || sorted[i - 1].created_at)
      const curr = new Date(sorted[i].discovered_at || sorted[i].created_at)

      if (curr - prev < TIME_WINDOWS.WEEK) {
        campaignIncidents.push(sorted[i])
      } else {
        if (campaignIncidents.length >= MIN_PATTERN_OCCURRENCES) {
          const actor = actorIncs[0]?.threat_actor
          const sectors = [...new Set(campaignIncidents.map((i) => i.sector).filter(Boolean))]
          const ttps = [...new Set(campaignIncidents.flatMap((i) => i.ttps || []).filter(Boolean))]

          campaigns.push({
            type: PATTERN_TYPES.CAMPAIGN,
            actorId,
            actorName: actor?.name || actorId,
            startTime: new Date(campaignStart.discovered_at || campaignStart.created_at).toISOString(),
            endTime: new Date(
              campaignIncidents[campaignIncidents.length - 1].discovered_at ||
              campaignIncidents[campaignIncidents.length - 1].created_at
            ).toISOString(),
            incidentCount: campaignIncidents.length,
            sectors,
            techniques: ttps.slice(0, 5),
            confidence: Math.min(1, campaignIncidents.length / 10),
            description: `Potential ${actor?.name || 'Unknown'} campaign: ${campaignIncidents.length} incidents targeting ${sectors.join(', ')}`,
          })
        }

        campaignStart = sorted[i]
        campaignIncidents = [sorted[i]]
      }
    }

    // Check final campaign
    if (campaignIncidents.length >= MIN_PATTERN_OCCURRENCES) {
      const actor = actorIncs[0]?.threat_actor
      const sectors = [...new Set(campaignIncidents.map((i) => i.sector).filter(Boolean))]

      campaigns.push({
        type: PATTERN_TYPES.CAMPAIGN,
        actorId,
        actorName: actor?.name || actorId,
        startTime: new Date(campaignStart.discovered_at || campaignStart.created_at).toISOString(),
        endTime: new Date(
          campaignIncidents[campaignIncidents.length - 1].discovered_at ||
          campaignIncidents[campaignIncidents.length - 1].created_at
        ).toISOString(),
        incidentCount: campaignIncidents.length,
        sectors,
        confidence: Math.min(1, campaignIncidents.length / 10),
        description: `Potential ${actor?.name || 'Unknown'} campaign: ${campaignIncidents.length} incidents`,
      })
    }
  })

  return campaigns.sort((a, b) => b.incidentCount - a.incidentCount)
}

function detectTemporalClusters(incidents, windowMs = TIME_WINDOWS.DAY) {
  const patterns = []

  const sorted = [...incidents].sort(
    (a, b) => new Date(a.discovered_at || a.created_at) - new Date(b.discovered_at || b.created_at)
  )

  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].discovered_at || sorted[i].created_at)
    const windowEnd = new Date(windowStart.getTime() + windowMs)

    const windowIncidents = sorted.filter((inc) => {
      const ts = new Date(inc.discovered_at || inc.created_at)
      return ts >= windowStart && ts <= windowEnd
    })

    if (windowIncidents.length >= MIN_PATTERN_OCCURRENCES * 2) {
      const existingCluster = patterns.find(
        (p) => Math.abs(new Date(p.startTime) - windowStart) < windowMs / 2
      )

      if (!existingCluster) {
        const actors = [...new Set(windowIncidents.map((i) => i.threat_actor?.name).filter(Boolean))]
        const sectors = [...new Set(windowIncidents.map((i) => i.sector).filter(Boolean))]

        patterns.push({
          type: PATTERN_TYPES.TEMPORAL_CLUSTER,
          startTime: windowStart.toISOString(),
          endTime: windowEnd.toISOString(),
          incidentCount: windowIncidents.length,
          actors,
          sectors,
          confidence: Math.min(1, windowIncidents.length / 20),
          description: `Activity spike: ${windowIncidents.length} incidents in ${Math.round(windowMs / TIME_WINDOWS.HOUR)}h`,
        })
      }
    }
  }

  return patterns.sort((a, b) => b.incidentCount - a.incidentCount)
}

function detectAnomalies(incidents, baselineDays = 30) {
  const anomalies = []
  const now = new Date()
  const baselineStart = new Date(now.getTime() - baselineDays * TIME_WINDOWS.DAY)

  const dailyCounts = {}
  const baselineIncidents = incidents.filter((i) => {
    const ts = new Date(i.discovered_at || i.created_at)
    return ts >= baselineStart
  })

  baselineIncidents.forEach((inc) => {
    const date = new Date(inc.discovered_at || inc.created_at).toISOString().split('T')[0]
    dailyCounts[date] = (dailyCounts[date] || 0) + 1
  })

  const dailyValues = Object.values(dailyCounts)
  const mean = calculateMean(dailyValues)
  const stdDev = calculateStdDev(dailyValues)

  Object.entries(dailyCounts).forEach(([date, count]) => {
    const zScore = stdDev > 0 ? (count - mean) / stdDev : 0

    if (Math.abs(zScore) > ANOMALY_THRESHOLD) {
      const dayIncidents = baselineIncidents.filter((i) => {
        const incDate = new Date(i.discovered_at || i.created_at).toISOString().split('T')[0]
        return incDate === date
      })

      const actors = [...new Set(dayIncidents.map((i) => i.threat_actor?.name).filter(Boolean))]
      const sectors = [...new Set(dayIncidents.map((i) => i.sector).filter(Boolean))]

      anomalies.push({
        type: PATTERN_TYPES.ANOMALY,
        date,
        actualCount: count,
        expectedCount: Math.round(mean),
        zScore: Math.round(zScore * 10) / 10,
        direction: zScore > 0 ? 'spike' : 'drop',
        actors: actors.slice(0, 5),
        sectors: sectors.slice(0, 5),
        confidence: Math.min(1, Math.abs(zScore) / 4),
        description:
          zScore > 0
            ? `Unusual spike: ${count} incidents (expected ~${Math.round(mean)})`
            : `Unusual drop: ${count} incidents (expected ~${Math.round(mean)})`,
      })
    }
  })

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
}

// ============================================
// MAIN PERSISTENCE FUNCTION
// ============================================

async function persistPatterns() {
  console.log('=== Pattern Detection & Persistence ===\n')
  console.log(`Analysis period: ${ANALYSIS_DAYS} days`)

  // Step 1: Fetch incidents
  console.log('\nStep 1: Loading incidents...')
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - ANALYSIS_DAYS)

  const { data: incidents, error: incError } = await supabase
    .from('incidents')
    .select(`
      *,
      threat_actor:threat_actors(id, name, aliases)
    `)
    .gte('discovered_at', startDate.toISOString())
    .order('discovered_at', { ascending: false })

  if (incError) {
    console.error('Error fetching incidents:', incError.message)
    return
  }

  console.log(`  Loaded ${incidents?.length || 0} incidents`)

  if (!incidents || incidents.length === 0) {
    console.log('  No incidents found in analysis period')
    return
  }

  // Step 2: Run pattern detection
  console.log('\nStep 2: Running pattern detection...')

  const patterns = []

  // Actor-Sector patterns
  const actorSectorPatterns = detectActorSectorPatterns(incidents)
  console.log(`  Actor-Sector patterns: ${actorSectorPatterns.length}`)
  patterns.push(...actorSectorPatterns)

  // Geographic patterns
  const geoPatterns = detectGeographicPatterns(incidents)
  console.log(`  Geographic patterns: ${geoPatterns.length}`)
  patterns.push(...geoPatterns)

  // Campaign patterns
  const campaignPatterns = detectCampaigns(incidents)
  console.log(`  Campaign patterns: ${campaignPatterns.length}`)
  patterns.push(...campaignPatterns)

  // Temporal cluster patterns
  const temporalPatterns = detectTemporalClusters(incidents)
  console.log(`  Temporal cluster patterns: ${temporalPatterns.length}`)
  patterns.push(...temporalPatterns)

  // Anomaly patterns
  const anomalyPatterns = detectAnomalies(incidents, Math.min(ANALYSIS_DAYS, 30))
  console.log(`  Anomaly patterns: ${anomalyPatterns.length}`)
  patterns.push(...anomalyPatterns)

  console.log(`\n  Total patterns detected: ${patterns.length}`)

  if (patterns.length === 0) {
    console.log('  No significant patterns found')
    return
  }

  // Step 3: Fetch existing patterns for comparison
  console.log('\nStep 3: Checking for existing patterns...')
  const { data: existingPatterns, error: existError } = await supabase
    .from('detected_patterns')
    .select('id, pattern_key, detection_count')

  if (existError && !existError.message?.includes('does not exist')) {
    console.log(`  Warning: ${existError.message}`)
  }

  const existingKeys = new Map()
  for (const ep of (existingPatterns || [])) {
    existingKeys.set(ep.pattern_key, { id: ep.id, count: ep.detection_count })
  }
  console.log(`  Found ${existingKeys.size} existing pattern records`)

  // Step 4: Prepare upsert data
  console.log('\nStep 4: Preparing pattern records...')
  const now = new Date().toISOString()

  const toInsert = []
  const toUpdate = []

  for (const pattern of patterns) {
    const key = generatePatternKey(pattern)
    const existing = existingKeys.get(key)

    if (existing) {
      // Update existing pattern
      toUpdate.push({
        id: existing.id,
        data: pattern,
        confidence: pattern.confidence,
        last_detected: now,
        detection_count: existing.count + 1,
      })
    } else {
      // Insert new pattern
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

  console.log(`  New patterns: ${toInsert.length}`)
  console.log(`  Updated patterns: ${toUpdate.length}`)

  // Step 5: Insert new patterns
  if (toInsert.length > 0) {
    console.log('\nStep 5a: Inserting new patterns...')
    const batchSize = 50
    let inserted = 0
    let errors = 0

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const { error } = await supabase
        .from('detected_patterns')
        .insert(batch)

      if (error) {
        console.log(`  Batch error: ${error.message}`)
        errors += batch.length
      } else {
        inserted += batch.length
      }
    }

    console.log(`  Inserted: ${inserted}, Errors: ${errors}`)
  }

  // Step 6: Update existing patterns
  if (toUpdate.length > 0) {
    console.log('\nStep 5b: Updating existing patterns...')
    let updated = 0
    let errors = 0

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

      if (error) {
        errors++
      } else {
        updated++
      }
    }

    console.log(`  Updated: ${updated}, Errors: ${errors}`)
  }

  // Step 7: Summary
  console.log('\n=== Summary ===')

  const { count: totalPatterns } = await supabase
    .from('detected_patterns')
    .select('*', { count: 'exact', head: true })

  const { data: byType } = await supabase
    .from('detected_patterns')
    .select('pattern_type')

  const typeCounts = {}
  for (const p of (byType || [])) {
    typeCounts[p.pattern_type] = (typeCounts[p.pattern_type] || 0) + 1
  }

  console.log(`Total patterns in database: ${totalPatterns}`)
  console.log('\nBy type:')
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  ${type}: ${count}`)
  }

  // Show most frequently detected patterns
  const { data: recurring } = await supabase
    .from('detected_patterns')
    .select('pattern_type, data, detection_count')
    .order('detection_count', { ascending: false })
    .limit(5)

  console.log('\nTop recurring patterns:')
  for (const p of (recurring || [])) {
    console.log(`  [${p.detection_count}x] ${p.pattern_type}: ${p.data?.description || 'No description'}`)
  }
}

persistPatterns().catch(console.error)
