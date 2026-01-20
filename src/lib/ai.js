// AI integration for threat intelligence summaries
// Uses backend API endpoint to securely call Groq API

import { aiSummaries } from './supabase'
import { logger } from './logger'
import { supabase } from './supabase/client'

const SAVE_THROTTLE_HOURS = 6 // Only save summaries every N hours

/**
 * Check if enough time has passed to save a new summary
 */
async function shouldSaveSummary() {
  try {
    const { data: latest } = await aiSummaries.getLatest()
    if (!latest) return true // No previous summary, save it

    const lastSaved = new Date(latest.generated_at)
    const hoursSince = (Date.now() - lastSaved.getTime()) / (1000 * 60 * 60)
    return hoursSince >= SAVE_THROTTLE_HOURS
  } catch {
    return true // On error, allow save
  }
}

/**
 * Generate a BLUF (Bottom Line Up Front) summary for threat intelligence data
 * Uses backend API to securely call AI service
 * @param {Object} data - The data to summarize
 * @param {Object} options - Options for generation
 * @param {boolean} options.save - Whether to save to database (default: true)
 * @returns {Promise<string>} - The generated summary
 */
export async function generateBLUF(data, options = { save: true }) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    logger.warn('No authenticated user - AI summary disabled')
    return null
  }

  logger.info('Generating AI summary...')

  try {
    const token = session.access_token

    const response = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bluf',
        data: data,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('AI summary API error:', response.status, errorData.error)
      return null
    }

    const result = await response.json()
    const summary = result.summary || null
    logger.info('AI summary generated:', summary ? 'success' : 'empty response')

    // Save to database for historical tracking (throttled to once per 6 hours)
    if (summary && options.save) {
      const metadata = buildMetadata(data)
      shouldSaveSummary().then((shouldSave) => {
        if (shouldSave) {
          aiSummaries
            .save(summary, {
              type: 'dashboard_bluf',
              model: result.model || 'llama-3.3-70b-versatile',
              incidents30d: metadata.incidents30d,
              actors: metadata.actors,
              sectors: metadata.sectors,
              rawData: {
                incidents30d: metadata.incidents30d,
                activeGroups: metadata.actors,
                sectors: metadata.sectors,
                victims: metadata.victims,
              },
            })
            .catch((err) => logger.error('Failed to save AI summary:', err))
        }
      })
    }

    return summary
  } catch (error) {
    logger.error('AI summary generation failed:', error)
    return null
  }
}

/**
 * Build metadata from data for saving
 */
function buildMetadata(data) {
  const { incidents30d = 0, topActors = [], topSectors = [], recentIncidents = [] } = data

  const topActorNames = topActors
    .slice(0, 5)
    .map((a) => a.name)
    .filter(Boolean)
  const realSectors = topSectors
    .filter((s) => !['Other', 'Unknown', 'Not Found', 'other'].includes(s.name))
    .slice(0, 3)
  const recentActorNames = [
    ...new Set(
      recentIncidents
        .slice(0, 20)
        .map((i) => i.threat_actor?.name)
        .filter(Boolean)
    ),
  ].slice(0, 5)
  const victims = recentIncidents
    .slice(0, 5)
    .map((i) => i.victim_name)
    .filter(Boolean)
  const activeGroups = recentActorNames.length > 0 ? recentActorNames : topActorNames

  return {
    incidents30d,
    actors: activeGroups.slice(0, 4),
    sectors: realSectors.map((s) => s.name),
    victims: victims.slice(0, 5),
  }
}
/**
 * Generate a summary for a specific threat actor
 * Uses backend API to securely call AI service
 */
export async function generateActorSummary(actor, recentIncidents = []) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  try {
    const token = session.access_token

    const response = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'actor',
        data: {
          actor: actor,
          incidents: recentIncidents,
        },
      }),
    })

    if (!response.ok) return null
    const result = await response.json()
    return result.summary || null
  } catch (error) {
    logger.error('Actor summary generation failed:', error)
    return null
  }
}

/**
 * Parse a natural language query into structured search parameters
 * Uses keyword-based parsing for fast, reliable results
 * Examples:
 * - "show me ransomware in healthcare" -> { type: 'actors', sectors: ['healthcare'] }
 * - "find IPs from LockBit" -> { type: 'iocs', actor: 'LockBit', iocType: 'ip' }
 * - "critical CVEs with exploits" -> { type: 'vulnerabilities', severity: 'critical', hasExploit: true }
 */
export async function parseNaturalQuery(query) {
  // Use keyword-based parsing - fast and reliable
  return parseQueryKeywords(query)
}

/**
 * Fallback keyword-based query parsing
 */
function parseQueryKeywords(query) {
  const q = query.toLowerCase()
  const result = { parsed: true, aiParsed: false }

  // Detect entity type
  if (
    q.includes('actor') ||
    q.includes('group') ||
    q.includes('gang') ||
    q.includes('ransomware')
  ) {
    result.type = 'actors'
  } else if (q.includes('victim') || q.includes('incident') || q.includes('attack')) {
    result.type = 'incidents'
  } else if (q.includes('cve') || q.includes('vulnerability') || q.includes('vuln')) {
    result.type = 'vulnerabilities'
  } else if (
    q.includes('ioc') ||
    q.includes('ip') ||
    q.includes('domain') ||
    q.includes('hash') ||
    q.includes('indicator')
  ) {
    result.type = 'iocs'
  } else if (q.includes('malware') || q.includes('sample')) {
    result.type = 'malware'
  }

  // Detect sectors
  const sectors = []
  if (q.includes('healthcare') || q.includes('hospital') || q.includes('medical'))
    sectors.push('healthcare')
  if (q.includes('finance') || q.includes('bank') || q.includes('financial'))
    sectors.push('finance')
  if (q.includes('education') || q.includes('school') || q.includes('university'))
    sectors.push('education')
  if (q.includes('government') || q.includes('gov')) sectors.push('government')
  if (q.includes('manufacturing') || q.includes('industrial')) sectors.push('manufacturing')
  if (q.includes('retail') || q.includes('store')) sectors.push('retail')
  if (q.includes('technology') || q.includes('tech') || q.includes('software'))
    sectors.push('technology')
  if (sectors.length > 0) result.sectors = sectors

  // Detect severity
  if (q.includes('critical')) result.severity = 'critical'
  else if (q.includes('high')) result.severity = 'high'
  else if (q.includes('medium')) result.severity = 'medium'
  else if (q.includes('low')) result.severity = 'low'

  // Detect trend status
  if (q.includes('escalating') || q.includes('rising') || q.includes('increasing'))
    result.trendStatus = 'ESCALATING'
  else if (q.includes('declining') || q.includes('decreasing')) result.trendStatus = 'DECLINING'

  // Detect IOC type
  if (q.includes(' ip ') || q.includes('ip address')) result.iocType = 'ip'
  else if (q.includes('domain')) result.iocType = 'domain'
  else if (q.includes('url')) result.iocType = 'url'
  else if (q.includes('hash') || q.includes('md5') || q.includes('sha')) result.iocType = 'hash'

  // Detect exploit/KEV
  if (q.includes('exploit') || q.includes('poc')) result.hasExploit = true
  if (q.includes('kev') || q.includes('known exploited')) result.isKev = true

  // Detect time range
  if (q.includes('week') || q.includes('7 day')) result.dateRange = '7d'
  else if (q.includes('month') || q.includes('30 day')) result.dateRange = '30d'
  else if (q.includes('quarter') || q.includes('90 day')) result.dateRange = '90d'

  // Extract potential actor names (common ones)
  const actorPatterns = [
    'lockbit',
    'blackcat',
    'alphv',
    'cl0p',
    'clop',
    'play',
    'akira',
    'rhysida',
    'blackbasta',
    'black basta',
    'bianlian',
    'royal',
    'medusa',
    'hunters',
    '8base',
    'cactus',
    'qilin',
    'ransomhub',
  ]
  for (const actor of actorPatterns) {
    if (q.includes(actor)) {
      result.actor = actor.charAt(0).toUpperCase() + actor.slice(1)
      break
    }
  }

  // Extract remaining as search term
  let searchTerm = query.replace(/show|me|find|search|for|all|the|with|from|in|and|or/gi, '').trim()
  if (searchTerm.length > 2 && !result.actor) {
    result.search = searchTerm
  }

  return result
}

/**
 * Convert parsed query to Supabase filter parameters
 */
export function queryToFilters(parsed) {
  const filters = {}

  if (parsed.search) filters.search = parsed.search
  if (parsed.actor) filters.actor = parsed.actor
  if (parsed.sectors?.length) filters.sectors = parsed.sectors
  if (parsed.severity) filters.severity = parsed.severity
  if (parsed.trendStatus) filters.trendStatus = parsed.trendStatus
  if (parsed.iocType) filters.type = parsed.iocType
  if (parsed.hasExploit) filters.hasExploit = true
  if (parsed.isKev) filters.isKev = true
  if (parsed.dateRange) filters.dateRange = parsed.dateRange
  if (parsed.limit) filters.limit = parsed.limit

  return filters
}

export default { generateBLUF, generateActorSummary, parseNaturalQuery, queryToFilters }
