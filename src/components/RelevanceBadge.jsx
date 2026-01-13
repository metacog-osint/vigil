// Relevance Badge - Shows relevance score with tooltip explanation
import { useState } from 'react'
import { clsx } from 'clsx'

function getScoreColor(score) {
  if (score >= 80) return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (score >= 60) return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
  if (score >= 20) return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
  return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
}

function getScoreLabel(score) {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  if (score >= 20) return 'Low'
  return 'Minimal'
}

export function RelevanceBadge({ score, reasons = [], size = 'md', showLabel = true }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (score === null || score === undefined) {
    return null
  }

  const colorClass = getScoreColor(score)
  const label = getScoreLabel(score)

  return (
    <div className="relative inline-block">
      <div
        className={clsx(
          'flex items-center gap-1 rounded border cursor-help transition-colors',
          colorClass,
          size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="font-medium">{score}</span>
        {showLabel && <span className="opacity-75">({label})</span>}
      </div>

      {/* Tooltip */}
      {showTooltip && reasons.length > 0 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
            <div className="text-xs font-medium text-white mb-2">Relevance Factors</div>
            <div className="space-y-1">
              {reasons.map((reason, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{reason.factor}</span>
                  <span className={clsx(
                    'font-medium',
                    reason.points > 0 ? 'text-green-400' : 'text-gray-500'
                  )}>
                    {reason.points > 0 ? `+${reason.points}` : reason.points}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs">
              <span className="text-gray-400">Total Score</span>
              <span className="font-bold text-white">{score}/100</span>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-gray-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for table rows
export function RelevanceIndicator({ score }) {
  if (score === null || score === undefined) return null

  const colorClass = getScoreColor(score)

  return (
    <div
      className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
        colorClass
      )}
      title={`Relevance: ${score} (${getScoreLabel(score)})`}
    >
      {score}
    </div>
  )
}

// For use in cards/panels
export function RelevancePanel({ score, reasons = [], entityType = 'threat' }) {
  if (score === null || score === undefined) {
    return (
      <div className="bg-gray-800/30 rounded p-3 text-center">
        <div className="text-xs text-gray-500">
          Set up your organization profile to see relevance scores
        </div>
      </div>
    )
  }

  const colorClass = getScoreColor(score)
  const label = getScoreLabel(score)

  return (
    <div className={clsx('rounded border p-3', colorClass)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs opacity-75">Relevance to You</span>
        <span className="font-bold">{score}/100</span>
      </div>
      <div className="text-sm font-medium mb-2">{label} Relevance</div>
      {reasons.length > 0 && (
        <div className="space-y-1 text-xs">
          {reasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="flex items-center gap-1 opacity-75">
              <span>+{reason.points}</span>
              <span>{reason.factor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RelevanceBadge
