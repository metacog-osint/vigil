/**
 * AI Summary Generation API Endpoint
 * Securely generates summaries via Groq API without exposing API key to frontend
 *
 * POST /api/generate-summary
 * Body: { type: 'bluf' | 'actor', data: {...} }
 * Headers: Authorization: Bearer <firebase-id-token>
 */

import { verifyRequest } from './_lib/supabase-auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from './_lib/cors.js'

// Web-standard handler (Request in, Response out) requires the Edge runtime
export const config = { runtime: 'edge' }

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// Rate limit: 5 summary requests per minute per user
const rateLimitMap = new Map()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 1000

function checkRateLimit(userId) {
  const now = Date.now()
  const userKey = `ai:${userId}`
  const userRequests = rateLimitMap.get(userKey) || []

  // Clean old requests
  const validRequests = userRequests.filter((time) => now - time < RATE_WINDOW_MS)

  if (validRequests.length >= RATE_LIMIT) {
    return false
  }

  validRequests.push(now)
  rateLimitMap.set(userKey, validRequests)
  return true
}

/**
 * Build BLUF (Bottom Line Up Front) prompt from dashboard data
 */
function buildBLUFPrompt(data) {
  const { incidents30d = 0, topActors = [], escalatingActors = [], topSectors = [], recentIncidents = [] } = data

  const topActorNames = topActors.slice(0, 5).map((a) => a.name).filter(Boolean)
  const escalatingNames = escalatingActors.slice(0, 3).map((a) => a.name).filter(Boolean)
  const realSectors = topSectors
    .filter((s) => !['Other', 'Unknown', 'Not Found', 'other'].includes(s.name))
    .slice(0, 3)
  const recentActorNames = [
    ...new Set(recentIncidents.slice(0, 20).map((i) => i.threat_actor?.name).filter(Boolean)),
  ].slice(0, 5)
  const victims = recentIncidents.slice(0, 5).map((i) => i.victim_name).filter(Boolean)
  const activeGroups = recentActorNames.length > 0 ? recentActorNames : topActorNames

  return `You are a ransomware threat analyst. Write ONE specific sentence about current activity.

Data:
- ${incidents30d} ransomware incidents in last 30 days
- Most active groups: ${activeGroups.join(', ') || 'Unknown'}
${escalatingNames.length > 0 ? `- Escalating actors: ${escalatingNames.join(', ')}` : ''}
- Top sectors: ${realSectors.map((s) => s.name).join(', ') || 'Various'}
- Recent victims: ${victims.join(', ') || 'Multiple organizations'}

Write a one-sentence BLUF summary. Be specific with names and numbers. No advice.`
}

/**
 * Build actor summary prompt
 */
function buildActorPrompt(actor, incidents = []) {
  const incidentDetails = incidents.slice(0, 5).map((i) => `- ${i.victim_name} (${i.sector || 'unknown sector'})`)

  return `Write a 2-sentence threat actor summary.

Actor: ${actor.name}
${actor.aliases?.length ? `Aliases: ${actor.aliases.join(', ')}` : ''}
${actor.first_seen ? `Active since: ${actor.first_seen}` : ''}
${actor.origin_country ? `Origin: ${actor.origin_country}` : ''}
Recent victims:
${incidentDetails.join('\n') || 'No recent activity'}

Write a factual 2-sentence summary about this group. No advice.`
}

/**
 * Entity summary prompts (actor, vulnerability, ioc, incident)
 * Built server-side so the client only sends entity data, never a raw prompt.
 */
const ENTITY_PROMPTS = {
  actor: (actor, incidents = []) =>
    `
Provide a 2-3 sentence threat intelligence summary for the threat actor "${actor.name}".

Actor data:
- Trend status: ${actor.trend_status || 'Unknown'}
- Incidents in last 7 days: ${actor.incidents_7d || 0}
- Incident velocity: ${Number.isFinite(actor.incident_velocity) ? actor.incident_velocity.toFixed(2) : 'Unknown'} per day
- Target sectors: ${actor.target_sectors?.join(', ') || 'Unknown'}
- Target countries: ${actor.target_countries?.join(', ') || 'Unknown'}
- First seen: ${actor.first_observed || 'Unknown'}
- Recent victims: ${
      incidents
        .slice(0, 5)
        .map((i) => i.victim_name)
        .join(', ') || 'None recent'
    }

Focus on:
1. Current threat level and activity trend
2. Primary targeting focus (sectors/regions)
3. Key risk indicators for defenders

Be specific and actionable. Start with the most important finding.
`.trim(),

  vulnerability: (vuln) =>
    `
Provide a 2-3 sentence threat intelligence summary for ${vuln.cve_id}.

Vulnerability data:
- CVSS Score: ${vuln.cvss_score || 'Unknown'}
- EPSS Score: ${Number.isFinite(vuln.epss_score) ? (vuln.epss_score * 100).toFixed(2) : 'Unknown'}%
- Vendor: ${vuln.vendor || 'Unknown'}
- Product: ${vuln.product || 'Unknown'}
- In KEV: ${vuln.kev_date ? 'Yes' : 'No'}
- Exploit Maturity: ${vuln.exploit_maturity || 'Unknown'}
- Published: ${vuln.published_date || 'Unknown'}
- Description: ${vuln.description?.slice(0, 500) || 'Not available'}

Focus on:
1. Real-world exploitation risk
2. Priority for patching
3. Key mitigation recommendations

Be specific and actionable.
`.trim(),

  ioc: (ioc) =>
    `
Provide a brief threat intelligence assessment for this IOC:

IOC data:
- Type: ${ioc.type}
- Value: ${ioc.value}
- Source: ${ioc.source || 'Unknown'}
- Confidence: ${ioc.confidence || 'Unknown'}%
- First seen: ${ioc.first_seen || 'Unknown'}
- Malware family: ${ioc.malware_family || 'Unknown'}
- Tags: ${ioc.tags?.join(', ') || 'None'}

Focus on:
1. Threat context and attribution
2. Recommended detection/blocking approach
3. Related threat activity

Be concise (2-3 sentences).
`.trim(),

  incident: (incident) =>
    `
Provide a threat intelligence summary for this incident:

Incident data:
- Victim: ${incident.victim_name}
- Sector: ${incident.victim_sector || 'Unknown'}
- Country: ${incident.victim_country || 'Unknown'}
- Threat Actor: ${incident.threat_actor?.name || 'Unknown'}
- Actor Trend: ${incident.threat_actor?.trend_status || 'Unknown'}
- Discovered: ${incident.discovered_date || 'Unknown'}
- Source: ${incident.source || 'Unknown'}

Focus on:
1. Significance of this incident
2. Pattern/campaign context if applicable
3. Implications for similar organizations

Be concise (2-3 sentences).
`.trim(),
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a threat intelligence analyst. Write brief, factual summaries about current threat activity. Never give advice or recommendations - just report what's happening. Be specific with names and numbers."

const ENTITY_SYSTEM_PROMPT =
  'You are a threat intelligence analyst. Provide concise, actionable summaries. Never use markdown formatting. Use plain text only.'

export default async function handler(request) {
  const origin = request.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(request)
  if (preflightResponse) {
    return preflightResponse
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Verify Firebase token
  const { user, error: authError } = await verifyRequest(request)
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Check rate limit
  if (!checkRateLimit(user.id)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 5 requests per minute.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders,
      },
    })
  }

  // Check API key configured
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type and data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    let prompt
    let maxTokens = 150
    let systemPrompt = DEFAULT_SYSTEM_PROMPT
    let temperature = 0.5

    switch (type) {
      case 'bluf':
        prompt = buildBLUFPrompt(data)
        maxTokens = 150
        break
      case 'actor':
        if (!data.actor) {
          return new Response(JSON.stringify({ error: 'Missing actor data' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        prompt = buildActorPrompt(data.actor, data.incidents || [])
        maxTokens = 200
        break
      case 'entity': {
        const promptFn = ENTITY_PROMPTS[data.entityType]
        if (!promptFn || !data.entity) {
          return new Response(JSON.stringify({ error: 'Invalid entityType or missing entity' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        prompt = promptFn(data.entity, Array.isArray(data.incidents) ? data.incidents : [])
        maxTokens = 300
        systemPrompt = ENTITY_SYSTEM_PROMPT
        temperature = 0.3
        break
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid summary type. Use "bluf", "actor" or "entity"' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    }

    // Call Groq API
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API error:', response.status, errorText)
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const result = await response.json()
    const summary = result.choices?.[0]?.message?.content || null

    if (!summary) {
      return new Response(JSON.stringify({ error: 'No summary generated' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        model: GROQ_MODEL,
        type,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  } catch (error) {
    console.error('AI summary error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
