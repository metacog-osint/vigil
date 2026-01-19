/**
 * Similarity Library
 *
 * Calculate similarity between incidents, actors, and vulnerabilities.
 */
import { supabase } from './supabase/client'

/**
 * Get similar incidents to a given incident
 * @param {string} incidentId - Incident ID
 * @param {number} limit - Max results
 * @returns {Array} Similar incidents with scores
 */
export async function getSimilarIncidents(incidentId, limit = 5) {
  // Get the source incident
  const { data: incident } = await supabase
    .from('incidents')
    .select('*, threat_actor:threat_actors(id, name)')
    .eq('id', incidentId)
    .single()

  if (!incident) return []

  // Get recent incidents for comparison
  const { data: candidates } = await supabase
    .from('incidents')
    .select('*, threat_actor:threat_actors(id, name)')
    .neq('id', incidentId)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (!candidates?.length) return []

  // Score each candidate
  const scored = candidates.map((candidate) => ({
    ...candidate,
    similarity: calculateIncidentSimilarity(incident, candidate),
  }))

  // Sort by similarity and return top matches
  return scored
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, limit)
    .filter((i) => i.similarity.score > 0)
}

/**
 * Calculate similarity score between two incidents
 */
function calculateIncidentSimilarity(incident, candidate) {
  let score = 0
  const factors = []

  // Same actor = 40 points
  if (incident.threat_actor_id && incident.threat_actor_id === candidate.threat_actor_id) {
    score += 40
    factors.push({ factor: 'Same threat actor', points: 40 })
  }

  // Same sector = 25 points
  if (incident.sector && incident.sector === candidate.sector) {
    score += 25
    factors.push({ factor: 'Same sector', points: 25 })
  }

  // TTP overlap = up to 20 points
  const ttpOverlap = calculateArrayOverlap(incident.ttps || [], candidate.ttps || [])
  if (ttpOverlap > 0) {
    const ttpPoints = Math.min(20, ttpOverlap * 5)
    score += ttpPoints
    factors.push({ factor: `${ttpOverlap} shared TTPs`, points: ttpPoints })
  }

  // Geographic proximity = 15 points
  if (incident.country && incident.country === candidate.country) {
    score += 15
    factors.push({ factor: 'Same country', points: 15 })
  } else if (incident.region && incident.region === candidate.region) {
    score += 7
    factors.push({ factor: 'Same region', points: 7 })
  }

  return { score, factors }
}

/**
 * Get similar actors to a given actor
 * @param {string} actorId - Actor ID
 * @param {number} limit - Max results
 * @returns {Array} Similar actors with scores
 */
export async function getSimilarActors(actorId, limit = 5) {
  // Get the source actor
  const { data: actor } = await supabase
    .from('threat_actors')
    .select('*')
    .eq('id', actorId)
    .single()

  if (!actor) return []

  // Get all actors for comparison
  const { data: candidates } = await supabase
    .from('threat_actors')
    .select('*')
    .neq('id', actorId)
    .limit(100)

  if (!candidates?.length) return []

  // Score each candidate
  const scored = candidates.map((candidate) => ({
    ...candidate,
    similarity: calculateActorSimilarity(actor, candidate),
  }))

  // Sort by similarity and return top matches
  return scored
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, limit)
    .filter((a) => a.similarity.score > 0)
}

/**
 * Calculate similarity score between two actors
 */
function calculateActorSimilarity(actor, candidate) {
  let score = 0
  const factors = []

  // Same type = 20 points
  if (actor.actor_type && actor.actor_type === candidate.actor_type) {
    score += 20
    factors.push({ factor: 'Same actor type', points: 20 })
  }

  // Sector overlap = up to 25 points
  const sectorOverlap = calculateArrayOverlap(
    actor.target_sectors || [],
    candidate.target_sectors || []
  )
  if (sectorOverlap > 0) {
    const sectorPoints = Math.min(25, sectorOverlap * 10)
    score += sectorPoints
    factors.push({ factor: `${sectorOverlap} shared target sectors`, points: sectorPoints })
  }

  // Country overlap = up to 20 points
  const countryOverlap = calculateArrayOverlap(
    actor.target_countries || [],
    candidate.target_countries || []
  )
  if (countryOverlap > 0) {
    const countryPoints = Math.min(20, countryOverlap * 5)
    score += countryPoints
    factors.push({ factor: `${countryOverlap} shared target countries`, points: countryPoints })
  }

  // TTP overlap = up to 25 points
  const ttpOverlap = calculateArrayOverlap(actor.ttps || [], candidate.ttps || [])
  if (ttpOverlap > 0) {
    const ttpPoints = Math.min(25, ttpOverlap * 5)
    score += ttpPoints
    factors.push({ factor: `${ttpOverlap} shared TTPs`, points: ttpPoints })
  }

  // Attribution overlap = 10 points
  if (actor.country && actor.country === candidate.country) {
    score += 10
    factors.push({ factor: 'Same attribution', points: 10 })
  }

  return { score, factors }
}

/**
 * Get similar CVEs to a given CVE
 * @param {string} cveId - CVE ID
 * @param {number} limit - Max results
 * @returns {Array} Similar CVEs with scores
 */
export async function getSimilarVulnerabilities(cveId, limit = 5) {
  // Get the source vulnerability
  const { data: vuln } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('cve_id', cveId)
    .single()

  if (!vuln) return []

  // Get recent vulnerabilities for comparison
  const { data: candidates } = await supabase
    .from('vulnerabilities')
    .select('*')
    .neq('cve_id', cveId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!candidates?.length) return []

  // Score each candidate
  const scored = candidates.map((candidate) => ({
    ...candidate,
    similarity: calculateVulnSimilarity(vuln, candidate),
  }))

  // Sort by similarity and return top matches
  return scored
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, limit)
    .filter((v) => v.similarity.score > 0)
}

/**
 * Calculate similarity score between two vulnerabilities
 */
function calculateVulnSimilarity(vuln, candidate) {
  let score = 0
  const factors = []

  // Same vendor = 30 points
  if (vuln.vendor && vuln.vendor === candidate.vendor) {
    score += 30
    factors.push({ factor: 'Same vendor', points: 30 })
  }

  // Same product = 25 points
  if (vuln.product && vuln.product === candidate.product) {
    score += 25
    factors.push({ factor: 'Same product', points: 25 })
  }

  // Same weakness type (CWE) = 20 points
  if (vuln.cwe_id && vuln.cwe_id === candidate.cwe_id) {
    score += 20
    factors.push({ factor: 'Same vulnerability type', points: 20 })
  }

  // Same severity = 15 points
  if (vuln.severity && vuln.severity === candidate.severity) {
    score += 15
    factors.push({ factor: 'Same severity', points: 15 })
  }

  // Both KEV = 10 points
  if (vuln.is_kev && candidate.is_kev) {
    score += 10
    factors.push({ factor: 'Both in KEV', points: 10 })
  }

  return { score, factors }
}

/**
 * Helper: Calculate overlap between two arrays
 */
function calculateArrayOverlap(arr1, arr2) {
  if (!arr1?.length || !arr2?.length) return 0
  const set1 = new Set(arr1.map((i) => i?.toLowerCase?.() || i))
  const set2 = new Set(arr2.map((i) => i?.toLowerCase?.() || i))
  return [...set1].filter((item) => set2.has(item)).length
}

export default {
  getSimilarIncidents,
  getSimilarActors,
  getSimilarVulnerabilities,
}
