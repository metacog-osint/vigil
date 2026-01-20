import { memo } from 'react'
import { clsx } from 'clsx'

const StatCard = memo(function StatCard({ label, value, trend, trendLabel, icon }) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-red-400'
      case 'down':
        return 'text-green-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="cyber-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-gray-400 mt-1">{label}</div>
          {trendLabel && (
            <div className={clsx('text-xs mt-1', getTrendColor())}>
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendLabel}
            </div>
          )}
        </div>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
    </div>
  )
})

export default StatCard
