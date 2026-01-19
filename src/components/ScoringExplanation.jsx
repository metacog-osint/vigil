/**
 * ScoringExplanation Component
 * Visual breakdown of threat scoring factors
 */

import { useState } from 'react'
import {
  ChartBarIcon,
  InformationCircleIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

// Score level configuration
const SCORE_LEVELS = {
  critical: { min: 75, color: 'red', label: 'Critical' },
  high: { min: 50, color: 'orange', label: 'High' },
  medium: { min: 25, color: 'yellow', label: 'Medium' },
  low: { min: 0, color: 'green', label: 'Low' },
}

// Factor display names
const FACTOR_LABELS = {
  incident_velocity: 'Attack Velocity',
  incidents_7d: 'Recent Incidents (7d)',
  trend_status: 'Trend Status',
  sector_relevance: 'Sector Relevance',
  geographic_relevance: 'Geographic Relevance',
  historical_impact: 'Historical Impact',
  cvss_score: 'CVSS Score',
  epss_score: 'EPSS Score',
  kev_status: 'KEV Status',
  exploit_maturity: 'Exploit Maturity',
  vendor_relevance: 'Vendor Match',
  recency: 'Recency',
  confidence: 'Confidence Level',
  source_reputation: 'Source Reputation',
  age: 'IOC Age',
  correlation_count: 'Correlations',
  enrichment_signals: 'Enrichment Data',
  actor_severity: 'Actor Severity',
  sector_match: 'Sector Match',
  geographic_match: 'Geographic Match',
  data_impact: 'Data Impact',
}

// Factor descriptions
const FACTOR_DESCRIPTIONS = {
  incident_velocity: 'Number of incidents per day attributed to this actor',
  incidents_7d: 'Total incidents in the past 7 days',
  trend_status: 'Whether activity is escalating, stable, or declining',
  sector_relevance: 'Match with your organization\'s sector profile',
  geographic_relevance: 'Match with your organization\'s geographic region',
  cvss_score: 'Common Vulnerability Scoring System score (0-10)',
  epss_score: 'Exploit Prediction Scoring System probability',
  kev_status: 'Listed in CISA Known Exploited Vulnerabilities catalog',
  exploit_maturity: 'Availability and reliability of exploit code',
  vendor_relevance: 'Match with vendors in your technology stack',
  recency: 'How recently this was discovered or published',
  confidence: 'Source confidence in this indicator',
  source_reputation: 'Reliability of the reporting source',
  age: 'Time since first observation (newer = more relevant)',
  correlation_count: 'Number of related threat indicators',
  enrichment_signals: 'Additional context from enrichment sources',
}

// Get color classes for a score
function getScoreColors(score) {
  if (score >= 75) return { bg: 'bg-red-500', text: 'text-red-400', bar: 'bg-red-500' }
  if (score >= 50) return { bg: 'bg-orange-500', text: 'text-orange-400', bar: 'bg-orange-500' }
  if (score >= 25) return { bg: 'bg-yellow-500', text: 'text-yellow-400', bar: 'bg-yellow-500' }
  return { bg: 'bg-green-500', text: 'text-green-400', bar: 'bg-green-500' }
}

// Score Gauge Component
function ScoreGauge({ score, size = 'medium' }) {
  const colors = getScoreColors(score)
  const radius = size === 'small' ? 30 : size === 'large' ? 60 : 45
  const strokeWidth = size === 'small' ? 6 : size === 'large' ? 10 : 8
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const center = radius + strokeWidth

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={center * 2}
        height={center * 2}
        viewBox={`0 0 ${center * 2} ${center * 2}`}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={colors.text}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === 'small' ? 'text-lg' : size === 'large' ? 'text-3xl' : 'text-2xl'} font-bold ${colors.text}`}>
          {score}
        </span>
      </div>
    </div>
  )
}

// Factor Bar Component
function FactorBar({ factor, score, weight, showWeight = false }) {
  const colors = getScoreColors(score)
  const label = FACTOR_LABELS[factor] || factor
  const description = FACTOR_DESCRIPTIONS[factor]
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-300">{label}</span>
          {description && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-gray-500 hover:text-gray-400"
              >
                <InformationCircleIcon className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute z-10 left-0 top-5 w-48 p-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 shadow-lg">
                  {description}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={colors.text}>{Math.round(score)}</span>
          {showWeight && (
            <span className="text-gray-500 text-xs">({Math.round(weight)}%)</span>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all duration-300`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// Contribution Chart Component
function ContributionChart({ factors }) {
  const sortedFactors = [...factors].sort((a, b) => (b.score * b.weight) - (a.score * a.weight))

  return (
    <div className="space-y-3">
      {sortedFactors.map((f, _i) => (
        <FactorBar
          key={f.factor}
          factor={f.factor}
          score={f.score}
          weight={f.weight}
          showWeight={true}
        />
      ))}
    </div>
  )
}

// Score Breakdown Card
function ScoreBreakdownCard({ title, score, factors, isOpen, onToggle }) {
  const colors = getScoreColors(score)
  const level = score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low'

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${colors.bg}/20 flex items-center justify-center`}>
            <span className={`text-lg font-bold ${colors.text}`}>{score}</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">{title}</div>
            <div className={`text-xs ${colors.text}`}>{level} Risk</div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 bg-gray-900/50 border-t border-gray-700">
          <ContributionChart factors={factors} />
        </div>
      )}
    </div>
  )
}

// Weight Editor Component
function WeightEditor({ weights, onChange }) {
  const handleWeightChange = (key, value) => {
    onChange({ ...weights, [key]: Math.max(0, Math.min(100, parseInt(value) || 0)) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <AdjustmentsHorizontalIcon className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Customize Weights</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 flex-1 truncate">
              {FACTOR_LABELS[key] || key}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleWeightChange(key, e.target.value)}
              className="cyber-input w-16 text-xs text-center"
              min="0"
              max="100"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Weights are automatically normalized to sum to 100%.
      </p>
    </div>
  )
}

// Main ScoringExplanation Component
export default function ScoringExplanation({
  score,
  level,
  factors = [],
  weights = {},
  entityType: _entityType,
  showGauge = true,
  showFactors = true,
  showWeightEditor = false,
  onWeightsChange,
  compact = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const colors = getScoreColors(score)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`px-2 py-1 rounded ${colors.bg}/20 ${colors.text} text-sm font-bold`}>
          {score}
        </div>
        <span className={`text-xs ${colors.text}`}>{level}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with gauge */}
      {showGauge && (
        <div className="flex items-center gap-4">
          <ScoreGauge score={score} size="medium" />
          <div>
            <div className="text-lg font-bold text-white">
              Threat Score: <span className={colors.text}>{score}</span>
            </div>
            <div className={`text-sm ${colors.text}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)} Risk Level
            </div>
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      {showFactors && factors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Score Breakdown</span>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isExpanded ? (
            <ContributionChart factors={factors} />
          ) : (
            <div className="space-y-2">
              {factors.slice(0, 3).map((f) => (
                <FactorBar
                  key={f.factor}
                  factor={f.factor}
                  score={f.score}
                  weight={f.weight}
                />
              ))}
              {factors.length > 3 && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  +{factors.length - 3} more factors
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weight editor */}
      {showWeightEditor && onWeightsChange && (
        <div className="border-t border-gray-700 pt-4">
          <WeightEditor weights={weights} onChange={onWeightsChange} />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Critical (75-100)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          High (50-74)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          Medium (25-49)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Low (0-24)
        </div>
      </div>
    </div>
  )
}

export {
  ScoreGauge,
  FactorBar,
  ContributionChart,
  ScoreBreakdownCard,
  WeightEditor,
  SCORE_LEVELS,
  FACTOR_LABELS,
  getScoreColors,
}
