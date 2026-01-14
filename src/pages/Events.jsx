// Unified Security Events Page
// Aggregates all event types into a single timeline view
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { unifiedEvents, subscribeToTable } from '../lib/supabase'
import { EventTypeBadge, getEventTypeConfig, EVENT_TYPES } from '../components/EventTypeBadge'
import { EventDetailPanel } from '../components/EventDetailPanel'
import { SeverityBadge } from '../components/SeverityBadge'
import { SmartTime } from '../components/TimeDisplay'
import { NewBadge } from '../components/NewIndicator'
import { Tooltip } from '../components/Tooltip'
import { SkeletonTable } from '../components/Skeleton'
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
  Legend,
  BarChart,
  Bar,
} from 'recharts'

const TIME_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 0 },
]

const SEVERITIES = [
  { label: 'All', value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
]

const TYPE_COLORS = {
  ransomware: '#ef4444',
  alert: '#eab308',
  vulnerability: '#f97316',
  ioc: '#3b82f6',
  malware: '#06b6d4',
  breach: '#a855f7',
}

const PAGE_SIZE = 50

export default function Events() {
  // State
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({})
  const [dailyCounts, setDailyCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [timeRange, setTimeRange] = useState(30)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [severity, setSeverity] = useState('')
  const [search, setSearch] = useState('')

  // UI state
  const [viewMode, setViewMode] = useState('table')
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Load events
  const loadEvents = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setEvents([])
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : events.length
      const { data, total, error } = await unifiedEvents.getTimeline({
        days: timeRange,
        types: selectedTypes,
        severity,
        search,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setEvents(data || [])
      } else {
        setEvents(prev => [...prev, ...(data || [])])
      }
      setTotalCount(total || 0)
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [timeRange, selectedTypes, severity, search, events.length])

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const [statsData, countsData] = await Promise.all([
        unifiedEvents.getStats(timeRange),
        unifiedEvents.getDailyCounts(timeRange || 30),
      ])
      setStats(statsData)
      setDailyCounts(countsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }, [timeRange])

  // Initial load
  useEffect(() => {
    loadEvents(true)
    loadStats()
  }, [timeRange, selectedTypes, severity, search])

  // Real-time subscription for new incidents
  useEffect(() => {
    const unsubscribe = subscribeToTable('incidents', (payload) => {
      if (payload.eventType === 'INSERT') {
        // Refresh the list to include the new event
        loadEvents(true)
        loadStats()
      }
    })
    return () => unsubscribe()
  }, [])

  // Toggle type filter
  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // Clear all filters
  const clearFilters = () => {
    setTimeRange(30)
    setSelectedTypes([])
    setSeverity('')
    setSearch('')
  }

  const hasActiveFilters = selectedTypes.length > 0 || severity || search || timeRange !== 30

  // Prepare chart data
  const pieData = Object.entries(stats)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({
      name: getEventTypeConfig(key).label,
      value,
      color: TYPE_COLORS[key],
    }))
    .filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Events</h1>
          <p className="text-gray-400 text-sm mt-1">
            Unified timeline of ransomware, alerts, vulnerabilities, IOCs, and breaches
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                viewMode === 'overview' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Time range */}
        <div className="flex gap-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1.5 rounded text-sm ${
                timeRange === range.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className={`cyber-input text-sm ${severity ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
        >
          {SEVERITIES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="cyber-input w-full pl-9 text-sm"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 px-3 py-2 rounded border border-gray-700 hover:border-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Type filter chips / Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {EVENT_TYPES.map(type => {
          const config = getEventTypeConfig(type)
          const count = stats[type] || 0
          const isSelected = selectedTypes.includes(type)

          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`cyber-card p-3 text-left transition-all ${
                isSelected ? `ring-2 ${config.borderClass}` : 'hover:border-gray-600'
              } ${selectedTypes.length > 0 && !isSelected ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <EventTypeBadge type={type} size="xs" showLabel={false} />
                {isSelected && (
                  <svg className={`w-4 h-4 ${config.textClass}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <div className="text-xl font-bold text-white">{count.toLocaleString()}</div>
              <div className="text-xs text-gray-400">{config.label}</div>
            </button>
          )
        })}
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Table / Overview */}
        <div className="flex-1 min-w-0">
          {viewMode === 'table' ? (
            <TableView
              events={events}
              loading={loading}
              loadingMore={loadingMore}
              totalCount={totalCount}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              onLoadMore={() => loadEvents(false)}
            />
          ) : (
            <OverviewView
              stats={stats}
              dailyCounts={dailyCounts}
              pieData={pieData}
              loading={loading}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedEvent && viewMode === 'table' && (
          <div className="hidden lg:block">
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TableView({ events, loading, loadingMore, totalCount, selectedEvent, onSelectEvent, onLoadMore }) {
  if (loading) {
    return <SkeletonTable rows={10} cols={5} />
  }

  if (events.length === 0) {
    return (
      <div className="cyber-card p-12 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">No events found</h3>
        <p className="text-gray-400">Try adjusting your filters or time range</p>
      </div>
    )
  }

  return (
    <div className="cyber-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="cyber-table w-full">
          <thead>
            <tr>
              <th className="w-24">Type</th>
              <th>Event</th>
              <th className="hidden md:table-cell">Actor</th>
              <th className="w-24">Severity</th>
              <th className="w-28">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className={`cursor-pointer transition-colors ${
                  selectedEvent?.id === event.id ? 'bg-cyan-900/20' : ''
                }`}
              >
                <td>
                  <EventTypeBadge type={event.event_type} size="xs" useShortLabel />
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate max-w-[200px] sm:max-w-[300px]">
                          {event.title}
                        </span>
                        <NewBadge date={event.timestamp} thresholdHours={24} />
                      </div>
                      {event.subtitle && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-[300px]">
                          {event.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell">
                  {event.actor_name ? (
                    <Link
                      to={`/actors?search=${encodeURIComponent(event.actor_name)}`}
                      className="text-cyan-400 hover:text-cyan-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {event.actor_name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td>
                  <SeverityBadge severity={event.severity} showLabel size="xs" />
                </td>
                <td>
                  <SmartTime date={event.timestamp} className="text-gray-400 text-sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {events.length < totalCount && (
        <div className="p-4 text-center border-t border-gray-800">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
          >
            {loadingMore ? 'Loading...' : `Load more (${events.length} of ${totalCount})`}
          </button>
        </div>
      )}
    </div>
  )
}

function OverviewView({ stats, dailyCounts, pieData, loading }) {
  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="cyber-card p-6 h-64 animate-pulse bg-gray-800" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="cyber-card p-6 h-64 animate-pulse bg-gray-800" />
          <div className="cyber-card p-6 h-64 animate-pulse bg-gray-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Timeline chart */}
      <div className="cyber-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">Event Timeline</h3>
          <Tooltip content="Daily count of security events by type">
            <span className="text-gray-500 hover:text-gray-300 cursor-help">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </Tooltip>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyCounts}>
            <defs>
              <linearGradient id="ransomwareGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="vulnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            />
            <Area type="monotone" dataKey="ransomware" name="Ransomware" stroke="#ef4444" strokeWidth={2} fill="url(#ransomwareGrad)" stackId="1" />
            <Area type="monotone" dataKey="alert" name="Alerts" stroke="#eab308" strokeWidth={2} fill="url(#alertGrad)" stackId="1" />
            <Area type="monotone" dataKey="vulnerability" name="KEVs" stroke="#f97316" strokeWidth={2} fill="url(#vulnGrad)" stackId="1" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Distribution pie */}
        <div className="cyber-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Events by Type</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="cyber-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
              <span className="text-gray-400">Total Events</span>
              <span className="text-2xl font-bold text-white">{stats.total?.toLocaleString() || 0}</span>
            </div>
            {Object.entries(stats)
              .filter(([key]) => key !== 'total')
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([type, count]) => {
                const config = getEventTypeConfig(type)
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: TYPE_COLORS[type] }} />
                      <span className="text-gray-300">{config.label}</span>
                    </div>
                    <span className="text-white font-medium">{count.toLocaleString()}</span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
