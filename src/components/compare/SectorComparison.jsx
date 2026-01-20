/**
 * SectorComparison Component
 *
 * Compares user's sector against all sectors or a specific sector.
 */
import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const SECTOR_COLORS = {
  healthcare: '#ef4444',
  finance: '#f59e0b',
  technology: '#3b82f6',
  government: '#8b5cf6',
  education: '#10b981',
  retail: '#ec4899',
  manufacturing: '#6366f1',
  energy: '#f97316',
  other: '#6b7280',
}

export function SectorComparison({ userSector, sectorData = [], loading = false, height = 300 }) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!sectorData.length) return []

    const sorted = [...sectorData].sort((a, b) => b.value - a.value)
    const total = sorted.reduce((sum, s) => sum + s.value, 0)

    return sorted.slice(0, 8).map((sector) => ({
      ...sector,
      percentage: total > 0 ? ((sector.value / total) * 100).toFixed(1) : 0,
      isUserSector: sector.name?.toLowerCase() === userSector?.toLowerCase(),
    }))
  }, [sectorData, userSector])

  // Find user's sector stats
  const userSectorStats = useMemo(() => {
    const sector = chartData.find((s) => s.isUserSector)
    if (!sector) return null

    const rank = chartData.findIndex((s) => s.isUserSector) + 1
    return { ...sector, rank }
  }, [chartData])

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

    const data = payload[0].payload
    return (
      <div className="bg-cyber-dark border border-gray-700 rounded-lg p-3 shadow-xl">
        <div className="font-medium text-white capitalize">{data.name}</div>
        <div className="text-sm text-gray-400 mt-1">
          {data.value} incidents ({data.percentage}%)
        </div>
        {data.isUserSector && <div className="text-xs text-cyan-400 mt-1">Your sector</div>}
      </div>
    )
  }

  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Sector Comparison</h3>
        {userSectorStats && (
          <span className="text-xs text-gray-500">
            Your sector: <span className="text-cyan-400 capitalize">{userSector}</span> (Rank #
            {userSectorStats.rank})
          </span>
        )}
      </div>

      {/* User sector highlight */}
      {userSectorStats && (
        <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Your Sector</div>
              <div className="text-lg font-semibold text-white capitalize">{userSector}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-400">{userSectorStats.value}</div>
              <div className="text-xs text-gray-500">incidents ({userSectorStats.percentage}%)</div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - (userSectorStats ? 140 : 60)}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />

          <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />

          <YAxis
            type="category"
            dataKey="name"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={100}
            tickFormatter={(name) => name.charAt(0).toUpperCase() + name.slice(1)}
          />

          <Tooltip content={<CustomTooltip />} />

          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.isUserSector ? '#06b6d4' : SECTOR_COLORS[entry.name] || SECTOR_COLORS.other
                }
                opacity={entry.isUserSector ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SectorComparison
