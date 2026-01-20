/**
 * TrendChart Component
 *
 * Overlay chart showing comparison between two time periods.
 */
import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export function TrendChart({
  currentData = [],
  previousData = [],
  currentLabel = 'Current Period',
  previousLabel = 'Previous Period',
  loading = false,
  height = 300,
}) {
  // Merge data for overlay chart
  const chartData = useMemo(() => {
    const maxLength = Math.max(currentData.length, previousData.length)
    const data = []

    for (let i = 0; i < maxLength; i++) {
      data.push({
        day: i + 1,
        current: currentData[i]?.value || 0,
        previous: previousData[i]?.value || 0,
        currentLabel: currentData[i]?.label || `Day ${i + 1}`,
        previousLabel: previousData[i]?.label || `Day ${i + 1}`,
      })
    }

    return data
  }, [currentData, previousData])

  if (loading) {
    return (
      <div className="cyber-card p-4" style={{ height }}>
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-full bg-gray-800/50 rounded animate-pulse"></div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    return (
      <div className="bg-cyber-dark border border-gray-700 rounded-lg p-3 shadow-xl">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="text-gray-400">{entry.name}:</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="cyber-card p-4" style={{ height }}>
      <h3 className="text-sm font-medium text-gray-300 mb-4">Activity Trend Comparison</h3>

      <ResponsiveContainer width="100%" height={height - 60}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="previousGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          <XAxis
            dataKey="day"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(day) => `Day ${day}`}
          />

          <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span className="text-gray-400">{value}</span>}
          />

          <Area
            type="monotone"
            dataKey="previous"
            name={previousLabel}
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="url(#previousGradient)"
          />

          <Area
            type="monotone"
            dataKey="current"
            name={currentLabel}
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#currentGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TrendChart
