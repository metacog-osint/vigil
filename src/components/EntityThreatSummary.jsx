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
import { generateEntitySummary } from '../lib/ai'

// Generate summary via the server-side AI endpoint (keeps the API key off the client)
async function generateSummary(entityType, entity, additionalData = {}) {
  const summary = await generateEntitySummary(entityType, entity, additionalData.incidents || [])
  return summary || generateTemplateSummary(entityType, entity, additionalData)
}

// Template-based fallback summary
function generateTemplateSummary(entityType, entity, _additionalData = {}) {
  switch (entityType) {
    case 'actor': {
      const trend =
        entity.trend_status === 'ESCALATING'
          ? 'increasing activity'
          : entity.trend_status === 'DECLINING'
            ? 'decreasing activity'
            : 'stable activity'
      const sectors = entity.target_sectors?.slice(0, 3).join(', ') || 'various sectors'
      return `${entity.name} is showing ${trend} with ${entity.incidents_7d || 0} incidents in the past week. Primary targets include ${sectors}. ${
        entity.trend_status === 'ESCALATING'
          ? 'Elevated monitoring recommended.'
          : 'Standard monitoring advised.'
      }`
    }
    case 'vulnerability': {
      const risk =
        entity.cvss_score >= 9 ? 'critical' : entity.cvss_score >= 7 ? 'high' : 'moderate'
      const kevNote = entity.kev_date ? ' Listed in CISA KEV, indicating active exploitation.' : ''
      return `${entity.cve_id} is a ${risk} severity vulnerability (CVSS ${entity.cvss_score}).${kevNote} Affects ${entity.vendor || 'multiple vendors'}. ${
        entity.epss_score > 0.1
          ? 'High exploitation probability - prioritize patching.'
          : 'Standard remediation timeline appropriate.'
      }`
    }
    case 'ioc': {
      const conf =
        entity.confidence >= 80
          ? 'high confidence'
          : entity.confidence >= 50
            ? 'medium confidence'
            : 'low confidence'
      return `${entity.type.toUpperCase()} indicator with ${conf} from ${entity.source || 'open source'}. ${
        entity.malware_family ? `Associated with ${entity.malware_family} malware family.` : ''
      } First observed ${entity.first_seen ? new Date(entity.first_seen).toLocaleDateString() : 'recently'}.`
    }
    case 'incident': {
      return `${entity.victim_name} (${entity.victim_sector || 'Unknown sector'}) was targeted by ${entity.threat_actor?.name || 'unknown actor'}. ${
        entity.threat_actor?.trend_status === 'ESCALATING'
          ? 'Actor showing increased activity.'
          : ''
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
            ind.level === 'critical'
              ? 'bg-red-500/20 text-red-400'
              : ind.level === 'high'
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-yellow-500/20 text-yellow-400'
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
