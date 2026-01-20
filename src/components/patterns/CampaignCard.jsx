/**
 * Campaign Card Component
 *
 * Displays a detected campaign pattern with associated incidents,
 * actors, sectors, and techniques.
 */

import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

const STATUS_COLORS = {
  active: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspected: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  concluded: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const CONFIDENCE_COLORS = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-gray-500/20 text-gray-400',
}

function getConfidenceLevel(confidence) {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.4) return 'medium'
  return 'low'
}

function StatusBadge({ status }) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.suspected
  return <span className={`px-2 py-0.5 text-xs rounded border ${colorClass}`}>{status}</span>
}

function ConfidenceBadge({ confidence }) {
  const level = getConfidenceLevel(confidence)
  const colorClass = CONFIDENCE_COLORS[level]
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${colorClass}`}>
      {Math.round(confidence * 100)}% confidence
    </span>
  )
}

export function CampaignCard({ campaign, onSelect, isSelected }) {
  const {
    actorName,
    actorId,
    incidentCount,
    sectors = [],
    techniques = [],
    startTime,
    endTime,
    confidence = 0.5,
    status = 'suspected',
    description,
  } = campaign

  const duration =
    startTime && endTime
      ? Math.ceil((new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60 * 24))
      : null

  return (
    <div
      onClick={() => onSelect && onSelect(campaign)}
      className={clsx(
        'cyber-card cursor-pointer transition-all',
        isSelected ? 'border-cyber-accent/50 ring-1 ring-cyber-accent/30' : 'hover:border-gray-600'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h3 className="text-white font-medium">
              {actorName ? `${actorName} Campaign` : 'Detected Campaign'}
            </h3>
          </div>
          {description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <ConfidenceBadge confidence={confidence} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center p-2 bg-gray-800/50 rounded">
          <div className="text-xl font-bold text-white">{incidentCount || 0}</div>
          <div className="text-xs text-gray-500">Incidents</div>
        </div>
        <div className="text-center p-2 bg-gray-800/50 rounded">
          <div className="text-xl font-bold text-white">{sectors.length}</div>
          <div className="text-xs text-gray-500">Sectors</div>
        </div>
        <div className="text-center p-2 bg-gray-800/50 rounded">
          <div className="text-xl font-bold text-white">{duration || '?'}</div>
          <div className="text-xs text-gray-500">Days</div>
        </div>
      </div>

      {/* Sectors */}
      {sectors.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Targeted Sectors</div>
          <div className="flex flex-wrap gap-1">
            {sectors.slice(0, 4).map((sector, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
                {sector}
              </span>
            ))}
            {sectors.length > 4 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">+{sectors.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Techniques */}
      {techniques.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Techniques</div>
          <div className="flex flex-wrap gap-1">
            {techniques.slice(0, 5).map((tech, i) => (
              <Link
                key={i}
                to={`/techniques?search=${encodeURIComponent(tech)}`}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-0.5 bg-orange-900/30 text-orange-400 text-xs rounded font-mono hover:bg-orange-900/50"
              >
                {tech}
              </Link>
            ))}
            {techniques.length > 5 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">
                +{techniques.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {startTime && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
          <span>Started: {new Date(startTime).toLocaleDateString()}</span>
          {endTime && <span>Last seen: {new Date(endTime).toLocaleDateString()}</span>}
        </div>
      )}

      {/* Actor Link */}
      {actorId && (
        <Link
          to={`/actors?search=${encodeURIComponent(actorName || actorId)}`}
          onClick={(e) => e.stopPropagation()}
          className="block text-center mt-3 py-2 bg-red-900/20 text-red-400 rounded text-sm hover:bg-red-900/30"
        >
          View Actor Profile →
        </Link>
      )}
    </div>
  )
}

// Compact version for lists
export function CampaignCardCompact({ campaign, onClick }) {
  const { actorName, incidentCount, sectors = [], confidence = 0.5 } = campaign

  return (
    <div
      onClick={() => onClick && onClick(campaign)}
      className="flex items-center gap-4 p-3 bg-gray-800/50 rounded hover:bg-gray-800 cursor-pointer transition-colors"
    >
      <span className="text-lg">🎯</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{actorName || 'Unknown'} Campaign</div>
        <div className="text-xs text-gray-500">
          {incidentCount} incidents • {sectors.slice(0, 2).join(', ')}
          {sectors.length > 2 && ` +${sectors.length - 2}`}
        </div>
      </div>
      <ConfidenceBadge confidence={confidence} />
    </div>
  )
}

export default CampaignCard
