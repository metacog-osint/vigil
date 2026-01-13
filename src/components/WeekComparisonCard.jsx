// Week-over-week comparison card
import { clsx } from 'clsx'

function ChangeIndicator({ value, size = 'md' }) {
  if (value === 0 || value === null || value === undefined) {
    return (
      <span className={clsx(
        'text-gray-400',
        size === 'lg' ? 'text-2xl' : 'text-sm'
      )}>
        → 0%
      </span>
    )
  }

  const isPositive = value > 0
  const absValue = Math.abs(value)

  return (
    <span className={clsx(
      'font-semibold',
      isPositive ? 'text-red-400' : 'text-green-400',
      size === 'lg' ? 'text-2xl' : 'text-sm'
    )}>
      {isPositive ? '↑' : '↓'} {absValue}%
    </span>
  )
}

export function WeekComparisonCard({ data, loading }) {
  if (loading) {
    return (
      <div className="cyber-card p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="cyber-card p-6 text-gray-400 text-center">
        No comparison data available
      </div>
    )
  }

  const { currentWeek, previousWeek, incidentChange } = data

  return (
    <div className="cyber-card p-6">
      <h3 className="text-sm text-gray-400 mb-4">Week-over-Week</h3>

      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-white">
            {currentWeek?.incidents_total || 0}
          </div>
          <div className="text-xs text-gray-500">incidents this week</div>
        </div>
        <ChangeIndicator value={incidentChange} size="lg" />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
        <div>
          <div className="text-lg font-semibold text-white">
            {currentWeek?.incidents_total || 0}
          </div>
          <div className="text-xs text-gray-500">This Week</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-400">
            {previousWeek?.incidents_total || 0}
          </div>
          <div className="text-xs text-gray-500">Last Week</div>
        </div>
      </div>

      {incidentChange !== 0 && (
        <div className={clsx(
          'mt-4 p-3 rounded text-sm',
          incidentChange > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
        )}>
          {incidentChange > 0
            ? `Activity increased ${incidentChange}% from last week`
            : `Activity decreased ${Math.abs(incidentChange)}% from last week`
          }
        </div>
      )}
    </div>
  )
}

export default WeekComparisonCard
