/**
 * Digest Generator
 *
 * Builds digest content for email notifications.
 */
import { supabase } from './supabase/client'
import {
  threatActors,
  incidents,
  vulnerabilities,
  trendAnalysis,
  relevance,
  orgProfile,
} from './supabase'

/**
 * Generate a digest for a user
 * @param {string} userId - User ID
 * @param {string} type - 'daily' or 'weekly'
 * @returns {Object} Digest content
 */
export async function generateDigest(userId, type = 'weekly') {
  const days = type === 'daily' ? 1 : 7

  // Load user's org profile for relevance
  const profile = await orgProfile.get()

  // Get date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch all data in parallel
  const [summary, topActorsData, recentIncidentsData, newVulnsData, escalatingActors] =
    await Promise.all([
      trendAnalysis.getChangeSummary(days),
      threatActors.getEscalating(5),
      incidents.getRecent(10),
      vulnerabilities.getRecent(10),
      threatActors.getAll({ trendStatus: 'ESCALATING', limit: 5 }),
    ])

  // Calculate relevance scores if profile exists
  let relevantActors = []
  let relevantVulns = []

  if (profile) {
    relevantActors = await relevance.getRelevantActors(profile, 3)
    relevantVulns = await relevance.getRelevantVulnerabilities(profile, 3)
  }

  // Filter incidents to period
  const periodIncidents = (recentIncidentsData || []).filter((inc) => {
    const incDate = new Date(inc.created_at || inc.discovered_date)
    return incDate >= startDate && incDate <= endDate
  })

  // Filter vulns to period
  const periodVulns = (newVulnsData || []).filter((vuln) => {
    const vulnDate = new Date(vuln.published || vuln.created_at)
    return vulnDate >= startDate && vulnDate <= endDate
  })

  return {
    type,
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days,
    },
    profile: profile
      ? {
          sector: profile.sector,
          region: profile.region,
          country: profile.country,
        }
      : null,
    summary: {
      totalIncidents: summary?.newIncidents || periodIncidents.length,
      escalatingActors: summary?.escalatingActors || escalatingActors?.data?.length || 0,
      newKEVs: summary?.newKEVs || 0,
      incidentChange: summary?.incidentChange || 0,
    },
    relevantToYou: profile
      ? {
          actors: relevantActors.slice(0, 3).map((a) => ({
            id: a.id,
            name: a.name,
            incidentCount: a.incident_count || a.incidents_7d || 0,
            relevanceScore: a.relevanceScore,
            reason: a.relevanceReasons?.[0]?.factor || 'Matches your profile',
          })),
          vulnerabilities: relevantVulns.slice(0, 3).map((v) => ({
            id: v.cve_id || v.id,
            name: v.cve_id || v.name,
            severity: v.severity || v.cvss_severity,
            relevanceScore: v.relevanceScore,
            reason: v.relevanceReasons?.[0]?.factor || 'Affects your tech stack',
          })),
        }
      : null,
    topActors: (topActorsData || []).slice(0, 5).map((a) => ({
      id: a.id,
      name: a.name,
      incidentCount: a.incidents_7d || a.incident_count || 0,
      trendStatus: a.trend_status,
    })),
    topIncidents: periodIncidents.slice(0, 5).map((i) => ({
      id: i.id,
      victimName: i.victim_name,
      actorName: i.threat_actor?.name || 'Unknown',
      sector: i.victim_sector,
      country: i.victim_country,
      date: i.discovered_date || i.created_at,
    })),
    newVulnerabilities: periodVulns.slice(0, 5).map((v) => ({
      id: v.cve_id || v.id,
      name: v.cve_id,
      severity: v.severity || v.cvss_severity,
      description: v.description?.substring(0, 150) + '...',
      isKEV: v.is_kev || false,
    })),
  }
}

/**
 * Get users who should receive a digest
 * @param {string} type - 'daily' or 'weekly'
 * @returns {Array} Users with digest preferences
 */
export async function getDigestRecipients(type = 'weekly') {
  const { data, error } = await supabase
    .from('digest_preferences')
    .select(
      `
      *,
      user:auth.users(id, email)
    `
    )
    .eq('frequency', type)

  if (error) {
    console.error('Error fetching digest recipients:', error)
    return []
  }

  return data || []
}

/**
 * Check if digest content has changed (avoid duplicate sends)
 * @param {string} userId - User ID
 * @param {Object} digest - Digest content
 * @returns {boolean} True if content is different from last digest
 */
export async function hasDigestChanged(userId, digest) {
  // Create a hash of key content
  const contentHash = createContentHash(digest)

  const { data } = await supabase
    .from('digest_history')
    .select('content_hash')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  return !data || data.content_hash !== contentHash
}

/**
 * Record that a digest was sent
 * @param {string} userId - User ID
 * @param {Object} digest - Digest content
 */
export async function recordDigestSent(userId, digest) {
  const contentHash = createContentHash(digest)

  await supabase.from('digest_history').insert({
    user_id: userId,
    digest_type: digest.type,
    content_hash: contentHash,
    sent_at: new Date().toISOString(),
  })
}

/**
 * Create a simple hash of digest content
 */
function createContentHash(digest) {
  const key = [
    digest.summary.totalIncidents,
    digest.summary.escalatingActors,
    digest.summary.newKEVs,
    digest.topActors.map((a) => a.id).join(','),
    digest.topIncidents.map((i) => i.id).join(','),
  ].join('|')

  // Simple hash function
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export default {
  generateDigest,
  getDigestRecipients,
  hasDigestChanged,
  recordDigestSent,
}
