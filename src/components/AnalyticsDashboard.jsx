/**
 * Analytics Dashboard Component
 * Internal view for product analytics and user engagement
 */

import { useState, useEffect } from 'react'
import { analyticsQueries } from '../lib/analytics'
import { format, subDays } from 'date-fns'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [dailyStats, setDailyStats] = useState([])
  const [featureAdoption, setFeatureAdoption] = useState([])
  const [eventsByType, setEventsByType] = useState([])
  const [atRiskUsers, setAtRiskUsers] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [engagementData, daily, features, events, atRisk] = await Promise.all([
        analyticsQueries.getEngagementSummary().catch(() => null),
        analyticsQueries.getDailyStats(30),
        analyticsQueries.getFeatureAdoption(),
        analyticsQueries.getEventsByType(7),
        analyticsQueries.getAtRiskUsers(),
      ])

      setEngagement(engagementData)
      setDailyStats(daily)
      setFeatureAdoption(features)
      setEventsByType(events)
      setAtRiskUsers(atRisk)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        Error loading analytics: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Product Analytics</h2>
        <p className="text-gray-400 text-sm mt-1">User engagement and feature usage metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          label="Total Users"
          value={engagement?.total_users || 0}
        />
        <MetricCard
          label="Active (7d)"
          value={engagement?.active_7d || 0}
          subtitle={engagement?.total_users ? `${Math.round((engagement.active_7d / engagement.total_users) * 100)}%` : '0%'}
        />
        <MetricCard
          label="Active (30d)"
          value={engagement?.active_30d || 0}
          subtitle={engagement?.total_users ? `${Math.round((engagement.active_30d / engagement.total_users) * 100)}%` : '0%'}
        />
        <MetricCard
          label="Avg Engagement"
          value={Math.round(engagement?.avg_engagement || 0)}
          subtitle="score"
        />
        <MetricCard
          label="At Risk"
          value={engagement?.at_risk_users || 0}
          className={engagement?.at_risk_users > 0 ? 'border-red-500/50' : ''}
        />
      </div>

      {/* Activity Chart */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Daily Activity (30 days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(d) => format(new Date(d), 'MMM d')}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey="page_views"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                name="Page Views"
              />
              <Line
                type="monotone"
                dataKey="searches"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Searches"
              />
              <Line
                type="monotone"
                dataKey="exports"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Exports"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Feature Adoption */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Feature Adoption</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureAdoption.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  stroke="#9ca3af"
                  fontSize={11}
                  width={100}
                  tickFormatter={(f) => f.replace(/_/g, ' ')}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="users" fill="#0ea5e9" name="Users" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events by Type */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Events by Type (7d)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={eventsByType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ type, count }) => `${type}: ${count}`}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {eventsByType.map((entry, index) => (
                    <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* At-Risk Users */}
      {atRiskUsers.length > 0 && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">
            At-Risk Users
            <span className="ml-2 text-sm text-red-400">({atRiskUsers.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Last Seen</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Days Inactive</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Engagement Score</th>
                </tr>
              </thead>
              <tbody>
                {atRiskUsers.map((user) => (
                  <tr key={user.user_id} className="border-b border-gray-800">
                    <td className="py-3 px-4 text-sm text-white font-mono">{user.user_id.slice(0, 20)}...</td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {user.last_seen_at ? format(new Date(user.last_seen_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-red-400">{user.days_since_last_activity} days</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{user.engagement_score || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, subtitle, className = '' }) {
  return (
    <div className={`bg-gray-800/30 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  )
}
