// AI integration for threat intelligence summaries
// Uses Groq API (free tier) for fast inference

import { aiSummaries } from './supabase'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Model options (all free on Groq):
// - llama-3.3-70b-versatile: Best quality, 128K context
// - llama-3.1-8b-instant: Fast but basic
// - mixtral-8x7b-32768: Good balance
const GROQ_MODEL = 'llama-3.3-70b-versatile' // Best quality, free tier
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
 * @param {Object} data - The data to summarize
 * @param {Object} options - Options for generation
 * @param {boolean} options.save - Whether to save to database (default: true)
 * @returns {Promise<string>} - The generated summary
 */
export async function generateBLUF(data, options = { save: true }) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  if (!apiKey) {
    console.warn('VITE_GROQ_API_KEY not set - AI summary disabled')
    return null // AI features disabled without API key
  }

  console.log('Generating AI summary with Groq...')

  const { prompt, metadata } = buildBLUFPrompt(data)

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a threat intelligence analyst. Write brief, factual summaries about current threat activity. Never give advice or recommendations - just report what's happening. Be specific with names and numbers.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API error:', response.status, errorText)
      return null
    }

    const result = await response.json()
    const summary = result.choices?.[0]?.message?.content || null
    console.log('AI summary generated:', summary ? 'success' : 'empty response')

    // Save to database for historical tracking (throttled to once per 6 hours)
    if (summary && options.save) {
      shouldSaveSummary().then(shouldSave => {
        if (shouldSave) {
          aiSummaries.save(summary, {
            type: 'dashboard_bluf',
            model: GROQ_MODEL,
            incidents30d: metadata.incidents30d,
            actors: metadata.actors,
            sectors: metadata.sectors,
            rawData: {
              incidents30d: metadata.incidents30d,
              activeGroups: metadata.actors,
              sectors: metadata.sectors,
              victims: metadata.victims,
            },
          }).catch(err => console.error('Failed to save AI summary:', err))
        }
      })
    }

    return summary
  } catch (error) {
    console.error('AI summary generation failed:', error)
    return null
  }
}

/**
 * Build the prompt for BLUF generation based on dashboard data
 * @returns {{ prompt: string, metadata: Object }} The prompt and metadata for saving
 */
function buildBLUFPrompt(data) {
  const {
    incidents30d = 0,
    escalatingActors = [],
    topActors = [],
    topSectors = [],
    recentIncidents = [],
  } = data

  // Get top actor names (counts are all-time, so don't use them for "this month")
  const topActorNames = topActors.slice(0, 5).map(a => a.name).filter(Boolean)

  // Get escalating actors if available
  const escalatingNames = escalatingActors.slice(0, 3).map(a => a.name).filter(Boolean)

  // Get meaningful sectors only
  const realSectors = topSectors
    .filter(s => !['Other', 'Unknown', 'Not Found', 'other'].includes(s.name))
    .slice(0, 3)

  // Get unique actors from recent incidents (threat_actor is singular from join)
  const recentActorNames = [...new Set(recentIncidents.slice(0, 20).map(i =>
    i.threat_actor?.name
  ).filter(Boolean))].slice(0, 5)

  // Get recent victim names
  const victims = recentIncidents.slice(0, 5)
    .map(i => i.victim_name)
    .filter(Boolean)

  // Use recent actors from incidents if available, otherwise top actors
  const activeGroups = recentActorNames.length > 0 ? recentActorNames : topActorNames

  const prompt = `You are a ransomware threat analyst. Write ONE specific sentence about current activity.

30-DAY SNAPSHOT:
- ${incidents30d} total ransomware incidents
- Active groups: ${activeGroups.slice(0, 4).join(', ')}
- Sectors targeted: ${realSectors.map(s => `${s.name} (${s.value})`).join(', ') || 'various'}
- Recent victims include: ${victims.slice(0, 3).join(', ')}

Write ONE sentence that a threat analyst would find useful. Focus on:
- Which groups are most active
- Which sectors are being hit
- The overall volume (${incidents30d} in 30 days is ${incidents30d > 500 ? 'HIGH' : incidents30d > 200 ? 'elevated' : 'moderate'})

Do NOT:
- Give advice or recommendations
- Say "organizations should..."
- Use vague phrases like "remains elevated"

Example format: "[Group names] are driving ransomware activity targeting [sectors], with [X] incidents recorded in the past 30 days."`

  const metadata = {
    incidents30d,
    actors: activeGroups.slice(0, 4),
    sectors: realSectors.map(s => s.name),
    victims: victims.slice(0, 5),
  }

  return { prompt, metadata }
}

/**
 * Generate a summary for a specific threat actor
 */
export async function generateActorSummary(actor, recentIncidents = []) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  if (!apiKey) return null

  const prompt = `Summarize this ransomware threat actor in 2-3 sentences:

Actor: ${actor.name}
Status: ${actor.trend_status || 'Unknown'}
Recent incidents (7 days): ${actor.incidents_7d || 0}
Previous incidents (7 days): ${actor.incidents_prev_7d || 0}
Target sectors: ${actor.target_sectors?.join(', ') || 'Various'}
Recent victims: ${recentIncidents.slice(0, 5).map(i => i.victim_name).join(', ') || 'Unknown'}

Focus on: threat level, recent activity changes, and recommended defensive priorities.`

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a cyber threat intelligence analyst. Provide brief, actionable threat actor summaries.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    })

    if (!response.ok) return null
    const result = await response.json()
    return result.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error('Actor summary generation failed:', error)
    return null
  }
}

/**
 * Parse a natural language query into structured search parameters
 * Examples:
 * - "show me ransomware in healthcare" -> { type: 'actors', sectors: ['healthcare'] }
 * - "find IPs from LockBit" -> { type: 'iocs', actor: 'LockBit', iocType: 'ip' }
 * - "critical CVEs with exploits" -> { type: 'vulnerabilities', severity: 'critical', hasExploit: true }
 */
export async function parseNaturalQuery(query) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  if (!apiKey) {
    // Fallback to basic keyword parsing
    return parseQueryKeywords(query)
  }

  const prompt = `Parse this threat intelligence search query into structured JSON parameters.

Query: "${query}"

Output a JSON object with these possible fields:
{
  "type": "actors" | "incidents" | "vulnerabilities" | "iocs" | "malware" | "events",
  "search": "free text search term",
  "actor": "threat actor name if mentioned",
  "sectors": ["array of sectors if mentioned"],
  "severity": "critical" | "high" | "medium" | "low",
  "trendStatus": "ESCALATING" | "STABLE" | "DECLINING",
  "iocType": "ip" | "domain" | "url" | "hash" | "email",
  "hasExploit": true/false,
  "isKev": true/false,
  "dateRange": "7d" | "30d" | "90d",
  "limit": number
}

Only include fields that are relevant to the query. Output ONLY valid JSON, no explanation.

Examples:
- "LockBit victims" -> {"type":"incidents","actor":"LockBit"}
- "escalating ransomware groups" -> {"type":"actors","trendStatus":"ESCALATING"}
- "critical vulnerabilities with public exploits" -> {"type":"vulnerabilities","severity":"critical","hasExploit":true}
- "malicious IPs from the last week" -> {"type":"iocs","iocType":"ip","dateRange":"7d"}`

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast model for parsing
        messages: [
          {
            role: 'system',
            content: 'You are a query parser. Output only valid JSON, nothing else.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      return parseQueryKeywords(query)
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) return parseQueryKeywords(query)

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return parseQueryKeywords(query)

    const parsed = JSON.parse(jsonMatch[0])
    return { ...parsed, parsed: true, aiParsed: true }
  } catch (error) {
    console.error('Natural query parsing failed:', error)
    return parseQueryKeywords(query)
  }
}

/**
 * Fallback keyword-based query parsing
 */
function parseQueryKeywords(query) {
  const q = query.toLowerCase()
  const result = { parsed: true, aiParsed: false }

  // Detect entity type
  if (q.includes('actor') || q.includes('group') || q.includes('gang') || q.includes('ransomware')) {
    result.type = 'actors'
  } else if (q.includes('victim') || q.includes('incident') || q.includes('attack')) {
    result.type = 'incidents'
  } else if (q.includes('cve') || q.includes('vulnerability') || q.includes('vuln')) {
    result.type = 'vulnerabilities'
  } else if (q.includes('ioc') || q.includes('ip') || q.includes('domain') || q.includes('hash') || q.includes('indicator')) {
    result.type = 'iocs'
  } else if (q.includes('malware') || q.includes('sample')) {
    result.type = 'malware'
  }

  // Detect sectors
  const sectors = []
  if (q.includes('healthcare') || q.includes('hospital') || q.includes('medical')) sectors.push('healthcare')
  if (q.includes('finance') || q.includes('bank') || q.includes('financial')) sectors.push('finance')
  if (q.includes('education') || q.includes('school') || q.includes('university')) sectors.push('education')
  if (q.includes('government') || q.includes('gov')) sectors.push('government')
  if (q.includes('manufacturing') || q.includes('industrial')) sectors.push('manufacturing')
  if (q.includes('retail') || q.includes('store')) sectors.push('retail')
  if (q.includes('technology') || q.includes('tech') || q.includes('software')) sectors.push('technology')
  if (sectors.length > 0) result.sectors = sectors

  // Detect severity
  if (q.includes('critical')) result.severity = 'critical'
  else if (q.includes('high')) result.severity = 'high'
  else if (q.includes('medium')) result.severity = 'medium'
  else if (q.includes('low')) result.severity = 'low'

  // Detect trend status
  if (q.includes('escalating') || q.includes('rising') || q.includes('increasing')) result.trendStatus = 'ESCALATING'
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
    'lockbit', 'blackcat', 'alphv', 'cl0p', 'clop', 'play', 'akira',
    'rhysida', 'blackbasta', 'black basta', 'bianlian', 'royal',
    'medusa', 'hunters', '8base', 'cactus', 'qilin', 'ransomhub'
  ]
  for (const actor of actorPatterns) {
    if (q.includes(actor)) {
      result.actor = actor.charAt(0).toUpperCase() + actor.slice(1)
      break
    }
  }

  // Extract remaining as search term
  let searchTerm = query
    .replace(/show|me|find|search|for|all|the|with|from|in|and|or/gi, '')
    .trim()
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
