import { useState, useEffect } from 'react'
import { incidents } from '../../lib/supabase'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'

export default function ActivityChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Get 90 days of data for better coverage
        const { data: incidentData } = await incidents.getStats(90)

        // Group by date - show last 30 days on chart
        const counts = {}
        for (let i = 29; i >= 0; i--) {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
          counts[date] = 0
        }

        incidentData?.forEach((incident) => {
          // Handle both date formats (with and without time)
          const dateStr = incident.discovered_date?.split('T')[0]
          if (dateStr && counts[dateStr] !== undefined) {
            counts[dateStr]++
          }
        })

        const chartData = Object.entries(counts).map(([date, count]) => ({
          date,
          displayDate: format(new Date(date), 'MMM d'),
          incidents: count,
        }))

        setData(chartData)
      } catch (error) {
        console.error('Error loading chart data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        Loading chart...
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Area
            type="monotone"
            dataKey="incidents"
            stroke="#00ff88"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorIncidents)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
