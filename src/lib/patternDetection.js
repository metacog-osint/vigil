/**
 * Pattern Detection Module
 *
 * Analyzes incidents for recurring patterns, attack chains, and anomalies.
 * Provides intelligence on attack trends and emerging threats.
 */

import { supabase } from './supabase/client'

// ============================================
// CONSTANTS
// ============================================

// Minimum occurrences for a pattern to be significant
const MIN_PATTERN_OCCURRENCES = 3

// Time windows for pattern analysis
const TIME_WINDOWS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
}

// Anomaly thresholds (standard deviations)
const ANOMALY_THRESHOLD = 2

// Pattern types
export const PATTERN_TYPES = {
  ACTOR_SECTOR: 'actor_sector',
  ACTOR_TECHNIQUE: 'actor_technique',
  SECTOR_TECHNIQUE: 'sector_technique',
  TEMPORAL_CLUSTER: 'temporal_cluster',
  GEOGRAPHIC: 'geographic',
  CAMPAIGN: 'campaign',
  ANOMALY: 'anomaly',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Calculate mean
 */
function calculateMean(values) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Group items by key
 */
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

/**
 * Count co-occurrences of two attributes
 */
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

// ============================================
// PATTERN DETECTION FUNCTIONS
// ============================================

/**
 * Detect actor-sector targeting patterns
 */
export function detectActorSectorPatterns(incidents) {
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

/**
 * Detect actor-technique patterns
 */
export function detectActorTechniquePatterns(incidents) {
  const patterns = []

  // Group incidents by actor
  const actorIncidents = groupBy(incidents, (i) => i.threat_actor_id || i.threat_actor?.id)

  Object.entries(actorIncidents).forEach(([actorId, actorIncs]) => {
    // Count technique usage
    const techniqueCounts = {}
    actorIncs.forEach((inc) => {
      const ttps = inc.ttps || []
      ttps.forEach((ttp) => {
        techniqueCounts[ttp] = (techniqueCounts[ttp] || 0) + 1
      })
    })

    // Find significant techniques
    Object.entries(techniqueCounts)
      .filter(([, count]) => count >= MIN_PATTERN_OCCURRENCES)
      .forEach(([technique, count]) => {
        const actor = actorIncs[0]?.threat_actor

        patterns.push({
          type: PATTERN_TYPES.ACTOR_TECHNIQUE,
          actorId,
          actorName: actor?.name || actorId,
          technique,
          occurrences: count,
          confidence: Math.min(1, count / 5),
          description: `${actor?.name || 'Unknown actor'} commonly uses ${technique}`,
        })
      })
  })

  return patterns.sort((a, b) => b.occurrences - a.occurrences)
}

/**
 * Detect temporal clustering (bursts of activity)
 */
export function detectTemporalClusters(incidents, windowMs = TIME_WINDOWS.DAY) {
  const patterns = []

  // Sort by timestamp
  const sorted = [...incidents].sort(
    (a, b) => new Date(a.discovered_at || a.created_at) - new Date(b.discovered_at || b.created_at)
  )

  // Slide window to find clusters
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].discovered_at || sorted[i].created_at)
    const windowEnd = new Date(windowStart.getTime() + windowMs)

    const windowIncidents = sorted.filter((inc) => {
      const ts = new Date(inc.discovered_at || inc.created_at)
      return ts >= windowStart && ts <= windowEnd
    })

    if (windowIncidents.length >= MIN_PATTERN_OCCURRENCES * 2) {
      // Check if this cluster is unique (not overlapping with existing)
      const existingCluster = patterns.find(
        (p) => Math.abs(new Date(p.startTime) - windowStart) < windowMs / 2
      )

      if (!existingCluster) {
        // Analyze cluster characteristics
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

/**
 * Detect geographic targeting patterns
 */
export function detectGeographicPatterns(incidents) {
  const patterns = []

  // Count by country
  const countryCounts = {}
  incidents.forEach((inc) => {
    const countries = inc.target_countries || []
    countries.forEach((country) => {
      countryCounts[country] = (countryCounts[country] || 0) + 1
    })
  })

  // Find significant country targeting
  Object.entries(countryCounts)
    .filter(([, count]) => count >= MIN_PATTERN_OCCURRENCES)
    .forEach(([country, count]) => {
      // Get actors targeting this country
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

/**
 * Detect potential campaigns (related incidents)
 */
export function detectCampaigns(incidents) {
  const campaigns = []

  // Group incidents by actor
  const actorIncidents = groupBy(incidents, (i) => i.threat_actor_id || i.threat_actor?.id)

  Object.entries(actorIncidents).forEach(([actorId, actorIncs]) => {
    if (actorIncs.length < MIN_PATTERN_OCCURRENCES) return

    // Sort by time
    const sorted = [...actorIncs].sort(
      (a, b) => new Date(a.discovered_at || a.created_at) - new Date(b.discovered_at || b.created_at)
    )

    // Find time-bounded clusters that might be campaigns
    let campaignStart = sorted[0]
    let campaignIncidents = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].discovered_at || sorted[i - 1].created_at)
      const curr = new Date(sorted[i].discovered_at || sorted[i].created_at)

      // If within 7 days, add to campaign
      if (curr - prev < TIME_WINDOWS.WEEK) {
        campaignIncidents.push(sorted[i])
      } else {
        // End current campaign if significant
        if (campaignIncidents.length >= MIN_PATTERN_OCCURRENCES) {
          const actor = actorIncs[0]?.threat_actor
          const sectors = [...new Set(campaignIncidents.map((i) => i.sector).filter(Boolean))]
          const ttps = [
            ...new Set(campaignIncidents.flatMap((i) => i.ttps || []).filter(Boolean)),
          ]

          campaigns.push({
            type: PATTERN_TYPES.CAMPAIGN,
            actorId,
            actorName: actor?.name || actorId,
            startTime: new Date(
              campaignStart.discovered_at || campaignStart.created_at
            ).toISOString(),
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

        // Start new campaign
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

/**
 * Detect anomalies in incident patterns
 */
export function detectAnomalies(incidents, baselineDays = 30) {
  const anomalies = []
  const now = new Date()
  const baselineStart = new Date(now.getTime() - baselineDays * TIME_WINDOWS.DAY)

  // Calculate daily baseline
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

  // Find anomalous days
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
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Run comprehensive pattern analysis
 */
export async function analyzePatterns(options = {}) {
  const { days = 90, includeTypes = Object.values(PATTERN_TYPES) } = options

  // Fetch incidents with relationships
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: incidents, error } = await supabase
    .from('incidents')
    .select(
      `
      *,
      threat_actor:threat_actors(id, name, aliases)
    `
    )
    .gte('discovered_at', startDate.toISOString())
    .order('discovered_at', { ascending: false })

  if (error) {
    console.error('Error fetching incidents for pattern analysis:', error)
    return { patterns: [], error }
  }

  const patterns = []

  // Run selected analyses
  if (includeTypes.includes(PATTERN_TYPES.ACTOR_SECTOR)) {
    patterns.push(...detectActorSectorPatterns(incidents))
  }

  if (includeTypes.includes(PATTERN_TYPES.ACTOR_TECHNIQUE)) {
    patterns.push(...detectActorTechniquePatterns(incidents))
  }

  if (includeTypes.includes(PATTERN_TYPES.TEMPORAL_CLUSTER)) {
    patterns.push(...detectTemporalClusters(incidents))
  }

  if (includeTypes.includes(PATTERN_TYPES.GEOGRAPHIC)) {
    patterns.push(...detectGeographicPatterns(incidents))
  }

  if (includeTypes.includes(PATTERN_TYPES.CAMPAIGN)) {
    patterns.push(...detectCampaigns(incidents))
  }

  if (includeTypes.includes(PATTERN_TYPES.ANOMALY)) {
    patterns.push(...detectAnomalies(incidents, Math.min(days, 30)))
  }

  return {
    patterns,
    summary: {
      totalIncidents: incidents.length,
      periodDays: days,
      patternsFound: patterns.length,
      byType: Object.values(PATTERN_TYPES).reduce((acc, type) => {
        acc[type] = patterns.filter((p) => p.type === type).length
        return acc
      }, {}),
    },
    error: null,
  }
}

/**
 * Get pattern recommendations based on analysis
 */
export function getPatternRecommendations(patterns) {
  const recommendations = []

  // Check for campaigns
  const campaigns = patterns.filter((p) => p.type === PATTERN_TYPES.CAMPAIGN)
  if (campaigns.length > 0) {
    const topCampaign = campaigns[0]
    recommendations.push({
      priority: 'high',
      category: 'campaign',
      title: `Active campaign detected: ${topCampaign.actorName}`,
      description: `${topCampaign.incidentCount} related incidents targeting ${topCampaign.sectors?.join(', ') || 'multiple sectors'}`,
      actions: ['Review related indicators', 'Update detection rules', 'Brief stakeholders'],
    })
  }

  // Check for anomalies
  const spikes = patterns.filter(
    (p) => p.type === PATTERN_TYPES.ANOMALY && p.direction === 'spike'
  )
  if (spikes.length > 0) {
    const topSpike = spikes[0]
    recommendations.push({
      priority: 'high',
      category: 'anomaly',
      title: `Activity spike on ${topSpike.date}`,
      description: `${topSpike.actualCount} incidents (${Math.round(topSpike.zScore)}x normal)`,
      actions: [
        'Investigate root cause',
        'Check for new vulnerabilities',
        'Review affected sectors',
      ],
    })
  }

  // Check for geographic patterns
  const geoPatterns = patterns.filter((p) => p.type === PATTERN_TYPES.GEOGRAPHIC)
  if (geoPatterns.length > 0) {
    const topGeo = geoPatterns[0]
    recommendations.push({
      priority: 'medium',
      category: 'geographic',
      title: `High targeting of ${topGeo.country}`,
      description: `${topGeo.occurrences} incidents by ${topGeo.actors?.length || 0} actors`,
      actions: ['Brief regional teams', 'Review geofencing', 'Update threat model'],
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export default {
  analyzePatterns,
  detectActorSectorPatterns,
  detectActorTechniquePatterns,
  detectTemporalClusters,
  detectGeographicPatterns,
  detectCampaigns,
  detectAnomalies,
  getPatternRecommendations,
  PATTERN_TYPES,
}
