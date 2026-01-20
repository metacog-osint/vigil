/**
 * RegionComparison Component
 *
 * Compares user's region against global or specific regions.
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const REGION_COLORS = {
  north_america: '#3b82f6',
  europe: '#10b981',
  asia_pacific: '#f59e0b',
  latin_america: '#8b5cf6',
  middle_east: '#ef4444',
  africa: '#ec4899',
  global: '#6b7280',
}

const REGION_LABELS = {
  north_america: 'North America',
  europe: 'Europe',
  asia_pacific: 'Asia Pacific',
  latin_america: 'Latin America',
  middle_east: 'Middle East',
  africa: 'Africa',
  global: 'Global',
}

export function RegionComparison({ userRegion, regionData = [], loading = false }) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!regionData.length) return []

    const total = regionData.reduce((sum, r) => sum + r.value, 0)

    return regionData.map((region) => ({
      ...region,
      label: REGION_LABELS[region.name] || region.name,
      percentage: total > 0 ? ((region.value / total) * 100).toFixed(1) : 0,
      isUserRegion: region.name === userRegion,
      color: REGION_COLORS[region.name] || '#6b7280',
    }))
  }, [regionData, userRegion])

  // Find user's region stats
  const userRegionStats = useMemo(() => {
    return chartData.find((r) => r.isUserRegion) || null
  }, [chartData])

  // Calculate global vs user region comparison
  const comparison = useMemo(() => {
    if (!userRegionStats) return null

    const total = chartData.reduce((sum, r) => sum + r.value, 0)
    const otherRegions = total - userRegionStats.value
    const avgOther = otherRegions / (chartData.length - 1 || 1)

    const diff = userRegionStats.value - avgOther
    const percentDiff = avgOther > 0 ? ((diff / avgOther) * 100).toFixed(0) : 0

    return {
      isAboveAverage: diff > 0,
      percentDiff: Math.abs(percentDiff),
      avgOther: Math.round(avgOther),
    }
  }, [chartData, userRegionStats])

  if (loading) {
    return (
      <div className="cyber-card p-4">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-64 bg-gray-800/50 rounded animate-pulse"></div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-cyber-dark border border-gray-700 rounded-lg p-3 shadow-xl">
        <div className="font-medium text-white">{data.label}</div>
        <div className="text-sm text-gray-400 mt-1">
          {data.value} incidents ({data.percentage}%)
        </div>
        {data.isUserRegion && <div className="text-xs text-cyan-400 mt-1">Your region</div>}
      </div>
    )
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }) => {
    if (!payload.isUserRegion) return null

    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {payload.percentage}%
      </text>
    )
  }

  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Regional Distribution</h3>
        {userRegion && (
          <span className="text-xs text-gray-500">
            Your region:{' '}
            <span className="text-cyan-400">{REGION_LABELS[userRegion] || userRegion}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.isUserRegion ? '#06b6d4' : entry.color}
                    stroke={entry.isUserRegion ? '#0891b2' : 'transparent'}
                    strokeWidth={entry.isUserRegion ? 3 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats & Legend */}
        <div className="space-y-4">
          {/* User region highlight */}
          {userRegionStats && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                {REGION_LABELS[userRegion] || userRegion}
              </div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">{userRegionStats.value}</div>
              <div className="text-xs text-gray-400">
                {userRegionStats.percentage}% of global incidents
              </div>

              {comparison && (
                <div
                  className={`
                  mt-2 text-xs
                  ${comparison.isAboveAverage ? 'text-red-400' : 'text-green-400'}
                `}
                >
                  {comparison.isAboveAverage ? '↑' : '↓'} {comparison.percentDiff}%
                  {comparison.isAboveAverage ? ' above' : ' below'} average
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="space-y-2">
            {chartData.map((region, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: region.isUserRegion ? '#06b6d4' : region.color }}
                  ></span>
                  <span
                    className={region.isUserRegion ? 'text-white font-medium' : 'text-gray-400'}
                  >
                    {region.label}
                  </span>
                </div>
                <span className={region.isUserRegion ? 'text-cyan-400' : 'text-gray-500'}>
                  {region.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegionComparison
