/**
 * Predictive Threat Modeling Module
 *
 * Analyzes historical threat data to predict future attack likelihood,
 * actor activity, and vulnerability exploitation trends.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

// Time periods for analysis
const DAYS_MS = 24 * 60 * 60 * 1000

// Confidence levels
export const CONFIDENCE_LEVELS = {
  HIGH: { min: 0.7, label: 'High', color: '#22c55e' },
  MEDIUM: { min: 0.4, label: 'Medium', color: '#eab308' },
  LOW: { min: 0, label: 'Low', color: '#ef4444' },
}

// Prediction types
export const PREDICTION_TYPES = {
  SECTOR_RISK: 'sector_risk',
  ACTOR_ACTIVITY: 'actor_activity',
  VULNERABILITY_EXPLOITATION: 'vuln_exploitation',
  ATTACK_VECTOR: 'attack_vector',
  GEOGRAPHIC_TARGETING: 'geographic_targeting',
}

// ============================================
// STATISTICAL HELPERS
// ============================================

/**
 * Calculate linear regression for trend projection
 */
function linearRegression(data) {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0

  data.forEach((point, i) => {
    sumX += i
    sumY += point
    sumXY += i * point
    sumX2 += i * i
    sumY2 += point * point
  })

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared
  const yMean = sumY / n
  let ssTotal = 0,
    ssResidual = 0
  data.forEach((point, i) => {
    const predicted = slope * i + intercept
    ssTotal += Math.pow(point - yMean, 2)
    ssResidual += Math.pow(point - predicted, 2)
  })
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0

  return { slope, intercept, r2: Math.max(0, r2) }
}

/**
 * Calculate exponential moving average
 */
function exponentialMovingAverage(data, alpha = 0.3) {
  if (data.length === 0) return []

  const ema = [data[0]]
  for (let i = 1; i < data.length; i++) {
    ema.push(alpha * data[i] + (1 - alpha) * ema[i - 1])
  }
  return ema
}

/**
 * Calculate seasonality index (weekly patterns)
 */
function calculateSeasonality(dailyData) {
  if (dailyData.length < 14) return Array(7).fill(1)

  // Group by day of week
  const dayTotals = Array(7).fill(0)
  const dayCounts = Array(7).fill(0)

  dailyData.forEach((value, i) => {
    const dayOfWeek = i % 7
    dayTotals[dayOfWeek] += value
    dayCounts[dayOfWeek]++
  })

  // Calculate average per day of week
  const overallMean = dailyData.reduce((a, b) => a + b, 0) / dailyData.length
  const seasonalIndex = dayTotals.map((total, i) => {
    const dayMean = dayCounts[i] > 0 ? total / dayCounts[i] : overallMean
    return overallMean > 0 ? dayMean / overallMean : 1
  })

  return seasonalIndex
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(confidence) {
  if (confidence >= CONFIDENCE_LEVELS.HIGH.min) return CONFIDENCE_LEVELS.HIGH
  if (confidence >= CONFIDENCE_LEVELS.MEDIUM.min) return CONFIDENCE_LEVELS.MEDIUM
  return CONFIDENCE_LEVELS.LOW
}

// ============================================
// SECTOR RISK PREDICTION
// ============================================

/**
 * Predict sector risk for the next period
 */
export async function predictSectorRisk(options = {}) {
  const { days = 90, forecastDays = 30 } = options

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch historical incident data by sector
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('sector, discovered_at')
    .gte('discovered_at', startDate.toISOString())
    .not('sector', 'is', null)

  if (error) {
    console.error('Error fetching incidents for prediction:', error)
    return { predictions: [], error }
  }

  // Group by sector and day
  const sectorDaily = {}
  incidents.forEach((inc) => {
    const sector = inc.sector
    const day = new Date(inc.discovered_at).toISOString().split('T')[0]

    if (!sectorDaily[sector]) sectorDaily[sector] = {}
    sectorDaily[sector][day] = (sectorDaily[sector][day] || 0) + 1
  })

  // Generate predictions for each sector
  const predictions = []

  Object.entries(sectorDaily).forEach(([sector, dailyData]) => {
    // Convert to array sorted by date
    const dates = Object.keys(dailyData).sort()
    const values = dates.map((d) => dailyData[d])

    if (values.length < 7) return // Need minimum data

    // Calculate trend
    const regression = linearRegression(values)
    const ema = exponentialMovingAverage(values)
    const seasonality = calculateSeasonality(values)

    // Current metrics
    const recentAvg = values.slice(-7).reduce((a, b) => a + b, 0) / 7
    const totalIncidents = values.reduce((a, b) => a + b, 0)

    // Forecast next period
    const forecastValues = []
    for (let i = 0; i < forecastDays; i++) {
      const trendValue = regression.slope * (values.length + i) + regression.intercept
      const seasonalFactor = seasonality[(dates.length + i) % 7]
      const forecast = Math.max(0, trendValue * seasonalFactor)
      forecastValues.push(forecast)
    }

    const forecastAvg = forecastValues.reduce((a, b) => a + b, 0) / forecastDays
    const changePercent = recentAvg > 0 ? ((forecastAvg - recentAvg) / recentAvg) * 100 : 0

    // Calculate confidence based on R² and data volume
    const dataConfidence = Math.min(1, values.length / 60) // More data = more confidence
    const trendConfidence = regression.r2
    const overallConfidence = (dataConfidence + trendConfidence) / 2

    predictions.push({
      type: PREDICTION_TYPES.SECTOR_RISK,
      sector,
      currentAvgDaily: Math.round(recentAvg * 10) / 10,
      forecastAvgDaily: Math.round(forecastAvg * 10) / 10,
      changePercent: Math.round(changePercent),
      direction: changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable',
      confidence: Math.round(overallConfidence * 100) / 100,
      confidenceLevel: getConfidenceLevel(overallConfidence),
      totalIncidents,
      trendSlope: Math.round(regression.slope * 1000) / 1000,
      forecastPeriodDays: forecastDays,
      forecast: forecastValues.map((v) => Math.round(v * 10) / 10),
    })
  })

  // Sort by forecast risk
  predictions.sort((a, b) => b.forecastAvgDaily - a.forecastAvgDaily)

  return { predictions, error: null }
}

// ============================================
// ACTOR ACTIVITY PREDICTION
// ============================================

/**
 * Predict actor activity for the next period
 */
export async function predictActorActivity(options = {}) {
  const { days = 90, forecastDays = 30, minIncidents = 5 } = options

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch actor activity
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('threat_actor_id, discovered_at, threat_actor:threat_actors(id, name, trend_status)')
    .gte('discovered_at', startDate.toISOString())
    .not('threat_actor_id', 'is', null)

  if (error) {
    console.error('Error fetching actor activity:', error)
    return { predictions: [], error }
  }

  // Group by actor and week
  const actorWeekly = {}
  incidents.forEach((inc) => {
    const actorId = inc.threat_actor_id
    const actorName = inc.threat_actor?.name || actorId
    const week = getWeekNumber(new Date(inc.discovered_at))

    if (!actorWeekly[actorId]) {
      actorWeekly[actorId] = { name: actorName, weeks: {}, trendStatus: inc.threat_actor?.trend_status }
    }
    actorWeekly[actorId].weeks[week] = (actorWeekly[actorId].weeks[week] || 0) + 1
  })

  const predictions = []

  Object.entries(actorWeekly).forEach(([actorId, data]) => {
    const weeks = Object.keys(data.weeks).sort()
    const values = weeks.map((w) => data.weeks[w])
    const totalIncidents = values.reduce((a, b) => a + b, 0)

    if (totalIncidents < minIncidents) return

    // Calculate trend
    const regression = linearRegression(values)
    const recentActivity = values.slice(-4).reduce((a, b) => a + b, 0) // Last 4 weeks

    // Forecast
    const forecastWeeks = Math.ceil(forecastDays / 7)
    const forecastValues = []
    for (let i = 0; i < forecastWeeks; i++) {
      const forecast = Math.max(0, regression.slope * (values.length + i) + regression.intercept)
      forecastValues.push(forecast)
    }

    const forecastTotal = forecastValues.reduce((a, b) => a + b, 0)
    const activityChange = recentActivity > 0 ? ((forecastTotal - recentActivity) / recentActivity) * 100 : 0

    // Confidence
    const confidence = Math.min(1, (values.length / 12 + regression.r2) / 2)

    predictions.push({
      type: PREDICTION_TYPES.ACTOR_ACTIVITY,
      actorId,
      actorName: data.name,
      currentTrendStatus: data.trendStatus,
      recentIncidents: recentActivity,
      forecastIncidents: Math.round(forecastTotal),
      changePercent: Math.round(activityChange),
      direction: activityChange > 10 ? 'escalating' : activityChange < -10 ? 'declining' : 'stable',
      confidence: Math.round(confidence * 100) / 100,
      confidenceLevel: getConfidenceLevel(confidence),
      totalHistorical: totalIncidents,
      weeksAnalyzed: values.length,
    })
  })

  // Sort by forecast activity
  predictions.sort((a, b) => b.forecastIncidents - a.forecastIncidents)

  return { predictions: predictions.slice(0, 20), error: null }
}

// ============================================
// VULNERABILITY EXPLOITATION PREDICTION
// ============================================

/**
 * Predict likelihood of vulnerability exploitation
 */
export async function predictVulnerabilityExploitation(options = {}) {
  const { limit = 50 } = options

  // Fetch recent vulnerabilities with exploitation signals
  const { data: vulnerabilities, error } = await supabase
    .from('vulnerabilities')
    .select('*')
    .order('published_date', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Error fetching vulnerabilities:', error)
    return { predictions: [], error }
  }

  const predictions = vulnerabilities
    .map((vuln) => {
      // Calculate exploitation probability based on multiple factors
      let probability = 0
      const factors = []

      // Factor 1: EPSS score (most important)
      if (vuln.epss_score) {
        const epssContrib = vuln.epss_score * 0.4
        probability += epssContrib
        factors.push({ name: 'EPSS Score', value: vuln.epss_score, contribution: epssContrib })
      }

      // Factor 2: CVSS severity
      const cvssScore = vuln.cvss_score || 0
      if (cvssScore >= 9) {
        probability += 0.2
        factors.push({ name: 'Critical CVSS', value: cvssScore, contribution: 0.2 })
      } else if (cvssScore >= 7) {
        probability += 0.1
        factors.push({ name: 'High CVSS', value: cvssScore, contribution: 0.1 })
      }

      // Factor 3: Already in KEV
      if (vuln.is_kev) {
        probability += 0.25
        factors.push({ name: 'In CISA KEV', value: true, contribution: 0.25 })
      }

      // Factor 4: Public exploit exists
      if (vuln.has_public_exploit) {
        probability += 0.2
        factors.push({ name: 'Public Exploit', value: true, contribution: 0.2 })
      }

      // Factor 5: Recency (newer vulns more likely to be exploited soon)
      const daysSincePublish = Math.floor(
        (Date.now() - new Date(vuln.published_date).getTime()) / DAYS_MS
      )
      if (daysSincePublish <= 30) {
        const recencyBonus = 0.1 * (1 - daysSincePublish / 30)
        probability += recencyBonus
        factors.push({ name: 'Recent Publication', value: daysSincePublish, contribution: recencyBonus })
      }

      // Factor 6: Affected popular products
      const popularProducts = ['windows', 'chrome', 'apache', 'nginx', 'linux', 'microsoft', 'cisco']
      const isPopular = popularProducts.some(
        (p) =>
          vuln.product_name?.toLowerCase().includes(p) ||
          vuln.vendor_project?.toLowerCase().includes(p)
      )
      if (isPopular) {
        probability += 0.05
        factors.push({ name: 'Popular Product', value: true, contribution: 0.05 })
      }

      // Cap at 1.0
      probability = Math.min(1, probability)

      // Calculate time to exploitation estimate
      let timeToExploit = 'Unknown'
      if (probability >= 0.7) {
        timeToExploit = vuln.is_kev ? 'Already exploited' : '< 7 days'
      } else if (probability >= 0.5) {
        timeToExploit = '7-30 days'
      } else if (probability >= 0.3) {
        timeToExploit = '30-90 days'
      } else {
        timeToExploit = '> 90 days or unlikely'
      }

      return {
        type: PREDICTION_TYPES.VULNERABILITY_EXPLOITATION,
        cveId: vuln.cve_id,
        severity: vuln.severity,
        cvssScore: vuln.cvss_score,
        epssScore: vuln.epss_score,
        isKev: vuln.is_kev,
        hasExploit: vuln.has_public_exploit,
        probability: Math.round(probability * 100) / 100,
        confidenceLevel: getConfidenceLevel(probability),
        estimatedTimeToExploit: timeToExploit,
        factors,
        publishedDate: vuln.published_date,
        daysSincePublish,
        recommendation:
          probability >= 0.5
            ? 'Prioritize patching immediately'
            : probability >= 0.3
              ? 'Schedule patching within 30 days'
              : 'Monitor for changes',
      }
    })
    .filter((p) => p.probability > 0.1) // Only include meaningful predictions
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit)

  return { predictions, error: null }
}

// ============================================
// ATTACK VECTOR PREDICTION
// ============================================

/**
 * Predict likely attack vectors based on trends
 */
export async function predictAttackVectors(options = {}) {
  const { days = 90 } = options

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch incidents with TTPs
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('ttps, discovered_at')
    .gte('discovered_at', startDate.toISOString())
    .not('ttps', 'is', null)

  if (error) {
    console.error('Error fetching TTPs:', error)
    return { predictions: [], error }
  }

  // Count TTP usage by time period
  const ttpTrends = {}
  const midpoint = new Date(startDate.getTime() + (Date.now() - startDate.getTime()) / 2)

  incidents.forEach((inc) => {
    const isRecent = new Date(inc.discovered_at) > midpoint
    const ttps = inc.ttps || []

    ttps.forEach((ttp) => {
      if (!ttpTrends[ttp]) {
        ttpTrends[ttp] = { early: 0, recent: 0 }
      }
      if (isRecent) {
        ttpTrends[ttp].recent++
      } else {
        ttpTrends[ttp].early++
      }
    })
  })

  // Calculate growth rates and predictions
  const predictions = Object.entries(ttpTrends)
    .map(([ttp, counts]) => {
      const total = counts.early + counts.recent
      const growthRate = counts.early > 0 ? (counts.recent - counts.early) / counts.early : counts.recent > 0 ? 1 : 0
      const direction = growthRate > 0.2 ? 'increasing' : growthRate < -0.2 ? 'decreasing' : 'stable'

      // Confidence based on data volume
      const confidence = Math.min(1, total / 20)

      return {
        type: PREDICTION_TYPES.ATTACK_VECTOR,
        technique: ttp,
        earlyPeriodCount: counts.early,
        recentPeriodCount: counts.recent,
        totalCount: total,
        growthRate: Math.round(growthRate * 100),
        direction,
        confidence: Math.round(confidence * 100) / 100,
        confidenceLevel: getConfidenceLevel(confidence),
        forecast:
          direction === 'increasing'
            ? 'Expect increased usage in coming weeks'
            : direction === 'decreasing'
              ? 'Usage likely to continue declining'
              : 'Usage expected to remain consistent',
      }
    })
    .filter((p) => p.totalCount >= 5)
    .sort((a, b) => b.growthRate - a.growthRate)

  return { predictions, error: null }
}

// ============================================
// COMPREHENSIVE THREAT FORECAST
// ============================================

/**
 * Generate comprehensive threat forecast
 */
export async function generateThreatForecast(options = {}) {
  const { days = 90, forecastDays = 30, orgProfile = null } = options

  const [sectorRisk, actorActivity, vulnExploitation, attackVectors] = await Promise.all([
    predictSectorRisk({ days, forecastDays }),
    predictActorActivity({ days, forecastDays }),
    predictVulnerabilityExploitation({ limit: 20 }),
    predictAttackVectors({ days }),
  ])

  // Filter by org profile if provided
  let relevantSectors = sectorRisk.predictions
  let relevantVulns = vulnExploitation.predictions

  if (orgProfile?.sector) {
    relevantSectors = relevantSectors.filter(
      (p) => p.sector.toLowerCase() === orgProfile.sector.toLowerCase()
    )
  }

  // Generate summary insights
  const insights = []

  // Top escalating sectors
  const escalatingSectors = sectorRisk.predictions.filter((p) => p.direction === 'increasing')
  if (escalatingSectors.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Sectors with Increasing Risk',
      message: `${escalatingSectors.slice(0, 3).map((s) => s.sector).join(', ')} showing increased attack activity`,
      sectors: escalatingSectors.slice(0, 3),
    })
  }

  // Top escalating actors
  const escalatingActors = actorActivity.predictions.filter((p) => p.direction === 'escalating')
  if (escalatingActors.length > 0) {
    insights.push({
      type: 'alert',
      title: 'Actors with Escalating Activity',
      message: `${escalatingActors.slice(0, 3).map((a) => a.actorName).join(', ')} predicted to increase operations`,
      actors: escalatingActors.slice(0, 3),
    })
  }

  // High-probability vulnerabilities
  const highProbVulns = vulnExploitation.predictions.filter((v) => v.probability >= 0.5)
  if (highProbVulns.length > 0) {
    insights.push({
      type: 'critical',
      title: 'High Exploitation Probability',
      message: `${highProbVulns.length} vulnerabilities have >50% exploitation probability`,
      vulnerabilities: highProbVulns.slice(0, 5),
    })
  }

  // Rising attack techniques
  const risingTechniques = attackVectors.predictions.filter(
    (t) => t.direction === 'increasing' && t.growthRate > 50
  )
  if (risingTechniques.length > 0) {
    insights.push({
      type: 'info',
      title: 'Trending Attack Techniques',
      message: `${risingTechniques.slice(0, 3).map((t) => t.technique).join(', ')} usage is increasing`,
      techniques: risingTechniques.slice(0, 5),
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    forecastPeriodDays: forecastDays,
    analysisWindowDays: days,
    sectorRisk: sectorRisk.predictions,
    actorActivity: actorActivity.predictions,
    vulnerabilityExploitation: vulnExploitation.predictions,
    attackVectors: attackVectors.predictions,
    insights,
    summary: {
      escalatingSectors: escalatingSectors.length,
      escalatingActors: escalatingActors.length,
      highRiskVulnerabilities: highProbVulns.length,
      risingTechniques: risingTechniques.length,
    },
  }
}

// ============================================
// HELPERS
// ============================================

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

export default {
  predictSectorRisk,
  predictActorActivity,
  predictVulnerabilityExploitation,
  predictAttackVectors,
  generateThreatForecast,
  CONFIDENCE_LEVELS,
  PREDICTION_TYPES,
}
