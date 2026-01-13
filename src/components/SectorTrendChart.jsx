import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'

const SECTOR_COLORS = ['#00ff88', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308']

/**
 * SectorTrendChart - Multi-line chart showing sector targeting trends over time
 */
export function SectorTrendChart({ data, loading, height = 280, showLegend = true }) {
  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded animate-pulse" style={{ height }} />
    )
  }

  if (!data?.weeks?.length) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        No sector trend data available
      </div>
    )
  }

  // Transform data for recharts
  const chartData = data.weeks.map(week => {
    const point = { week }
    for (const sector of data.sectors.slice(0, 6)) {
      point[sector] = data.data[`${week}|${sector}`] || 0
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <XAxis
          dataKey="week"
          stroke="#6b7280"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
        />
        {showLegend && <Legend />}
        {data.sectors.slice(0, 6).map((sector, i) => (
          <Line
            key={sector}
            type="monotone"
            dataKey={sector}
            stroke={SECTOR_COLORS[i]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * SectorTrendMini - Compact version for Dashboard
 */
export function SectorTrendMini({ data, loading, height = 120 }) {
  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded animate-pulse" style={{ height }} />
    )
  }

  if (!data?.weeks?.length) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height }}>
        No data
      </div>
    )
  }

  // Get top 3 sectors only
  const topSectors = data.sectors.slice(0, 3)
  const chartData = data.weeks.map(week => {
    const point = { week }
    for (const sector of topSectors) {
      point[sector] = data.data[`${week}|${sector}`] || 0
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <XAxis dataKey="week" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '4px',
            fontSize: '11px',
          }}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        {topSectors.map((sector, i) => (
          <Line
            key={sector}
            type="monotone"
            dataKey={sector}
            stroke={SECTOR_COLORS[i]}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * ActivityTrendChart - Area chart showing incident activity over time
 */
export function ActivityTrendChart({ data, loading, height = 200 }) {
  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded animate-pulse" style={{ height }} />
    )
  }

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        No activity data available
      </div>
    )
  }

  // Sort and format for chart
  const chartData = [...data]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(d => ({
      date: d.date,
      count: d.count,
    }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
          formatter={(value) => [value, 'Incidents']}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#00ff88"
          fill="url(#activityGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * ActivityTrendMini - Compact activity chart for Dashboard
 */
export function ActivityTrendMini({ data, loading, height = 80 }) {
  if (loading || !data?.length) {
    return <div className="bg-gray-800/30 rounded animate-pulse" style={{ height }} />
  }

  const chartData = [...data]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(d => ({ date: d.date, count: d.count }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="miniActivityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="count"
          stroke="#00ff88"
          strokeWidth={1.5}
          fill="url(#miniActivityGradient)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '4px',
            fontSize: '11px',
          }}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          formatter={(value) => [value, 'Incidents']}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default SectorTrendChart
