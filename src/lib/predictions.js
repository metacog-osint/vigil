/**
 * Predictions Library
 *
 * Predictive analytics for threat intelligence.
 */
import { supabase } from './supabase/client'

/**
 * Risk levels
 */
export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

/**
 * Get actor escalation risk
 * Detects pre-campaign patterns based on activity increase
 * @param {string} actorId - Actor ID
 * @returns {Object} Risk assessment
 */
export async function getActorEscalationRisk(actorId) {
  const { data: actor } = await supabase
    .from('threat_actors')
    .select('*')
    .eq('id', actorId)
    .single()

  if (!actor) return null

  const currentWeek = actor.incidents_7d || 0
  const previousWeek = actor.incidents_prev_7d || 0

  // Calculate increase percentage
  const increase = previousWeek > 0
    ? ((currentWeek - previousWeek) / previousWeek) * 100
    : currentWeek > 0 ? 100 : 0

  // Determine risk level
  let risk = RISK_LEVELS.LOW
  let signal = null

  if (increase >= 100) {
    risk = RISK_LEVELS.CRITICAL
    signal = 'Activity doubled - major campaign likely imminent'
  } else if (increase >= 50) {
    risk = RISK_LEVELS.HIGH
    signal = 'Pre-campaign pattern detected - heightened activity'
  } else if (increase >= 25) {
    risk = RISK_LEVELS.MEDIUM
    signal = 'Increased activity observed'
  }

  // Calculate confidence based on data volume
  const confidence = Math.min(100, 50 + (currentWeek * 5) + (previousWeek * 3))

  return {
    actorId,
    actorName: actor.name,
    risk,
    increase: Math.round(increase),
    signal,
    confidence: Math.round(confidence),
    currentActivity: currentWeek,
    previousActivity: previousWeek,
    trendStatus: actor.trend_status,
  }
}

/**
 * Get sector targeting prediction
 * Based on historical patterns and seasonal trends
 * @param {string} sector - Sector name
 * @returns {Object} Prediction data
 */
export async function getSectorTargetingPrediction(sector) {
  // Get current month for seasonal analysis
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12

  // Seasonal patterns (based on historical trends)
  const seasonalPatterns = {
    retail: { peakMonths: [10, 11, 12], reason: 'Holiday shopping season' },
    healthcare: { peakMonths: [1, 2, 12], reason: 'Flu season and year-end stress' },
    finance: { peakMonths: [1, 2, 3, 4], reason: 'Tax season' },
    education: { peakMonths: [8, 9, 1], reason: 'Start of academic terms' },
    government: { peakMonths: [9, 10], reason: 'Fiscal year end' },
  }

  const pattern = seasonalPatterns[sector?.toLowerCase()]

  // Get current sector activity
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id')
    .eq('sector', sector)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const recentIncidents = incidents?.length || 0

  // Determine if we're in a peak period
  const isSeasonalPeak = pattern?.peakMonths?.includes(month)

  // Calculate risk
  let risk = RISK_LEVELS.LOW
  let prediction = null

  if (isSeasonalPeak) {
    risk = recentIncidents > 10 ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM
    prediction = `${pattern.reason} - historically elevated targeting expected`
  } else if (recentIncidents > 20) {
    risk = RISK_LEVELS.HIGH
    prediction = 'Abnormally high activity outside typical seasonal patterns'
  } else if (recentIncidents > 10) {
    risk = RISK_LEVELS.MEDIUM
    prediction = 'Moderate targeting activity observed'
  }

  return {
    sector,
    risk,
    prediction,
    recentIncidents,
    isSeasonalPeak,
    seasonalReason: pattern?.reason,
    nextPeakMonth: getNextPeakMonth(pattern?.peakMonths, month),
  }
}

/**
 * Get vulnerability exploitation prediction
 * Based on PoC availability, actor interest, and EPSS score
 * @param {string} cveId - CVE ID
 * @returns {Object} Prediction data
 */
export async function getVulnExploitationPrediction(cveId) {
  const { data: vuln } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('cve_id', cveId)
    .single()

  if (!vuln) return null

  // Get actor associations
  const { data: actorVulns } = await supabase
    .from('actor_vulnerabilities')
    .select('actor_id')
    .eq('cve_id', cveId)

  const actorCount = actorVulns?.length || 0

  // Calculate exploitation likelihood
  const factors = {
    epssScore: vuln.epss_score || 0,
    isKEV: vuln.is_kev || false,
    hasPoC: vuln.has_poc || false,
    actorInterest: actorCount > 0,
    severity: vuln.severity || vuln.cvss_severity,
  }

  // Score calculation
  let score = 0
  const reasons = []

  if (factors.isKEV) {
    score += 40
    reasons.push('Already in CISA KEV catalog')
  }
  if (factors.hasPoC) {
    score += 25
    reasons.push('Public PoC available')
  }
  if (factors.actorInterest) {
    score += 20
    reasons.push(`${actorCount} threat actor(s) associated`)
  }
  if (factors.epssScore > 0.5) {
    score += 10
    reasons.push('High EPSS score')
  }
  if (factors.severity === 'CRITICAL') {
    score += 5
    reasons.push('Critical severity')
  }

  // Determine risk level
  let risk = RISK_LEVELS.LOW
  let prediction = 'Low exploitation likelihood'

  if (score >= 60) {
    risk = RISK_LEVELS.CRITICAL
    prediction = 'Exploitation highly likely or already occurring'
  } else if (score >= 40) {
    risk = RISK_LEVELS.HIGH
    prediction = 'Exploitation likely within 7 days'
  } else if (score >= 20) {
    risk = RISK_LEVELS.MEDIUM
    prediction = 'Exploitation possible - monitor closely'
  }

  return {
    cveId,
    risk,
    prediction,
    score,
    factors,
    reasons,
    daysToExploit: estimateDaysToExploit(score),
  }
}

/**
 * Get organization risk score
 * Combines sector targeting, tech stack exposure, and actor focus
 * @param {Object} profile - Organization profile
 * @returns {Object} Risk score data
 */
export async function getOrgRiskScore(profile) {
  if (!profile) return null

  let score = 0
  const factors = []

  // 1. Sector risk (0-35 points)
  const sectorPrediction = await getSectorTargetingPrediction(profile.sector)
  if (sectorPrediction) {
    const sectorScore = sectorPrediction.risk === RISK_LEVELS.HIGH ? 35 :
                        sectorPrediction.risk === RISK_LEVELS.MEDIUM ? 20 : 10
    score += sectorScore
    factors.push({
      factor: 'Sector targeting',
      score: sectorScore,
      detail: sectorPrediction.prediction,
    })
  }

  // 2. Tech stack exposure (0-35 points)
  if (profile.tech_vendors?.length || profile.tech_stack?.length) {
    const techTerms = [...(profile.tech_vendors || []), ...(profile.tech_stack || [])]

    // Check for vulnerabilities affecting tech stack
    const { data: vulns } = await supabase
      .from('vulnerabilities')
      .select('cve_id, severity')
      .eq('is_kev', true)
      .textSearch('affected_products', techTerms.join(' | '))
      .limit(10)

    const vulnCount = vulns?.length || 0
    const techScore = Math.min(35, vulnCount * 7)
    score += techScore
    factors.push({
      factor: 'Tech stack exposure',
      score: techScore,
      detail: `${vulnCount} KEV(s) affect your technology`,
    })
  }

  // 3. Actor focus (0-30 points)
  if (profile.sector) {
    const { data: actors } = await supabase
      .from('threat_actors')
      .select('id, name')
      .eq('trend_status', 'ESCALATING')
      .contains('target_sectors', [profile.sector])
      .limit(5)

    const actorCount = actors?.length || 0
    const actorScore = Math.min(30, actorCount * 10)
    score += actorScore
    factors.push({
      factor: 'Actor focus',
      score: actorScore,
      detail: `${actorCount} escalating actor(s) target your sector`,
    })
  }

  // Determine risk level
  let risk = RISK_LEVELS.LOW
  if (score >= 70) risk = RISK_LEVELS.CRITICAL
  else if (score >= 50) risk = RISK_LEVELS.HIGH
  else if (score >= 30) risk = RISK_LEVELS.MEDIUM

  return {
    score,
    risk,
    factors,
    trend: await calculateScoreTrend(profile),
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Get all predictive alerts for dashboard
 * @param {Object} profile - Organization profile
 * @returns {Array} Predictive alerts
 */
export async function getPredictiveAlerts(profile) {
  const alerts = []

  // Get escalating actors relevant to user
  const { data: escalating } = await supabase
    .from('threat_actors')
    .select('id, name, incidents_7d, incidents_prev_7d')
    .eq('trend_status', 'ESCALATING')
    .order('incidents_7d', { ascending: false })
    .limit(5)

  for (const actor of escalating || []) {
    const risk = await getActorEscalationRisk(actor.id)
    if (risk && risk.risk !== RISK_LEVELS.LOW) {
      alerts.push({
        type: 'actor_escalation',
        entity: actor.name,
        entityId: actor.id,
        risk: risk.risk,
        message: risk.signal,
        confidence: risk.confidence,
      })
    }
  }

  // Get sector prediction if profile exists
  if (profile?.sector) {
    const sectorRisk = await getSectorTargetingPrediction(profile.sector)
    if (sectorRisk && sectorRisk.risk !== RISK_LEVELS.LOW) {
      alerts.push({
        type: 'sector_targeting',
        entity: profile.sector,
        risk: sectorRisk.risk,
        message: sectorRisk.prediction,
        isSeasonalPeak: sectorRisk.isSeasonalPeak,
      })
    }
  }

  // Get high-risk vulnerabilities
  const { data: kevs } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .eq('is_kev', true)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5)

  for (const kev of kevs || []) {
    const vulnRisk = await getVulnExploitationPrediction(kev.cve_id)
    if (vulnRisk && vulnRisk.risk === RISK_LEVELS.CRITICAL) {
      alerts.push({
        type: 'vuln_exploitation',
        entity: kev.cve_id,
        risk: vulnRisk.risk,
        message: vulnRisk.prediction,
        score: vulnRisk.score,
      })
    }
  }

  // Sort by risk level
  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  alerts.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk])

  return alerts
}

// Helper functions
function getNextPeakMonth(peakMonths, currentMonth) {
  if (!peakMonths) return null
  const sorted = [...peakMonths].sort((a, b) => a - b)
  const next = sorted.find(m => m > currentMonth) || sorted[0]
  return next
}

function estimateDaysToExploit(score) {
  if (score >= 60) return '0-3'
  if (score >= 40) return '3-7'
  if (score >= 20) return '7-30'
  return '30+'
}

async function calculateScoreTrend(profile) {
  // Would compare to historical scores
  // For now, return neutral
  return 'stable'
}

export default {
  RISK_LEVELS,
  getActorEscalationRisk,
  getSectorTargetingPrediction,
  getVulnExploitationPrediction,
  getOrgRiskScore,
  getPredictiveAlerts,
}
