/**
 * Exposure Scoring Module
 *
 * Calculates and visualizes exposure scores for assets based on
 * vulnerabilities, attack surface, and risk factors.
 */

import { supabase } from './supabase/client'

// ============================================
// CONSTANTS
// ============================================

// Exposure level thresholds
export const EXPOSURE_LEVELS = {
  CRITICAL: { min: 80, max: 100, label: 'Critical', color: '#ef4444' },
  HIGH: { min: 50, max: 79, label: 'High', color: '#f97316' },
  MEDIUM: { min: 20, max: 49, label: 'Medium', color: '#eab308' },
  LOW: { min: 1, max: 19, label: 'Low', color: '#3b82f6' },
  NONE: { min: 0, max: 0, label: 'None', color: '#22c55e' },
}

// Vulnerability weights for scoring
export const VULNERABILITY_WEIGHTS = {
  severity: {
    CRITICAL: 40,
    HIGH: 25,
    MEDIUM: 10,
    LOW: 3,
    INFO: 1,
  },
  factors: {
    kev: 30, // CISA KEV
    exploit: 20, // Public exploit available
    trending: 15, // Currently being exploited in wild
    recent: 10, // Published in last 30 days
  },
}

// Asset criticality multipliers
export const CRITICALITY_MULTIPLIERS = {
  critical: 1.5,
  high: 1.25,
  medium: 1.0,
  low: 0.75,
}

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Get exposure level from score
 */
export function getExposureLevel(score) {
  if (score >= EXPOSURE_LEVELS.CRITICAL.min) return EXPOSURE_LEVELS.CRITICAL
  if (score >= EXPOSURE_LEVELS.HIGH.min) return EXPOSURE_LEVELS.HIGH
  if (score >= EXPOSURE_LEVELS.MEDIUM.min) return EXPOSURE_LEVELS.MEDIUM
  if (score >= EXPOSURE_LEVELS.LOW.min) return EXPOSURE_LEVELS.LOW
  return EXPOSURE_LEVELS.NONE
}

/**
 * Calculate exposure score for an asset
 */
export function calculateExposureScore(vulnerabilities, assetCriticality = 'medium') {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return { score: 0, level: EXPOSURE_LEVELS.NONE, breakdown: {} }
  }

  const breakdown = {
    severityScore: 0,
    kevBonus: 0,
    exploitBonus: 0,
    trendingBonus: 0,
    recencyBonus: 0,
    criticalityMultiplier: CRITICALITY_MULTIPLIERS[assetCriticality] || 1.0,
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  vulnerabilities.forEach((vuln) => {
    // Base severity score
    const severityWeight = VULNERABILITY_WEIGHTS.severity[vuln.severity?.toUpperCase()] || 0
    breakdown.severityScore += severityWeight

    // KEV bonus
    if (vuln.is_kev) {
      breakdown.kevBonus += VULNERABILITY_WEIGHTS.factors.kev
    }

    // Exploit bonus
    if (vuln.has_public_exploit || vuln.has_exploit) {
      breakdown.exploitBonus += VULNERABILITY_WEIGHTS.factors.exploit
    }

    // Trending bonus (being actively exploited)
    if (vuln.is_trending || vuln.actively_exploited) {
      breakdown.trendingBonus += VULNERABILITY_WEIGHTS.factors.trending
    }

    // Recency bonus
    const publishedDate = new Date(vuln.published_date)
    if (publishedDate >= thirtyDaysAgo) {
      breakdown.recencyBonus += VULNERABILITY_WEIGHTS.factors.recent
    }
  })

  // Calculate raw score
  const rawScore =
    breakdown.severityScore +
    breakdown.kevBonus +
    breakdown.exploitBonus +
    breakdown.trendingBonus +
    breakdown.recencyBonus

  // Apply criticality multiplier
  const adjustedScore = Math.round(rawScore * breakdown.criticalityMultiplier)

  // Cap at 100
  const finalScore = Math.min(100, adjustedScore)

  return {
    score: finalScore,
    level: getExposureLevel(finalScore),
    breakdown,
    vulnerabilityCount: vulnerabilities.length,
  }
}

/**
 * Calculate organization-wide exposure score
 */
export function calculateOrgExposure(assets) {
  if (!assets || assets.length === 0) {
    return {
      score: 0,
      level: EXPOSURE_LEVELS.NONE,
      assetCount: 0,
      criticalAssets: 0,
      highAssets: 0,
    }
  }

  const assetExposures = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    score: asset.exposure_score || 0,
    criticality: asset.criticality || 'medium',
  }))

  // Weighted average based on asset criticality
  let totalWeight = 0
  let weightedSum = 0

  assetExposures.forEach((asset) => {
    const weight = CRITICALITY_MULTIPLIERS[asset.criticality] || 1.0
    weightedSum += asset.score * weight
    totalWeight += weight
  })

  const avgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    score: avgScore,
    level: getExposureLevel(avgScore),
    assetCount: assets.length,
    criticalAssets: assetExposures.filter((a) => a.score >= EXPOSURE_LEVELS.CRITICAL.min).length,
    highAssets: assetExposures.filter(
      (a) => a.score >= EXPOSURE_LEVELS.HIGH.min && a.score < EXPOSURE_LEVELS.CRITICAL.min
    ).length,
    mediumAssets: assetExposures.filter(
      (a) => a.score >= EXPOSURE_LEVELS.MEDIUM.min && a.score < EXPOSURE_LEVELS.HIGH.min
    ).length,
    lowAssets: assetExposures.filter(
      (a) => a.score >= EXPOSURE_LEVELS.LOW.min && a.score < EXPOSURE_LEVELS.MEDIUM.min
    ).length,
    noExposure: assetExposures.filter((a) => a.score === 0).length,
    byAsset: assetExposures.sort((a, b) => b.score - a.score),
  }
}

/**
 * Get exposure trend over time
 */
export async function getExposureTrend(assetId, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('asset_exposure_history')
    .select('*')
    .eq('asset_id', assetId)
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('Error fetching exposure trend:', error)
    return { data: [], error }
  }

  // Fill in missing days with interpolation
  const trend = []
  let prevEntry = null

  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - i))
    const dateStr = date.toISOString().split('T')[0]

    const entry = data.find((d) => d.recorded_at.split('T')[0] === dateStr)

    if (entry) {
      trend.push({
        date: dateStr,
        score: entry.exposure_score,
        vulnerabilities: entry.vulnerability_count,
        critical: entry.critical_count,
        high: entry.high_count,
      })
      prevEntry = entry
    } else if (prevEntry) {
      // Interpolate from previous entry
      trend.push({
        date: dateStr,
        score: prevEntry.exposure_score,
        vulnerabilities: prevEntry.vulnerability_count,
        critical: prevEntry.critical_count,
        high: prevEntry.high_count,
      })
    } else {
      // No data yet
      trend.push({
        date: dateStr,
        score: 0,
        vulnerabilities: 0,
        critical: 0,
        high: 0,
      })
    }
  }

  return { data: trend, error: null }
}

/**
 * Get most exposed assets
 */
export async function getMostExposedAssets(options = {}) {
  const { teamId, limit = 10 } = options

  let query = supabase
    .from('assets')
    .select(
      `
      id,
      name,
      asset_type,
      criticality,
      exposure_score,
      exposure_level,
      vulnerability_count,
      critical_vuln_count,
      high_vuln_count
    `
    )
    .eq('status', 'active')
    .gt('exposure_score', 0)
    .order('exposure_score', { ascending: false })
    .limit(limit)

  if (teamId) {
    query = query.eq('team_id', teamId)
  }

  const { data, error } = await query

  return { data, error }
}

/**
 * Get asset vulnerabilities with correlation info
 */
export async function getAssetVulnerabilities(assetId, options = {}) {
  const { status = 'open', limit = 50 } = options

  const { data, error } = await supabase
    .from('asset_vulnerability_correlations')
    .select(
      `
      *,
      vulnerability:vulnerabilities(
        id,
        cve_id,
        severity,
        cvss_score,
        description,
        is_kev,
        has_public_exploit,
        published_date,
        epss_score
      )
    `
    )
    .eq('asset_id', assetId)
    .eq('status', status)
    .order('correlation_score', { ascending: false })
    .limit(limit)

  return { data, error }
}

/**
 * Update vulnerability status for an asset
 */
export async function updateVulnerabilityStatus(correlationId, status, notes = null, userId = null) {
  const updates = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'mitigated') {
    updates.mitigated_at = new Date().toISOString()
    updates.mitigated_by = userId
    updates.mitigation_notes = notes
  }

  const { data, error } = await supabase
    .from('asset_vulnerability_correlations')
    .update(updates)
    .eq('id', correlationId)
    .select()
    .single()

  return { data, error }
}

// ============================================
// RECOMMENDATIONS
// ============================================

/**
 * Generate exposure reduction recommendations
 */
export function generateRecommendations(exposureData) {
  const recommendations = []

  if (!exposureData) return recommendations

  const { score, breakdown, vulnerabilityCount } = exposureData

  // Critical exposure
  if (score >= EXPOSURE_LEVELS.CRITICAL.min) {
    recommendations.push({
      priority: 'critical',
      title: 'Critical Exposure Level',
      description: 'This asset has critical exposure requiring immediate attention.',
      actions: [
        'Review and patch all critical vulnerabilities immediately',
        'Consider taking the asset offline if patches unavailable',
        'Implement compensating controls',
      ],
    })
  }

  // KEV vulnerabilities
  if (breakdown?.kevBonus > 0) {
    const kevCount = Math.round(breakdown.kevBonus / VULNERABILITY_WEIGHTS.factors.kev)
    recommendations.push({
      priority: 'high',
      title: `${kevCount} CISA KEV Vulnerabilities`,
      description: 'These are known exploited vulnerabilities that must be patched per BOD 22-01.',
      actions: [
        'Prioritize patching KEV vulnerabilities',
        'Check CISA remediation deadlines',
        'Document mitigation status',
      ],
    })
  }

  // Public exploits
  if (breakdown?.exploitBonus > 0) {
    const exploitCount = Math.round(breakdown.exploitBonus / VULNERABILITY_WEIGHTS.factors.exploit)
    recommendations.push({
      priority: 'high',
      title: `${exploitCount} Vulnerabilities with Public Exploits`,
      description: 'Exploitation code is publicly available for these vulnerabilities.',
      actions: [
        'Apply patches or mitigations urgently',
        'Monitor for exploitation attempts',
        'Review firewall and IDS rules',
      ],
    })
  }

  // High vulnerability count
  if (vulnerabilityCount > 20) {
    recommendations.push({
      priority: 'medium',
      title: 'High Vulnerability Count',
      description: `This asset has ${vulnerabilityCount} open vulnerabilities.`,
      actions: [
        'Schedule comprehensive patch cycle',
        'Review if asset is end-of-life',
        'Consider asset consolidation or retirement',
      ],
    })
  }

  // Recent vulnerabilities
  if (breakdown?.recencyBonus > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Recent Vulnerabilities',
      description: 'New vulnerabilities have been discovered in the last 30 days.',
      actions: [
        'Review recent security advisories',
        'Test and deploy patches',
        'Update vulnerability scans',
      ],
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export default {
  calculateExposureScore,
  calculateOrgExposure,
  getExposureLevel,
  getExposureTrend,
  getMostExposedAssets,
  getAssetVulnerabilities,
  updateVulnerabilityStatus,
  generateRecommendations,
  EXPOSURE_LEVELS,
  VULNERABILITY_WEIGHTS,
  CRITICALITY_MULTIPLIERS,
}
