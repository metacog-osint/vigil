/**
 * Alert Analytics Dashboard
 *
 * Comprehensive analytics for alert delivery, response times, and fatigue management.
 * Helps teams optimize alert rules and reduce alert noise.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Skeleton } from './common'

// ============================================
// CONSTANTS
// ============================================

const TIME_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

const CHANNELS = ['email', 'push', 'webhook', 'slack', 'discord', 'teams']

const SEVERITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
  info: 'text-gray-400',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`
}

function getHealthColor(score) {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getHealthLabel(score) {
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Needs Attention'
  if (score >= 40) return 'Degraded'
  return 'Critical'
}

// ============================================
// METRIC CARD COMPONENT
// ============================================

function MetricCard({ title, value, subtitle, trend, icon }) {
  const trendColor = trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'

  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend !== undefined && (
          <span className={`text-sm ${trendColor}`}>
            {trendIcon} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// ============================================
// CHANNEL EFFECTIVENESS CHART
// ============================================

function ChannelEffectivenessChart({ data }) {
  const maxValue = Math.max(...Object.values(data).map((d) => d.delivered || 0), 1)

  return (
    <div className="cyber-card p-4">
      <h3 className="text-sm font-medium text-white mb-4">Channel Effectiveness</h3>
      <div className="space-y-3">
        {CHANNELS.map((channel) => {
          const channelData = data[channel] || { delivered: 0, opened: 0, clicked: 0 }
          const deliveredPct = channelData.delivered / maxValue
          const openRate =
            channelData.delivered > 0 ? channelData.opened / channelData.delivered : 0
          const clickRate = channelData.opened > 0 ? channelData.clicked / channelData.opened : 0

          return (
            <div key={channel} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 capitalize">{channel}</span>
                <span className="text-gray-500">
                  {channelData.delivered} sent | {formatPercent(openRate)} open |{' '}
                  {formatPercent(clickRate)} click
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full bg-accent rounded transition-all duration-300"
                  style={{ width: `${deliveredPct * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// ALERT FATIGUE INDICATOR
// ============================================

function AlertFatigueIndicator({ fatigueScore, indicators }) {
  const healthColor = getHealthColor(100 - fatigueScore)
  const healthLabel = getHealthLabel(100 - fatigueScore)

  return (
    <div className="cyber-card p-4">
      <h3 className="text-sm font-medium text-white mb-4">Alert Fatigue Score</h3>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={`${(100 - fatigueScore) * 2.83} 283`}
              className={healthColor}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${healthColor}`}>{100 - fatigueScore}</span>
          </div>
        </div>
        <div>
          <p className={`text-lg font-semibold ${healthColor}`}>{healthLabel}</p>
          <p className="text-sm text-gray-400">
            {fatigueScore > 40 ? 'Consider optimizing alert rules' : 'Alert volume is manageable'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {indicators.map((indicator, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{indicator.label}</span>
            <span className={indicator.isWarning ? 'text-yellow-400' : 'text-gray-300'}>
              {indicator.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// RESPONSE TIME CHART
// ============================================

function ResponseTimeChart({ data }) {
  const maxTime = Math.max(...data.map((d) => d.avgResponseTime || 0), 1)

  return (
    <div className="cyber-card p-4">
      <h3 className="text-sm font-medium text-white mb-4">Response Time by Severity</h3>
      <div className="space-y-3">
        {data.map((item) => {
          const pct = item.avgResponseTime / maxTime

          return (
            <div key={item.severity} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={`capitalize ${SEVERITY_COLORS[item.severity]}`}>
                  {item.severity}
                </span>
                <span className="text-gray-500">
                  Avg: {formatDuration(item.avgResponseTime)} | Target:{' '}
                  {formatDuration(item.target)}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-300 ${
                    item.avgResponseTime > item.target ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(pct * 100, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// TOP NOISY RULES TABLE
// ============================================

function NoisyRulesTable({ rules, onDisableRule }) {
  return (
    <div className="cyber-card p-4">
      <h3 className="text-sm font-medium text-white mb-4">Noisy Alert Rules</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-gray-500">No noisy rules detected</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2">Rule Name</th>
                <th className="pb-2">Alerts</th>
                <th className="pb-2">Acknowledged</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-800">
                  <td className="py-2 text-white">{rule.name}</td>
                  <td className="py-2 text-gray-300">{rule.alertCount}</td>
                  <td className="py-2">
                    <span className={rule.ackRate < 0.3 ? 'text-red-400' : 'text-gray-300'}>
                      {formatPercent(rule.ackRate)}
                    </span>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => onDisableRule(rule.id)}
                      className="text-xs text-yellow-400 hover:text-yellow-300"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================
// ALERT VOLUME TREND
// ============================================

function AlertVolumeTrend({ data }) {
  const maxValue = Math.max(...data.map((d) => d.count || 0), 1)

  return (
    <div className="cyber-card p-4">
      <h3 className="text-sm font-medium text-white mb-4">Alert Volume Trend</h3>
      <div className="flex items-end h-32 gap-1">
        {data.map((day, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-accent rounded-t transition-all duration-300 hover:bg-accent/80"
              style={{ height: `${(day.count / maxValue) * 100}%`, minHeight: '2px' }}
              title={`${day.date}: ${day.count} alerts`}
            />
            {idx % 7 === 0 && (
              <span className="text-xs text-gray-500 mt-1 truncate">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AlertAnalyticsDashboard({ teamId: _teamId }) {
  const [timeRange, setTimeRange] = useState(30)
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - timeRange)

      // Fetch alert deliveries
      const { data: deliveries } = await supabase
        .from('alert_deliveries')
        .select('*')
        .gte('sent_at', startDate.toISOString())

      // Fetch alert queue
      const { data: alerts } = await supabase
        .from('alert_queue')
        .select('*')
        .gte('created_at', startDate.toISOString())

      // Fetch alert rules
      const { data: rules } = await supabase.from('alert_rules').select('*').eq('enabled', true)

      // Process metrics
      const processedMetrics = processAnalytics(deliveries || [], alerts || [], rules || [])
      setMetrics(processedMetrics)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Process raw data into analytics
  const processAnalytics = (deliveries, alerts, rules) => {
    // Channel effectiveness
    const channelData = {}
    CHANNELS.forEach((channel) => {
      channelData[channel] = { delivered: 0, opened: 0, clicked: 0 }
    })

    deliveries.forEach((d) => {
      const channel = d.channel || 'email'
      if (channelData[channel]) {
        channelData[channel].delivered++
        if (d.opened_at) channelData[channel].opened++
        if (d.clicked_at) channelData[channel].clicked++
      }
    })

    // Response times by severity
    const severityTimes = ['critical', 'high', 'medium', 'low', 'info'].map((severity) => {
      const sevAlerts = alerts.filter((a) => a.severity === severity && a.acknowledged_at)
      const avgTime =
        sevAlerts.length > 0
          ? sevAlerts.reduce((sum, a) => {
              return sum + (new Date(a.acknowledged_at) - new Date(a.created_at)) / 60000
            }, 0) / sevAlerts.length
          : 0

      const targets = { critical: 15, high: 60, medium: 240, low: 1440, info: 2880 }
      return { severity, avgResponseTime: Math.round(avgTime), target: targets[severity] }
    })

    // Alert volume by day
    const volumeByDay = {}
    alerts.forEach((a) => {
      const date = new Date(a.created_at).toISOString().split('T')[0]
      volumeByDay[date] = (volumeByDay[date] || 0) + 1
    })

    const volumeTrend = []
    for (let i = timeRange - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      volumeTrend.push({ date: dateStr, count: volumeByDay[dateStr] || 0 })
    }

    // Noisy rules (high alert count, low acknowledgment)
    const ruleAlertCounts = {}
    alerts.forEach((a) => {
      if (a.rule_id) {
        if (!ruleAlertCounts[a.rule_id]) {
          ruleAlertCounts[a.rule_id] = { total: 0, acked: 0 }
        }
        ruleAlertCounts[a.rule_id].total++
        if (a.acknowledged_at) ruleAlertCounts[a.rule_id].acked++
      }
    })

    const noisyRules = rules
      .map((rule) => {
        const counts = ruleAlertCounts[rule.id] || { total: 0, acked: 0 }
        return {
          id: rule.id,
          name: rule.name,
          alertCount: counts.total,
          ackRate: counts.total > 0 ? counts.acked / counts.total : 1,
        }
      })
      .filter((r) => r.alertCount > 10 && r.ackRate < 0.5)
      .sort((a, b) => a.ackRate - b.ackRate)
      .slice(0, 5)

    // Fatigue indicators
    const avgDailyAlerts = alerts.length / timeRange
    const unackedAlerts = alerts.filter((a) => !a.acknowledged_at).length
    const unackedRate = alerts.length > 0 ? unackedAlerts / alerts.length : 0

    const fatigueScore = Math.min(
      100,
      Math.round(
        (avgDailyAlerts > 50 ? 30 : avgDailyAlerts * 0.6) +
          unackedRate * 50 +
          (noisyRules.length > 0 ? 20 : 0)
      )
    )

    const fatigueIndicators = [
      {
        label: 'Avg daily alerts',
        value: Math.round(avgDailyAlerts),
        isWarning: avgDailyAlerts > 50,
      },
      {
        label: 'Unacknowledged rate',
        value: formatPercent(unackedRate),
        isWarning: unackedRate > 0.3,
      },
      { label: 'Noisy rules', value: noisyRules.length, isWarning: noisyRules.length > 3 },
      {
        label: 'Total alerts',
        value: alerts.length,
        isWarning: false,
      },
    ]

    // Summary metrics
    const totalDelivered = deliveries.length
    const totalOpened = deliveries.filter((d) => d.opened_at).length
    const totalClicked = deliveries.filter((d) => d.clicked_at).length

    return {
      summary: {
        totalAlerts: alerts.length,
        totalDelivered,
        openRate: totalDelivered > 0 ? totalOpened / totalDelivered : 0,
        clickRate: totalOpened > 0 ? totalClicked / totalOpened : 0,
        avgResponseTime: severityTimes.reduce((sum, s) => sum + s.avgResponseTime, 0) / 5,
      },
      channelData,
      severityTimes,
      volumeTrend,
      noisyRules,
      fatigueScore,
      fatigueIndicators,
    }
  }

  const handleDisableRule = (ruleId) => {
    // Navigate to rule settings
    window.location.href = `/settings?tab=alerts&rule=${ruleId}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!metrics) {
    return <div className="text-gray-400">No analytics data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Alert Analytics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="cyber-input text-sm py-1"
        >
          {TIME_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Alerts" value={metrics.summary.totalAlerts} subtitle="In period" />
        <MetricCard
          title="Open Rate"
          value={formatPercent(metrics.summary.openRate)}
          subtitle="Emails opened"
        />
        <MetricCard
          title="Click Rate"
          value={formatPercent(metrics.summary.clickRate)}
          subtitle="Links clicked"
        />
        <MetricCard
          title="Avg Response"
          value={formatDuration(metrics.summary.avgResponseTime)}
          subtitle="To acknowledge"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AlertFatigueIndicator
          fatigueScore={metrics.fatigueScore}
          indicators={metrics.fatigueIndicators}
        />
        <ChannelEffectivenessChart data={metrics.channelData} />
      </div>

      {/* Volume and Response Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AlertVolumeTrend data={metrics.volumeTrend} />
        <ResponseTimeChart data={metrics.severityTimes} />
      </div>

      {/* Noisy Rules */}
      <NoisyRulesTable rules={metrics.noisyRules} onDisableRule={handleDisableRule} />
    </div>
  )
}

// Named exports for sub-components
export {
  MetricCard,
  ChannelEffectivenessChart,
  AlertFatigueIndicator,
  ResponseTimeChart,
  NoisyRulesTable,
  AlertVolumeTrend,
}
