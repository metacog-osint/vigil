/**
 * Threat Scoring Module
 * Custom risk scoring models for threat intelligence entities
 */

// Scoring weights configuration
const DEFAULT_WEIGHTS = {
  actors: {
    incident_velocity: 25, // Incidents per day
    incidents_7d: 20, // Recent activity volume
    trend_status: 20, // ESCALATING/STABLE/DECLINING
    sector_relevance: 15, // Match with org profile
    historical_impact: 10, // Past victim count
    geographic_relevance: 10, // Target region match
  },
  vulnerabilities: {
    cvss_score: 20,
    epss_score: 25,
    kev_status: 20,
    exploit_maturity: 15,
    vendor_relevance: 10,
    recency: 10,
  },
  iocs: {
    confidence: 25,
    source_reputation: 20,
    age: 15,
    correlation_count: 20,
    enrichment_signals: 20,
  },
  incidents: {
    recency: 25,
    actor_severity: 25,
    sector_match: 20,
    geographic_match: 15,
    data_impact: 15,
  },
}

// Time decay factor (reduce score for older items)
function calculateTimeDecay(date, halfLifeDays = 30) {
  if (!date) return 1

  const ageMs = Date.now() - new Date(date).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Exponential decay with configurable half-life
  return Math.pow(0.5, ageDays / halfLifeDays)
}

// Normalize value to 0-100 range
function normalize(value, min, max) {
  if (value <= min) return 0
  if (value >= max) return 100
  return ((value - min) / (max - min)) * 100
}

/**
 * Score a threat actor based on multiple factors
 */
export function scoreActor(actor, orgProfile = null, weights = DEFAULT_WEIGHTS.actors) {
  const factors = []
  let totalWeight = 0
  let weightedSum = 0

  // Incident velocity (0-100 based on incidents per day)
  if (actor.incident_velocity !== undefined) {
    const velocityScore = normalize(actor.incident_velocity, 0, 5) // 5+ incidents/day = max
    factors.push({
      factor: 'incident_velocity',
      value: actor.incident_velocity,
      score: velocityScore,
      weight: weights.incident_velocity,
    })
    weightedSum += velocityScore * weights.incident_velocity
    totalWeight += weights.incident_velocity
  }

  // Recent 7-day activity
  if (actor.incidents_7d !== undefined) {
    const recentScore = normalize(actor.incidents_7d, 0, 20) // 20+ incidents in 7d = max
    factors.push({
      factor: 'incidents_7d',
      value: actor.incidents_7d,
      score: recentScore,
      weight: weights.incidents_7d,
    })
    weightedSum += recentScore * weights.incidents_7d
    totalWeight += weights.incidents_7d
  }

  // Trend status
  if (actor.trend_status) {
    const trendScore =
      actor.trend_status === 'ESCALATING' ? 100 : actor.trend_status === 'STABLE' ? 50 : 20
    factors.push({
      factor: 'trend_status',
      value: actor.trend_status,
      score: trendScore,
      weight: weights.trend_status,
    })
    weightedSum += trendScore * weights.trend_status
    totalWeight += weights.trend_status
  }

  // Sector relevance (if org profile provided)
  if (orgProfile?.sector && actor.target_sectors?.length > 0) {
    const sectorMatch = actor.target_sectors.includes(orgProfile.sector)
    const sectorScore = sectorMatch ? 100 : 0
    factors.push({
      factor: 'sector_relevance',
      value: sectorMatch,
      score: sectorScore,
      weight: weights.sector_relevance,
    })
    weightedSum += sectorScore * weights.sector_relevance
    totalWeight += weights.sector_relevance
  }

  // Geographic relevance
  if (orgProfile?.region && actor.target_countries?.length > 0) {
    const regionMatch = actor.target_countries.some(
      (c) =>
        c.toLowerCase().includes(orgProfile.region.toLowerCase()) ||
        c.toLowerCase().includes(orgProfile.country?.toLowerCase() || '')
    )
    const geoScore = regionMatch ? 100 : 0
    factors.push({
      factor: 'geographic_relevance',
      value: regionMatch,
      score: geoScore,
      weight: weights.geographic_relevance,
    })
    weightedSum += geoScore * weights.geographic_relevance
    totalWeight += weights.geographic_relevance
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    score: finalScore,
    level:
      finalScore >= 75
        ? 'critical'
        : finalScore >= 50
          ? 'high'
          : finalScore >= 25
            ? 'medium'
            : 'low',
    factors,
    weights_used: weights,
  }
}

/**
 * Score a vulnerability with time decay
 */
export function scoreVulnerability(
  vuln,
  orgProfile = null,
  weights = DEFAULT_WEIGHTS.vulnerabilities
) {
  const factors = []
  let totalWeight = 0
  let weightedSum = 0

  // CVSS score
  if (vuln.cvss_score !== undefined) {
    const cvssScore = normalize(vuln.cvss_score, 0, 10) // 0-10 scale
    factors.push({
      factor: 'cvss_score',
      value: vuln.cvss_score,
      score: cvssScore,
      weight: weights.cvss_score,
    })
    weightedSum += cvssScore * weights.cvss_score
    totalWeight += weights.cvss_score
  }

  // EPSS score (already 0-1, convert to 0-100)
  if (vuln.epss_score !== undefined) {
    const epssScore = vuln.epss_score * 100
    factors.push({
      factor: 'epss_score',
      value: vuln.epss_score,
      score: epssScore,
      weight: weights.epss_score,
    })
    weightedSum += epssScore * weights.epss_score
    totalWeight += weights.epss_score
  }

  // KEV status
  if (vuln.kev_date !== undefined) {
    const kevScore = vuln.kev_date ? 100 : 0
    factors.push({
      factor: 'kev_status',
      value: !!vuln.kev_date,
      score: kevScore,
      weight: weights.kev_status,
    })
    weightedSum += kevScore * weights.kev_status
    totalWeight += weights.kev_status
  }

  // Exploit maturity
  if (vuln.exploit_maturity) {
    const maturityScores = {
      weaponized: 100,
      high: 85,
      functional: 70,
      poc: 50,
      unproven: 25,
      not_defined: 0,
    }
    const maturityScore = maturityScores[vuln.exploit_maturity] || 0
    factors.push({
      factor: 'exploit_maturity',
      value: vuln.exploit_maturity,
      score: maturityScore,
      weight: weights.exploit_maturity,
    })
    weightedSum += maturityScore * weights.exploit_maturity
    totalWeight += weights.exploit_maturity
  }

  // Vendor relevance
  if (orgProfile?.tech_vendors && vuln.vendor) {
    const vendorMatch = orgProfile.tech_vendors.some((v) =>
      vuln.vendor.toLowerCase().includes(v.toLowerCase())
    )
    const vendorScore = vendorMatch ? 100 : 0
    factors.push({
      factor: 'vendor_relevance',
      value: vendorMatch,
      score: vendorScore,
      weight: weights.vendor_relevance,
    })
    weightedSum += vendorScore * weights.vendor_relevance
    totalWeight += weights.vendor_relevance
  }

  // Recency with time decay
  if (vuln.published_date || vuln.created_at) {
    const decay = calculateTimeDecay(vuln.published_date || vuln.created_at, 90) // 90-day half-life
    const recencyScore = decay * 100
    factors.push({
      factor: 'recency',
      value: decay.toFixed(2),
      score: recencyScore,
      weight: weights.recency,
    })
    weightedSum += recencyScore * weights.recency
    totalWeight += weights.recency
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    score: finalScore,
    level:
      finalScore >= 75
        ? 'critical'
        : finalScore >= 50
          ? 'high'
          : finalScore >= 25
            ? 'medium'
            : 'low',
    factors,
    weights_used: weights,
  }
}

/**
 * Score an IOC
 */
export function scoreIOC(ioc, weights = DEFAULT_WEIGHTS.iocs) {
  const factors = []
  let totalWeight = 0
  let weightedSum = 0

  // Confidence
  if (ioc.confidence !== undefined) {
    const confScore = normalize(ioc.confidence, 0, 100)
    factors.push({
      factor: 'confidence',
      value: ioc.confidence,
      score: confScore,
      weight: weights.confidence,
    })
    weightedSum += confScore * weights.confidence
    totalWeight += weights.confidence
  }

  // Source reputation (based on known good sources)
  const goodSources = ['cisa_kev', 'abuse_ch', 'threatfox', 'malwarebazaar', 'feodo', 'urlhaus']
  if (ioc.source) {
    const sourceScore = goodSources.some((s) => ioc.source.toLowerCase().includes(s)) ? 80 : 40
    factors.push({
      factor: 'source_reputation',
      value: ioc.source,
      score: sourceScore,
      weight: weights.source_reputation,
    })
    weightedSum += sourceScore * weights.source_reputation
    totalWeight += weights.source_reputation
  }

  // Age (newer IOCs are more relevant)
  if (ioc.first_seen || ioc.created_at) {
    const decay = calculateTimeDecay(ioc.first_seen || ioc.created_at, 14) // 2-week half-life for IOCs
    const ageScore = decay * 100
    factors.push({ factor: 'age', value: decay.toFixed(2), score: ageScore, weight: weights.age })
    weightedSum += ageScore * weights.age
    totalWeight += weights.age
  }

  // Correlation count (if available)
  if (ioc.correlation_count !== undefined) {
    const corrScore = normalize(ioc.correlation_count, 0, 10) // 10+ correlations = max
    factors.push({
      factor: 'correlation_count',
      value: ioc.correlation_count,
      score: corrScore,
      weight: weights.correlation_count,
    })
    weightedSum += corrScore * weights.correlation_count
    totalWeight += weights.correlation_count
  }

  // Enrichment signals
  if (ioc.metadata) {
    let enrichScore = 0
    if (ioc.metadata.enriched) enrichScore += 25
    if (ioc.metadata.has_vulns) enrichScore += 25
    if (ioc.metadata.reputation_level === 'malicious') enrichScore += 50
    if (ioc.metadata.suspicious_tld) enrichScore += 25

    factors.push({
      factor: 'enrichment_signals',
      value: enrichScore,
      score: Math.min(enrichScore, 100),
      weight: weights.enrichment_signals,
    })
    weightedSum += Math.min(enrichScore, 100) * weights.enrichment_signals
    totalWeight += weights.enrichment_signals
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    score: finalScore,
    level:
      finalScore >= 75
        ? 'critical'
        : finalScore >= 50
          ? 'high'
          : finalScore >= 25
            ? 'medium'
            : 'low',
    factors,
    weights_used: weights,
  }
}

/**
 * Score an incident
 */
export function scoreIncident(incident, orgProfile = null, weights = DEFAULT_WEIGHTS.incidents) {
  const factors = []
  let totalWeight = 0
  let weightedSum = 0

  // Recency
  if (incident.discovered_date || incident.created_at) {
    const decay = calculateTimeDecay(incident.discovered_date || incident.created_at, 7) // 1-week half-life
    const recencyScore = decay * 100
    factors.push({
      factor: 'recency',
      value: decay.toFixed(2),
      score: recencyScore,
      weight: weights.recency,
    })
    weightedSum += recencyScore * weights.recency
    totalWeight += weights.recency
  }

  // Actor severity (if threat_actor is joined)
  if (incident.threat_actor) {
    let actorSeverity = 50 // default
    if (incident.threat_actor.trend_status === 'ESCALATING') actorSeverity = 90
    if (incident.threat_actor.incidents_7d > 10) actorSeverity = Math.min(actorSeverity + 20, 100)

    factors.push({
      factor: 'actor_severity',
      value: incident.threat_actor.name,
      score: actorSeverity,
      weight: weights.actor_severity,
    })
    weightedSum += actorSeverity * weights.actor_severity
    totalWeight += weights.actor_severity
  }

  // Sector match
  if (orgProfile?.sector && incident.victim_sector) {
    const sectorMatch = incident.victim_sector.toLowerCase() === orgProfile.sector.toLowerCase()
    const sectorScore = sectorMatch ? 100 : 0
    factors.push({
      factor: 'sector_match',
      value: sectorMatch,
      score: sectorScore,
      weight: weights.sector_match,
    })
    weightedSum += sectorScore * weights.sector_match
    totalWeight += weights.sector_match
  }

  // Geographic match
  if (orgProfile?.country && incident.victim_country) {
    const geoMatch = incident.victim_country.toLowerCase() === orgProfile.country.toLowerCase()
    const geoScore = geoMatch ? 100 : 0
    factors.push({
      factor: 'geographic_match',
      value: geoMatch,
      score: geoScore,
      weight: weights.geographic_match,
    })
    weightedSum += geoScore * weights.geographic_match
    totalWeight += weights.geographic_match
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    score: finalScore,
    level:
      finalScore >= 75
        ? 'critical'
        : finalScore >= 50
          ? 'high'
          : finalScore >= 25
            ? 'medium'
            : 'low',
    factors,
    weights_used: weights,
  }
}

/**
 * Create custom scoring model
 */
export function createScoringModel(entityType, customWeights) {
  const baseWeights = DEFAULT_WEIGHTS[entityType] || {}
  const mergedWeights = { ...baseWeights, ...customWeights }

  // Normalize weights to sum to 100
  const totalWeight = Object.values(mergedWeights).reduce((a, b) => a + b, 0)
  const normalizedWeights = {}
  for (const [key, value] of Object.entries(mergedWeights)) {
    normalizedWeights[key] = (value / totalWeight) * 100
  }

  return {
    entityType,
    weights: normalizedWeights,
    score: (entity, orgProfile) => {
      switch (entityType) {
        case 'actors':
          return scoreActor(entity, orgProfile, normalizedWeights)
        case 'vulnerabilities':
          return scoreVulnerability(entity, orgProfile, normalizedWeights)
        case 'iocs':
          return scoreIOC(entity, normalizedWeights)
        case 'incidents':
          return scoreIncident(entity, orgProfile, normalizedWeights)
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }
    },
  }
}

export default {
  scoreActor,
  scoreVulnerability,
  scoreIOC,
  scoreIncident,
  createScoringModel,
  DEFAULT_WEIGHTS,
}
