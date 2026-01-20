/**
 * Incident Overview View Component
 * Analytics dashboard with charts for incident data
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { Tooltip } from '../../components/Tooltip'
import { CHART_COLORS } from '../../lib/constants'
import { getStatusColor } from './IncidentConstants'

export function IncidentOverviewView({
  loading,
  analytics,
  timeRange,
  onSetSectorFilter,
  onSetActorFilter,
  onSetCountryFilter,
  onSetStatusFilter,
  setViewMode,
}) {
  if (loading) {
    return (
      <div className="cyber-card p-12 text-center">
        <svg
          className="animate-spin w-8 h-8 mx-auto mb-4 text-cyan-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div className="space-y-6">
      {/* Incident Timeline Chart */}
      <div className="cyber-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">
            Incident Activity (
            {timeRange === 0
              ? 'Last 90 Days'
              : timeRange === 365
                ? 'Last Year'
                : `Last ${timeRange} Days`}
            )
          </h3>
          <Tooltip
            content="Daily count of ransomware incidents by discovered date. Spikes indicate increased threat actor activity."
            source="ransomware.live"
          >
            <span className="text-gray-500 hover:text-gray-300 cursor-help">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </Tooltip>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={analytics.timelineData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#06b6d4' }}
              formatter={(value) => [value, 'Incidents']}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
            />
            <Area
              type="monotone"
              dataKey="incidents"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#incidentGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row - Pie and Bar */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sector Distribution Pie */}
        <div className="cyber-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white">Sector Distribution</h3>
            <Tooltip
              content="Industry sectors targeted by ransomware groups. Click any slice to filter the table by that sector."
              source="Sector classification"
            >
              <span className="text-gray-500 hover:text-gray-300 cursor-help">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
            </Tooltip>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={analytics.sectorPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => {
                  onSetSectorFilter(data.name.toLowerCase())
                  setViewMode('table')
                }}
                style={{ cursor: 'pointer' }}
              >
                {analytics.sectorPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => [value, name]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => (
                  <span style={{ color: '#d1d5db', fontSize: '12px' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Actors Bar Chart */}
        <div className="cyber-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white">Most Active Threat Actors</h3>
            <Tooltip
              content="Ransomware groups ranked by incident count. Click any bar to filter incidents by that actor."
              source="ransomware.live"
            >
              <span className="text-gray-500 hover:text-gray-300 cursor-help">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
            </Tooltip>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={analytics.topActors.slice(0, 8)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                width={75}
                tickFormatter={(value) => (value.length > 12 ? value.slice(0, 12) + '...' : value)}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value) => [value, 'Incidents']}
                cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
              />
              <Bar
                dataKey="count"
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                onClick={(data) => {
                  if (data.id) {
                    onSetActorFilter(data.id, data.name)
                    setViewMode('table')
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Countries and Status */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Countries */}
        <div className="cyber-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white">Top Targeted Countries</h3>
            <Tooltip
              content="Countries where victim organizations are located. Note: Country data is often incomplete in source feeds."
              source="ransomware.live (sparse)"
            >
              <span className="text-gray-500 hover:text-gray-300 cursor-help">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-2">
            {analytics.topCountries.map((country, i) => (
              <button
                key={country.name}
                onClick={() => {
                  onSetCountryFilter(country.name)
                  setViewMode('table')
                }}
                className="px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
                style={{
                  borderLeft: `3px solid ${CHART_COLORS[i % CHART_COLORS.length]}`,
                }}
              >
                <span className="text-white font-medium">{country.name}</span>
                <span className="text-cyan-400 font-mono">{country.count}</span>
              </button>
            ))}
            {analytics.topCountries.length === 0 && (
              <span className="text-gray-500">No country data available</span>
            )}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="cyber-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white">Incident Status</h3>
            <Tooltip
              content="Claimed: announced by actor. Confirmed: verified attack. Leaked: data published. Paid: ransom paid."
              source="ransomware.live"
            >
              <span className="text-gray-500 hover:text-gray-300 cursor-help">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
            </Tooltip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {analytics.statuses.map((status) => (
              <button
                key={status.name}
                onClick={() => {
                  onSetStatusFilter(status.name)
                  setViewMode('table')
                }}
                className={`p-3 rounded-lg transition-all ${getStatusColor(status.name)} hover:opacity-80`}
              >
                <div className="text-2xl font-bold">{status.count}</div>
                <div className="text-xs capitalize">{status.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncidentOverviewView
