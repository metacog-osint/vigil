/**
 * Anomaly Alert Component
 *
 * Displays detected anomalies in threat activity such as:
 * - Unusual activity spikes or drops
 * - Reactivated threat actors
 * - Pattern deviations
 */

import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

const ANOMALY_TYPES = {
  spike: {
    icon: '📈',
    label: 'Activity Spike',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
  drop: {
    icon: '📉',
    label: 'Activity Drop',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
  },
  reactivation: {
    icon: '⚠️',
    label: 'Actor Reactivated',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
  },
  dormancy: {
    icon: '💤',
    label: 'Actor Dormant',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    textColor: 'text-gray-400',
  },
  new_actor: {
    icon: '🆕',
    label: 'New Actor',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
  },
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
}

function getSeverity(zScore, anomalyType) {
  if (anomalyType === 'reactivation') {
    return zScore > 90 ? 'critical' : zScore > 60 ? 'high' : 'medium'
  }
  const absZ = Math.abs(zScore)
  if (absZ >= 4) return 'critical'
  if (absZ >= 3) return 'high'
  if (absZ >= 2) return 'medium'
  return 'low'
}

function SeverityIndicator({ severity }) {
  return <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[severity]}`} />
}

export function AnomalyAlert({ anomaly, onDismiss, onAcknowledge }) {
  const {
    type = 'spike',
    date,
    actualCount,
    expectedCount,
    zScore,
    direction,
    actors = [],
    sectors = [],
    confidence = 0.5,
    description,
    actorName,
    dormantDays,
  } = anomaly

  const anomalyConfig = ANOMALY_TYPES[type] || ANOMALY_TYPES[direction] || ANOMALY_TYPES.spike
  const severity =
    type === 'reactivated_actor'
      ? getSeverity(dormantDays, 'reactivation')
      : getSeverity(zScore || confidence * 4, type)

  return (
    <div
      className={clsx(
        'border rounded-lg p-4 transition-all',
        anomalyConfig.bgColor,
        anomalyConfig.borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{anomalyConfig.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${anomalyConfig.textColor}`}>{anomalyConfig.label}</h4>
              <SeverityIndicator severity={severity} />
            </div>
            {date && (
              <div className="text-xs text-gray-500">{new Date(date).toLocaleDateString()}</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onAcknowledge && (
            <button
              onClick={() => onAcknowledge(anomaly)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Acknowledge"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(anomaly)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {description && <p className="text-sm text-gray-300 mb-3">{description}</p>}

      {/* Stats for activity anomalies */}
      {actualCount !== undefined && expectedCount !== undefined && (
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <div className={`text-2xl font-bold ${anomalyConfig.textColor}`}>{actualCount}</div>
            <div className="text-xs text-gray-500">Actual</div>
          </div>
          <div className="text-gray-600">vs</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{expectedCount}</div>
            <div className="text-xs text-gray-500">Expected</div>
          </div>
          {zScore && (
            <div className="text-center ml-auto">
              <div className={`text-lg font-bold ${anomalyConfig.textColor}`}>
                {zScore > 0 ? '+' : ''}
                {zScore}σ
              </div>
              <div className="text-xs text-gray-500">Z-Score</div>
            </div>
          )}
        </div>
      )}

      {/* Reactivated actor info */}
      {actorName && dormantDays && (
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded mb-3">
          <div>
            <div className="text-sm text-white font-medium">{actorName}</div>
            <div className="text-xs text-gray-500">Dormant for {dormantDays} days</div>
          </div>
          <Link
            to={`/actors?search=${encodeURIComponent(actorName)}`}
            className="text-xs text-cyber-accent hover:underline"
          >
            View Actor →
          </Link>
        </div>
      )}

      {/* Affected actors */}
      {actors.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Involved Actors</div>
          <div className="flex flex-wrap gap-1">
            {actors.slice(0, 5).map((actor, i) => (
              <Link
                key={i}
                to={`/actors?search=${encodeURIComponent(actor)}`}
                className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded hover:bg-red-900/50"
              >
                {actor}
              </Link>
            ))}
            {actors.length > 5 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">+{actors.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Affected sectors */}
      {sectors.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Affected Sectors</div>
          <div className="flex flex-wrap gap-1">
            {sectors.slice(0, 5).map((sector, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
                {sector}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence */}
      {confidence && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-500">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${anomalyConfig.bgColor.replace('/10', '')}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-gray-400">{Math.round(confidence * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact inline alert
export function AnomalyAlertInline({ anomaly, onClick }) {
  const { type = 'spike', direction, description, confidence = 0.5 } = anomaly
  const anomalyConfig = ANOMALY_TYPES[type] || ANOMALY_TYPES[direction] || ANOMALY_TYPES.spike

  return (
    <div
      onClick={() => onClick && onClick(anomaly)}
      className={clsx(
        'flex items-center gap-3 p-2 rounded cursor-pointer transition-colors',
        anomalyConfig.bgColor,
        'hover:opacity-80'
      )}
    >
      <span className="text-lg">{anomalyConfig.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${anomalyConfig.textColor}`}>
          {description || anomalyConfig.label}
        </div>
      </div>
      <span className="text-xs text-gray-500">{Math.round(confidence * 100)}%</span>
    </div>
  )
}

// List of multiple alerts
export function AnomalyAlertList({ anomalies, maxItems = 5, onViewAll }) {
  if (!anomalies || anomalies.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-4">No anomalies detected</div>
  }

  return (
    <div className="space-y-2">
      {anomalies.slice(0, maxItems).map((anomaly, i) => (
        <AnomalyAlertInline key={i} anomaly={anomaly} />
      ))}
      {anomalies.length > maxItems && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full text-center text-xs text-cyber-accent hover:underline py-2"
        >
          View all {anomalies.length} anomalies →
        </button>
      )}
    </div>
  )
}

export default AnomalyAlert
