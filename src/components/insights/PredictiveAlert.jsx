/**
 * PredictiveAlert Component
 *
 * Displays a predictive intelligence alert.
 */
import { Link } from 'react-router-dom'

const RISK_STYLES = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/50',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400',
    icon: 'text-red-400',
  },
  high: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-400',
    icon: 'text-orange-400',
  },
  medium: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-400',
    icon: 'text-yellow-400',
  },
  low: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/50',
    text: 'text-gray-400',
    badge: 'bg-gray-500/20 text-gray-400',
    icon: 'text-gray-400',
  },
}

const TYPE_ICONS = {
  actor_escalation: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  sector_targeting: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  vuln_exploitation: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
}

const TYPE_LABELS = {
  actor_escalation: 'Actor Escalation',
  sector_targeting: 'Sector Targeting',
  vuln_exploitation: 'Exploitation Risk',
}

export function PredictiveAlert({
  type,
  entity,
  entityId,
  risk,
  message,
  confidence,
  isSeasonalPeak,
  score,
  compact = false,
}) {
  const styles = RISK_STYLES[risk] || RISK_STYLES.low
  const icon = TYPE_ICONS[type]
  const label = TYPE_LABELS[type] || type

  // Determine link
  const link = type === 'actor_escalation'
    ? `/actors?search=${encodeURIComponent(entity)}`
    : type === 'vuln_exploitation'
    ? `/vulnerabilities?search=${encodeURIComponent(entity)}`
    : null

  const content = (
    <div className={`
      p-3 rounded-lg border transition-all
      ${styles.bg} ${styles.border}
      ${link ? 'hover:bg-opacity-20 cursor-pointer' : ''}
      ${compact ? 'flex items-center gap-3' : ''}
    `}>
      {/* Icon */}
      <div className={`flex-shrink-0 ${styles.icon}`}>
        {icon}
      </div>

      {/* Content */}
      <div className={compact ? 'flex-1 min-w-0' : 'mt-2'}>
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
            {risk.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">{label}</span>
          {isSeasonalPeak && (
            <span className="text-xs text-cyan-400">Seasonal peak</span>
          )}
        </div>

        {/* Entity */}
        <div className="font-medium text-white mt-1">
          {entity}
        </div>

        {/* Message */}
        {message && (
          <p className="text-sm text-gray-400 mt-1">{message}</p>
        )}

        {/* Meta */}
        {(confidence || score) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {confidence && <span>Confidence: {confidence}%</span>}
            {score && <span>Risk score: {score}</span>}
          </div>
        )}
      </div>

      {/* Arrow for links */}
      {link && !compact && (
        <div className="mt-2 flex justify-end">
          <span className={`text-sm ${styles.text}`}>View details →</span>
        </div>
      )}
    </div>
  )

  if (link) {
    return <Link to={link}>{content}</Link>
  }

  return content
}

export default PredictiveAlert
