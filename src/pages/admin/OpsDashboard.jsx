/**
 * Operations Dashboard
 * Internal monitoring for sync status, error rates, and data freshness
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { syncLog } from '../../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import { isSystemAdmin } from '../../lib/adminAuth'

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[status] || styles.running}`}>
      {status?.toUpperCase() || 'UNKNOWN'}
    </span>
  )
}

// Stat card component
function StatCard({ title, value, subtitle, color = 'white', icon }) {
  const colorClasses = {
    white: 'text-white',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  }

  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
          <div className="text-sm text-gray-400">{title}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
        {icon && <div className="text-gray-600">{icon}</div>}
      </div>
    </div>
  )
}

// Data source row component
function DataSourceRow({ source, onViewHistory }) {
  const getStatusColor = (status) => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    if (status === 'partial') return 'text-yellow-400'
    return 'text-gray-400'
  }

  const getHealthIcon = (status) => {
    if (status === 'success') return (
      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
    if (status === 'error') return (
      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
    return (
      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    )
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {getHealthIcon(source.lastStatus)}
          <span className="font-medium text-white">{source.source}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={source.lastStatus} />
      </td>
      <td className="py-3 px-4 text-gray-400 text-sm">
        {source.lastRun
          ? formatDistanceToNow(new Date(source.lastRun), { addSuffix: true })
          : 'Never'}
      </td>
      <td className="py-3 px-4 text-gray-400 text-sm">
        <span className="text-green-400">{source.success}</span>
        {' / '}
        <span className="text-red-400">{source.failed}</span>
        {' / '}
        <span className="text-white">{source.total}</span>
      </td>
      <td className="py-3 px-4">
        <button
          onClick={() => onViewHistory(source.source)}
          className="text-cyber-accent hover:text-white text-sm"
        >
          View History
        </button>
      </td>
    </tr>
  )
}

// Error log component
function ErrorLog({ errors }) {
  if (!errors?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent errors
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {errors.map((err, idx) => (
        <div key={idx} className="p-3 bg-red-900/10 border border-red-800/30 rounded">
          <div className="flex items-center justify-between mb-1">
            <span className="text-red-400 font-medium text-sm">{err.source}</span>
            <span className="text-gray-500 text-xs">
              {formatDistanceToNow(new Date(err.timestamp), { addSuffix: true })}
            </span>
          </div>
          <div className="text-gray-400 text-xs font-mono truncate">{err.error}</div>
        </div>
      ))}
    </div>
  )
}

// Source history modal
function SourceHistoryModal({ source, history, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">Sync History: {source}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {history?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No history available</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Processed</th>
                  <th className="pb-2">Added</th>
                </tr>
              </thead>
              <tbody>
                {history?.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800">
                    <td className="py-2 text-sm text-gray-300">
                      {format(new Date(log.completed_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-2 text-sm text-gray-400">{log.records_processed || 0}</td>
                    <td className="py-2 text-sm text-gray-400">{log.records_added || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OpsDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [freshness, setFreshness] = useState([])
  const [errorRates, setErrorRates] = useState([])
  const [selectedSource, setSelectedSource] = useState(null)
  const [sourceHistory, setSourceHistory] = useState([])
  const [timeRange, setTimeRange] = useState(24) // hours

  useEffect(() => {
    loadData()
  }, [timeRange])

  async function loadData() {
    setLoading(true)
    try {
      const [summaryRes, freshnessRes, errorRatesRes] = await Promise.all([
        syncLog.getStatusSummary(timeRange),
        syncLog.getDataFreshness(),
        syncLog.getErrorRates(7),
      ])

      setSummary(summaryRes.data)
      setFreshness(freshnessRes.data || [])
      setErrorRates(errorRatesRes.data || [])
    } catch (err) {
      console.error('Error loading ops data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleViewHistory(source) {
    setSelectedSource(source)
    const { data } = await syncLog.getSourceHistory(source, 7)
    setSourceHistory(data || [])
  }

  // Check if user is a system admin
  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Please sign in to view operations dashboard.</p>
      </div>
    )
  }

  if (!isSystemAdmin(user)) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">You don't have permission to view the Operations Dashboard.</p>
        <p className="text-gray-500 text-sm mt-2">Contact your administrator if you need access.</p>
      </div>
    )
  }

  const sources = summary?.bySource ? Object.values(summary.bySource) : []
  const staleSources = freshness.filter((f) => f.isStale)
  const healthySources = sources.filter((s) => s.lastStatus === 'success').length
  const errorRate = summary?.total > 0 ? ((summary?.failed / summary?.total) * 100).toFixed(1) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor data ingestion and system health</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="cyber-input text-sm"
          >
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button onClick={loadData} className="cyber-button text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cyber-card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading operations data...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              title="Total Syncs"
              value={summary?.total || 0}
              subtitle={`Last ${timeRange}h`}
              color="white"
            />
            <StatCard
              title="Successful"
              value={summary?.success || 0}
              color="green"
            />
            <StatCard
              title="Failed"
              value={summary?.failed || 0}
              color="red"
            />
            <StatCard
              title="Error Rate"
              value={`${errorRate}%`}
              color={parseFloat(errorRate) > 10 ? 'red' : parseFloat(errorRate) > 5 ? 'yellow' : 'green'}
            />
            <StatCard
              title="Healthy Sources"
              value={`${healthySources}/${sources.length}`}
              color={healthySources === sources.length ? 'green' : 'yellow'}
            />
            <StatCard
              title="Stale Sources"
              value={staleSources.length}
              subtitle=">24h since sync"
              color={staleSources.length > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Records Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="cyber-card p-4">
              <div className="text-sm text-gray-400 mb-1">Records Processed</div>
              <div className="text-2xl font-bold text-white">
                {(summary?.recordsProcessed || 0).toLocaleString()}
              </div>
            </div>
            <div className="cyber-card p-4">
              <div className="text-sm text-gray-400 mb-1">Records Added</div>
              <div className="text-2xl font-bold text-green-400">
                {(summary?.recordsAdded || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Data Sources Table */}
            <div className="lg:col-span-2 cyber-card overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="font-bold text-white">Data Sources Status</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Last Status</th>
                      <th className="py-3 px-4">Last Run</th>
                      <th className="py-3 px-4">Success/Fail/Total</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No sync data available
                        </td>
                      </tr>
                    ) : (
                      sources
                        .sort((a, b) => {
                          // Sort by status (errors first), then by last run
                          if (a.lastStatus === 'error' && b.lastStatus !== 'error') return -1
                          if (b.lastStatus === 'error' && a.lastStatus !== 'error') return 1
                          return new Date(b.lastRun || 0) - new Date(a.lastRun || 0)
                        })
                        .map((source) => (
                          <DataSourceRow
                            key={source.source}
                            source={source}
                            onViewHistory={handleViewHistory}
                          />
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Errors */}
            <div className="cyber-card">
              <div className="p-4 border-b border-gray-700">
                <h2 className="font-bold text-white">Recent Errors</h2>
              </div>
              <div className="p-4">
                <ErrorLog errors={summary?.recentErrors} />
              </div>
            </div>
          </div>

          {/* Data Freshness */}
          {staleSources.length > 0 && (
            <div className="cyber-card">
              <div className="p-4 border-b border-gray-700 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h2 className="font-bold text-yellow-400">Stale Data Sources</h2>
              </div>
              <div className="p-4">
                <div className="grid gap-2">
                  {staleSources.map((source) => (
                    <div
                      key={source.source}
                      className="flex items-center justify-between p-3 bg-yellow-900/10 border border-yellow-800/30 rounded"
                    >
                      <span className="text-white font-medium">{source.source}</span>
                      <span className="text-yellow-400 text-sm">
                        {source.hoursAgo}h since last sync
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* History Modal */}
      {selectedSource && (
        <SourceHistoryModal
          source={selectedSource}
          history={sourceHistory}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  )
}
