/**
 * EntityThreatSummary Component
 * AI-powered threat summaries for entities
 */

import { useState, useEffect, useCallback } from 'react'
import {
  SparklesIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'

// Summary templates for different entity types
const SUMMARY_PROMPTS = {
  actor: (actor, incidents) => `
Provide a 2-3 sentence threat intelligence summary for the threat actor "${actor.name}".

Actor data:
- Trend status: ${actor.trend_status || 'Unknown'}
- Incidents in last 7 days: ${actor.incidents_7d || 0}
- Incident velocity: ${actor.incident_velocity?.toFixed(2) || 'Unknown'} per day
- Target sectors: ${actor.target_sectors?.join(', ') || 'Unknown'}
- Target countries: ${actor.target_countries?.join(', ') || 'Unknown'}
- First seen: ${actor.first_observed || 'Unknown'}
- Recent victims: ${incidents?.slice(0, 5).map(i => i.victim_name).join(', ') || 'None recent'}

Focus on:
1. Current threat level and activity trend
2. Primary targeting focus (sectors/regions)
3. Key risk indicators for defenders

Be specific and actionable. Start with the most important finding.
`.trim(),

  vulnerability: (vuln) => `
Provide a 2-3 sentence threat intelligence summary for ${vuln.cve_id}.

Vulnerability data:
- CVSS Score: ${vuln.cvss_score || 'Unknown'}
- EPSS Score: ${(vuln.epss_score * 100)?.toFixed(2) || 'Unknown'}%
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

  ioc: (ioc) => `
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

  incident: (incident) => `
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

// Generate summary using AI
async function generateSummary(entityType, entity, additionalData = {}) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  if (!apiKey) {
    // Fall back to template-based summary
    return generateTemplateSummary(entityType, entity, additionalData)
  }

  const promptFn = SUMMARY_PROMPTS[entityType]
  if (!promptFn) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  const prompt = promptFn(entity, additionalData.incidents)

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a threat intelligence analyst. Provide concise, actionable summaries. Never use markdown formatting. Use plain text only.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'Unable to generate summary.'
  } catch (error) {
    console.error('AI summary error:', error)
    return generateTemplateSummary(entityType, entity, additionalData)
  }
}

// Template-based fallback summary
function generateTemplateSummary(entityType, entity, _additionalData = {}) {
  switch (entityType) {
    case 'actor': {
      const trend = entity.trend_status === 'ESCALATING' ? 'increasing activity' :
                    entity.trend_status === 'DECLINING' ? 'decreasing activity' : 'stable activity'
      const sectors = entity.target_sectors?.slice(0, 3).join(', ') || 'various sectors'
      return `${entity.name} is showing ${trend} with ${entity.incidents_7d || 0} incidents in the past week. Primary targets include ${sectors}. ${
        entity.trend_status === 'ESCALATING' ? 'Elevated monitoring recommended.' : 'Standard monitoring advised.'
      }`
    }
    case 'vulnerability': {
      const risk = entity.cvss_score >= 9 ? 'critical' : entity.cvss_score >= 7 ? 'high' : 'moderate'
      const kevNote = entity.kev_date ? ' Listed in CISA KEV, indicating active exploitation.' : ''
      return `${entity.cve_id} is a ${risk} severity vulnerability (CVSS ${entity.cvss_score}).${kevNote} Affects ${entity.vendor || 'multiple vendors'}. ${
        entity.epss_score > 0.1 ? 'High exploitation probability - prioritize patching.' : 'Standard remediation timeline appropriate.'
      }`
    }
    case 'ioc': {
      const conf = entity.confidence >= 80 ? 'high confidence' : entity.confidence >= 50 ? 'medium confidence' : 'low confidence'
      return `${entity.type.toUpperCase()} indicator with ${conf} from ${entity.source || 'open source'}. ${
        entity.malware_family ? `Associated with ${entity.malware_family} malware family.` : ''
      } First observed ${entity.first_seen ? new Date(entity.first_seen).toLocaleDateString() : 'recently'}.`
    }
    case 'incident': {
      return `${entity.victim_name} (${entity.victim_sector || 'Unknown sector'}) was targeted by ${entity.threat_actor?.name || 'unknown actor'}. ${
        entity.threat_actor?.trend_status === 'ESCALATING' ? 'Actor showing increased activity.' : ''
      } Discovered ${entity.discovered_date ? new Date(entity.discovered_date).toLocaleDateString() : 'recently'}.`
    }
    default:
      return 'Summary not available for this entity type.'
  }
}

// Generate recommendations
function generateRecommendations(entityType, entity) {
  const recommendations = []

  switch (entityType) {
    case 'actor':
      if (entity.trend_status === 'ESCALATING') {
        recommendations.push('Review and update detection rules for this actor')
      }
      if (entity.target_sectors?.length > 0) {
        recommendations.push(`Alert teams in ${entity.target_sectors[0]} sector`)
      }
      recommendations.push('Check for related IOCs in your environment')
      break

    case 'vulnerability':
      if (entity.kev_date) {
        recommendations.push('Immediate patching required - active exploitation confirmed')
      } else if (entity.cvss_score >= 9) {
        recommendations.push('Prioritize patching within 24-48 hours')
      } else if (entity.cvss_score >= 7) {
        recommendations.push('Schedule patching within standard SLA')
      }
      if (entity.epss_score > 0.1) {
        recommendations.push('Implement temporary mitigations if patch unavailable')
      }
      recommendations.push('Verify affected assets in your inventory')
      break

    case 'ioc':
      recommendations.push('Search historical logs for this indicator')
      if (entity.confidence >= 80) {
        recommendations.push('Add to blocklist if appropriate')
      } else {
        recommendations.push('Monitor but avoid blocking until verified')
      }
      recommendations.push('Check for related indicators')
      break

    case 'incident':
      if (entity.threat_actor?.trend_status === 'ESCALATING') {
        recommendations.push('Review actor TTPs and update defenses')
      }
      recommendations.push('Assess exposure to similar attack vectors')
      recommendations.push('Verify no similar targeting in your organization')
      break
  }

  return recommendations
}

// Risk indicators component
function RiskIndicators({ entityType, entity }) {
  const indicators = []

  switch (entityType) {
    case 'actor':
      if (entity.trend_status === 'ESCALATING') {
        indicators.push({ label: 'Escalating Activity', level: 'critical' })
      }
      if (entity.incidents_7d > 10) {
        indicators.push({ label: 'High Volume', level: 'high' })
      }
      if (entity.incident_velocity > 2) {
        indicators.push({ label: 'Rapid Attack Rate', level: 'high' })
      }
      break

    case 'vulnerability':
      if (entity.kev_date) {
        indicators.push({ label: 'In CISA KEV', level: 'critical' })
      }
      if (entity.cvss_score >= 9) {
        indicators.push({ label: 'Critical CVSS', level: 'critical' })
      }
      if (entity.epss_score > 0.5) {
        indicators.push({ label: 'High EPSS', level: 'critical' })
      } else if (entity.epss_score > 0.1) {
        indicators.push({ label: 'Elevated EPSS', level: 'high' })
      }
      if (entity.exploit_maturity === 'weaponized' || entity.exploit_maturity === 'high') {
        indicators.push({ label: 'Weaponized Exploit', level: 'critical' })
      }
      break

    case 'ioc':
      if (entity.confidence >= 90) {
        indicators.push({ label: 'High Confidence', level: 'high' })
      }
      if (entity.malware_family) {
        indicators.push({ label: 'Malware Linked', level: 'high' })
      }
      break

    case 'incident':
      if (entity.threat_actor?.trend_status === 'ESCALATING') {
        indicators.push({ label: 'Escalating Actor', level: 'critical' })
      }
      break
  }

  if (indicators.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {indicators.map((ind, i) => (
        <span
          key={i}
          className={`px-2 py-0.5 text-xs rounded font-medium ${
            ind.level === 'critical' ? 'bg-red-500/20 text-red-400' :
            ind.level === 'high' ? 'bg-orange-500/20 text-orange-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {ind.label}
        </span>
      ))}
    </div>
  )
}

// Main EntityThreatSummary Component
export default function EntityThreatSummary({
  entityType,
  entity,
  additionalData = {},
  showRecommendations = true,
  showRiskIndicators = true,
  compact = false,
  onSummaryGenerated,
}) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadSummary = useCallback(async () => {
    if (!entity) return

    setLoading(true)
    setError(null)

    try {
      const result = await generateSummary(entityType, entity, additionalData)
      setSummary(result)
      onSummaryGenerated?.(result)
    } catch (err) {
      setError(err.message)
      setSummary('')
    } finally {
      setLoading(false)
    }
  }, [entityType, entity, additionalData, onSummaryGenerated])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const recommendations = showRecommendations ? generateRecommendations(entityType, entity) : []

  if (compact) {
    return (
      <div className="text-sm text-gray-300">
        {loading ? (
          <span className="text-gray-500 animate-pulse">Generating summary...</span>
        ) : error ? (
          <span className="text-red-400">{error}</span>
        ) : (
          summary
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-white">Threat Summary</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSummary}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Regenerate summary"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {summary && (
            <button
              onClick={copyToClipboard}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Risk indicators */}
      {showRiskIndicators && <RiskIndicators entityType={entityType} entity={entity} />}

      {/* Summary content */}
      <div className="p-3 bg-gray-800/50 rounded border border-gray-700">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating threat summary...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LightBulbIcon className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Recommendations
            </span>
          </div>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <ShieldExclamationIcon className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export { generateSummary, generateTemplateSummary, generateRecommendations }
