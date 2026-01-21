/**
 * Temporal Cluster Chart Component
 *
 * Visualizes temporal patterns and activity clusters in threat data:
 * - Activity bursts over time
 * - Cluster groupings by actor/sector
 * - Trend lines and anomaly markers
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
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import { clsx } from 'clsx'

const CLUSTER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
      <div className="text-sm text-gray-400 mb-2">{formatDate(label)}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function ClusterLegend({ clusters }) {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {clusters.map((cluster, i) => (
        <div key={cluster.id || i} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
          />
          <span className="text-sm text-gray-400">{cluster.label}</span>
          {cluster.count && <span className="text-xs text-gray-500">({cluster.count})</span>}
        </div>
      ))}
    </div>
  )
}

function _AnomalyMarker({ x, y, anomaly }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={6}
        fill={anomaly.type === 'spike' ? '#ef4444' : '#3b82f6'}
        stroke="#fff"
        strokeWidth={2}
      />
      <title>{anomaly.description || `${anomaly.type} detected`}</title>
    </g>
  )
}

export function TemporalClusterChart({
  data,
  clusters = [],
  anomalies = [],
  showLegend = true,
  height = 300,
  onClusterClick,
}) {
  // Transform data for stacked area chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Group by date
    const byDate = new Map()

    for (const item of data) {
      const date =
        item.date || item.discovered_date?.split('T')[0] || item.discovered_at?.split('T')[0]
      if (!date) continue

      if (!byDate.has(date)) {
        byDate.set(date, { date })
      }

      const entry = byDate.get(date)
      const clusterId = item.cluster_id || item.actor_name || 'other'
      entry[clusterId] = (entry[clusterId] || 0) + (item.count || 1)
    }

    return Array.from(byDate.values()).sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [data])

  // Get unique cluster IDs from data
  const clusterIds = useMemo(() => {
    if (clusters.length > 0) {
      return clusters.map((c) => c.id || c.label)
    }

    const ids = new Set()
    for (const item of data || []) {
      const id = item.cluster_id || item.actor_name || 'other'
      ids.add(id)
    }
    return Array.from(ids).slice(0, 8) // Limit to 8 clusters
  }, [data, clusters])

  // Calculate average for reference line
  const average = useMemo(() => {
    if (chartData.length === 0) return 0

    let total = 0
    for (const point of chartData) {
      for (const id of clusterIds) {
        total += point[id] || 0
      }
    }
    return Math.round(total / chartData.length)
  }, [chartData, clusterIds])

  // Find anomaly positions
  const anomalyDates = useMemo(() => {
    return new Set(anomalies.map((a) => a.date?.split('T')[0]))
  }, [anomalies])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No temporal data available
      </div>
    )
  }

  // Generate cluster objects if not provided
  const displayClusters =
    clusters.length > 0
      ? clusters
      : clusterIds.map((id, i) => ({
          id,
          label: id,
          color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        }))

  return (
    <div>
      {showLegend && <ClusterLegend clusters={displayClusters} />}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {clusterIds.map((id, i) => (
              <linearGradient key={id} id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                  stopOpacity={0.05}
                />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
          />

          <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />

          <Tooltip content={<CustomTooltip />} />

          {/* Average reference line */}
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{
                value: `Avg: ${average}`,
                position: 'right',
                fill: '#9ca3af',
                fontSize: 11,
              }}
            />
          )}

          {/* Highlight anomaly dates */}
          {chartData
            .filter((d) => anomalyDates.has(d.date))
            .map((d, i) => {
              const idx = chartData.findIndex((c) => c.date === d.date)
              if (idx < 0) return null
              return (
                <ReferenceArea
                  key={i}
                  x1={d.date}
                  x2={d.date}
                  fill="#ef4444"
                  fillOpacity={0.1}
                  stroke="#ef4444"
                  strokeOpacity={0.3}
                />
              )
            })}

          {/* Stacked areas for each cluster */}
          {clusterIds.map((id, i) => (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              name={displayClusters[i]?.label || id}
              stackId="1"
              stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
              fill={`url(#gradient-${id})`}
              strokeWidth={2}
              onClick={() => onClusterClick && onClusterClick(id)}
              style={{ cursor: onClusterClick ? 'pointer' : 'default' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Compact version for dashboards
export function TemporalClusterMini({ data, clusters = [], height = 120 }) {
  return <TemporalClusterChart data={data} clusters={clusters} showLegend={false} height={height} />
}

// Cluster summary card
export function ClusterSummaryCard({ cluster, onClick }) {
  const {
    id: _id,
    label,
    count = 0,
    actorCount = 0,
    dateRange,
    intensity = 'medium',
    color,
  } = cluster

  const intensityColors = {
    high: 'border-red-500/30 bg-red-500/10',
    medium: 'border-yellow-500/30 bg-yellow-500/10',
    low: 'border-blue-500/30 bg-blue-500/10',
  }

  return (
    <div
      onClick={() => onClick && onClick(cluster)}
      className={clsx(
        'p-4 rounded-lg border cursor-pointer transition-all hover:opacity-80',
        intensityColors[intensity] || intensityColors.medium
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color || CLUSTER_COLORS[0] }}
        />
        <h4 className="text-white font-medium">{label}</h4>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-2xl font-bold text-white">{count}</div>
          <div className="text-xs text-gray-500">Incidents</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{actorCount}</div>
          <div className="text-xs text-gray-500">Actors</div>
        </div>
      </div>

      {dateRange && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
          {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
        </div>
      )}
    </div>
  )
}

// List of cluster summary cards
export function ClusterSummaryList({ clusters, onClusterClick }) {
  if (!clusters || clusters.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">No activity clusters detected</div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clusters.map((cluster, i) => (
        <ClusterSummaryCard
          key={cluster.id || i}
          cluster={{ ...cluster, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
          onClick={onClusterClick}
        />
      ))}
    </div>
  )
}

export default TemporalClusterChart
