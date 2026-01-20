/**
 * WeeklyTrendsWidget Component
 *
 * Shows week-over-week activity trends for IOCs, incidents, and cyber events
 */
import { useState, useEffect } from 'react'
import { correlations } from '../../lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

function TrendIndicator({ value }) {
  if (value === null || value === undefined) return null

  const isPositive = parseFloat(value) > 0
  const isNegative = parseFloat(value) < 0
  const absValue = Math.abs(parseFloat(value))

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-red-400' : isNegative ? 'text-green-400' : 'text-gray-400'
      }`}
    >
      {isPositive && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )}
      {isNegative && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {absValue.toFixed(1)}%
    </span>
  )
}

function DataTypeCard({ type, data, color }) {
  const latestWeek = data?.[0]
  const previousWeek = data?.[1]

  const currentCount = latestWeek?.count || 0
  const change = latestWeek?.change

  const typeLabels = {
    iocs: { label: 'IOCs', icon: '🔍' },
    incidents: { label: 'Incidents', icon: '⚠️' },
    cyber_events: { label: 'Cyber Events', icon: '🌐' },
  }

  const info = typeLabels[type] || { label: type, icon: '📊' }

  return (
    <div className="p-3 bg-gray-800/50 rounded border border-gray-700/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-sm flex items-center gap-1">
          <span>{info.icon}</span>
          {info.label}
        </span>
        <TrendIndicator value={change} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>
        {currentCount.toLocaleString()}
      </div>
      <div className="text-xs text-gray-500">
        This week vs. {previousWeek?.count?.toLocaleString() || 0} last week
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="cyber-card">
      <div className="h-6 w-32 bg-gray-800 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-800 rounded animate-pulse" />
    </div>
  )
}

export default function WeeklyTrendsWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadTrends() {
      setLoading(true)
      setError(null)

      try {
        const { data: trendsData, error: fetchError } = await correlations.getWeeklyTrends(12)

        if (fetchError) throw fetchError

        setData(trendsData)
      } catch (err) {
        console.error('Error loading weekly trends:', err)
        setError('Failed to load trends')
      } finally {
        setLoading(false)
      }
    }

    loadTrends()
  }, [])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Weekly Activity Trends</h2>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Weekly Activity Trends</h2>
        <div className="text-gray-400 text-sm text-center py-8">
          No trend data available. Run the correlation views refresh.
        </div>
      </div>
    )
  }

  // Prepare chart data - merge all types into unified weeks
  const chartData = []
  const weekMap = {}

  for (const type of ['iocs', 'incidents', 'cyber_events']) {
    for (const week of data[type] || []) {
      if (!weekMap[week.week]) {
        weekMap[week.week] = { week: week.week }
      }
      weekMap[week.week][type] = week.count
    }
  }

  // Sort by week and take last 12
  const sortedWeeks = Object.values(weekMap)
    .sort((a, b) => new Date(a.week) - new Date(b.week))
    .slice(-12)

  // Format week labels
  const formattedData = sortedWeeks.map((item) => ({
    ...item,
    weekLabel: new Date(item.week).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <div className="cyber-card">
      <h2 className="text-lg font-semibold text-white mb-4">Weekly Activity Trends</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <DataTypeCard type="iocs" data={data.iocs} color="#06b6d4" />
        <DataTypeCard type="incidents" data={data.incidents} color="#f97316" />
        <DataTypeCard type="cyber_events" data={data.cyber_events} color="#a855f7" />
      </div>

      {/* Trend Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="weekLabel" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="iocs"
              name="IOCs"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={{ fill: '#06b6d4', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="incidents"
              name="Incidents"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: '#f97316', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="cyber_events"
              name="Cyber Events"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ fill: '#a855f7', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        12-week activity trend across all monitored data types
      </div>
    </div>
  )
}
