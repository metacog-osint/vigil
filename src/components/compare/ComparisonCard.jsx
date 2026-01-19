/**
 * ComparisonCard Component
 *
 * Shows side-by-side comparison of a metric between two time periods.
 */

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num?.toString() || '0'
}

const calculateChange = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function ComparisonCard({
  title,
  currentValue,
  previousValue,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  icon,
  loading = false,
  inverted = false, // If true, lower is better (e.g., incidents)
}) {
  const change = calculateChange(currentValue, previousValue)
  const isIncrease = change > 0
  const isPositive = inverted ? !isIncrease : isIncrease

  if (loading) {
    return (
      <div className="cyber-card p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-gray-700 rounded"></div>
          <div className="h-12 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cyber-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-gray-400">{icon}</span>}
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
      </div>

      {/* Side by side values */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* Current */}
        <div className="text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            {currentLabel}
          </div>
          <div className="text-2xl font-bold text-white">
            {formatNumber(currentValue)}
          </div>
        </div>

        {/* Previous */}
        <div className="text-center p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            {previousLabel}
          </div>
          <div className="text-2xl font-bold text-gray-400">
            {formatNumber(previousValue)}
          </div>
        </div>
      </div>

      {/* Change indicator */}
      <div className="flex items-center justify-center gap-2">
        <div className={`
          flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium
          ${isPositive
            ? 'bg-green-500/20 text-green-400'
            : change === 0
              ? 'bg-gray-500/20 text-gray-400'
              : 'bg-red-500/20 text-red-400'
          }
        `}>
          {change !== 0 && (
            <svg
              className={`w-4 h-4 ${!isIncrease ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          <span>
            {change === 0 ? 'No change' : `${Math.abs(change).toFixed(0)}%`}
          </span>
        </div>

        {change !== 0 && (
          <span className="text-xs text-gray-500">
            {isIncrease ? 'increase' : 'decrease'}
          </span>
        )}
      </div>
    </div>
  )
}

export default ComparisonCard
