// Sector breakdown pie/donut chart
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { clsx } from 'clsx'

const SECTOR_COLORS = {
  healthcare: '#ef4444',
  finance: '#f59e0b',
  technology: '#3b82f6',
  manufacturing: '#8b5cf6',
  retail: '#ec4899',
  education: '#10b981',
  energy: '#f97316',
  government: '#6366f1',
  other: '#6b7280',
}

const DEFAULT_COLORS = [
  '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6',
  '#ec4899', '#10b981', '#f97316', '#6366f1',
]

export function SectorChart({
  data = [],
  onSectorClick,
  innerRadius = 60,
  outerRadius = 100,
  className = '',
}) {
  // Transform data if needed
  const chartData = data.map((item, i) => ({
    name: item.sector || item.name,
    value: item.count || item.value,
    color: SECTOR_COLORS[item.sector?.toLowerCase()] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = ((data.value / total) * 100).toFixed(1)
      return (
        <div className="bg-cyber-dark border border-gray-700 rounded px-3 py-2 text-sm">
          <div className="font-medium text-white">{data.name}</div>
          <div className="text-gray-400">
            {data.value} incidents ({percentage}%)
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className={clsx('', className)}>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            onClick={(data) => onSectorClick?.(data.name)}
            style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.slice(0, 8).map((item, i) => (
          <button
            key={i}
            onClick={() => onSectorClick?.(item.name)}
            className="flex items-center gap-2 text-left text-sm hover:bg-gray-800/50 rounded px-2 py-1 transition-colors"
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-300 truncate">{item.name}</span>
            <span className="text-gray-500 ml-auto">{item.value}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SectorBarChart({
  data = [],
  onSectorClick,
  className = '',
}) {
  const maxValue = Math.max(...data.map(d => d.count || d.value), 1)

  return (
    <div className={clsx('space-y-2', className)}>
      {data.slice(0, 8).map((item, i) => {
        const value = item.count || item.value
        const percentage = (value / maxValue) * 100
        const color = SECTOR_COLORS[item.sector?.toLowerCase()] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]

        return (
          <button
            key={i}
            onClick={() => onSectorClick?.(item.sector || item.name)}
            className="w-full text-left hover:bg-gray-800/30 rounded p-1 transition-colors"
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-300">{item.sector || item.name}</span>
              <span className="text-gray-500">{value}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default SectorChart
