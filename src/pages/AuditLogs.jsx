import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { auditLogs, auditLogSettings, EVENT_CATEGORIES, EVENT_TYPES, ACTIONS } from '../lib/auditLogs'
import { canAccess } from '../lib/features'
import { SmartTime } from '../components/TimeDisplay'
import { FeatureGate } from '../components/UpgradePrompt'

const TIME_RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'partial', label: 'Partial' },
]

export default function AuditLogs() {
  const { user, profile } = useAuth()
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const [view, setView] = useState('table') // table | overview
  const [showSettings, setShowSettings] = useState(false)

  // Filters
  const [days, setDays] = useState(30)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Export state
  const [exporting, setExporting] = useState(false)

  // Feature check
  const hasAccess = canAccess(profile?.tier, 'audit_logs')

  useEffect(() => {
    if (user?.uid && hasAccess) {
      loadData()
    }
  }, [user?.uid, hasAccess, days, category, status, search])

  async function loadData() {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const filters = {
        userId: user.uid,
        startDate: startDate.toISOString(),
        ...(category && { eventCategory: category }),
        ...(status && { status }),
        ...(search && { search }),
        limit: 500,
      }

      const [logsData, summaryData] = await Promise.all([
        auditLogs.getAll(filters),
        auditLogs.getSummary(user.uid, null, days),
      ])

      setLogs(logsData)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format) {
    setExporting(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const filters = {
        userId: user.uid,
        startDate: startDate.toISOString(),
        ...(category && { eventCategory: category }),
        ...(status && { status }),
        ...(search && { search }),
      }

      let content, filename, mimeType
      if (format === 'csv') {
        content = await auditLogs.exportToCsv(filters)
        filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        mimeType = 'text/csv'
      } else {
        content = await auditLogs.exportToJson(filters)
        filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`
        mimeType = 'application/json'
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleComplianceExport(type) {
    setExporting(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - (type === 'soc2' ? 365 : 90))

      const filters = {
        userId: user.uid,
        startDate: startDate.toISOString(),
        limit: 10000,
      }

      const logsData = await auditLogs.getAll(filters)
      const summaryData = await auditLogs.getSummary(user.uid, null, type === 'soc2' ? 365 : 90)

      const report = {
        reportType: type === 'soc2' ? 'SOC 2 Type II Evidence' : 'PCI-DSS Compliance Evidence',
        generatedAt: new Date().toISOString(),
        generatedBy: user.email,
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days: type === 'soc2' ? 365 : 90,
        },
        summary: {
          totalEvents: summaryData.total,
          byCategory: summaryData.byCategory,
          byStatus: summaryData.byStatus,
          securityEventsCount: logsData.filter(l =>
            ['user.login_failed', 'api.unauthorized', 'api.rate_limited'].includes(l.event_type)
          ).length,
          dataAccessEventsCount: logsData.filter(l => l.event_category === 'data').length,
          adminEventsCount: logsData.filter(l => l.event_category === 'admin').length,
        },
        controlsEvidence: {
          accessControl: {
            description: 'All user access events are logged with timestamps and IP addresses',
            eventCount: logsData.filter(l => l.event_category === 'auth').length,
          },
          dataProtection: {
            description: 'Data access and export events are tracked for all users',
            eventCount: logsData.filter(l => ['data', 'export'].includes(l.event_category)).length,
          },
          changeManagement: {
            description: 'All administrative and settings changes are logged',
            eventCount: logsData.filter(l => ['admin', 'settings'].includes(l.event_category)).length,
          },
        },
        detailedLogs: logsData.slice(0, 1000), // Include sample of detailed logs
      }

      const content = JSON.stringify(report, null, 2)
      const filename = `${type}-compliance-report-${new Date().toISOString().split('T')[0]}.json`

      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Compliance export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
  }

  // Stats for overview
  const categoryStats = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byCategory).map(([cat, count]) => ({
      category: cat,
      count,
      ...EVENT_CATEGORIES[cat],
    })).sort((a, b) => b.count - a.count)
  }, [summary])

  const actionStats = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byAction).map(([action, count]) => ({
      action,
      count,
    })).sort((a, b) => b.count - a.count)
  }, [summary])

  const dailyData = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byDay)
      .map(([day, count]) => ({ date: day, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [summary])

  return (
    <FeatureGate feature="audit_logs">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
            <p className="text-gray-400 text-sm mt-1">
              Comprehensive activity logs for compliance and security monitoring
            </p>
          </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 text-sm rounded ${view === 'table' ? 'bg-cyber-accent text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Table
            </button>
            <button
              onClick={() => setView('overview')}
              className={`px-3 py-1.5 text-sm rounded ${view === 'overview' ? 'bg-cyber-accent text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time Range */}
        <div className="flex bg-gray-800/50 rounded-lg p-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setDays(range.value)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                days === range.value
                  ? 'bg-cyber-accent text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="cyber-input text-sm"
        >
          <option value="">All Categories</option>
          {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
            <option key={key} value={key}>{cat.label}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="cyber-input text-sm"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search logs..."
            className="cyber-input text-sm w-48"
          />
          <button type="submit" className="cyber-button text-sm">Search</button>
        </form>

        {/* Export */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative group">
            <button
              disabled={exporting}
              className="cyber-button text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg hidden group-hover:block z-10 min-w-48">
              <div className="py-1">
                <div className="px-3 py-1 text-xs text-gray-500 uppercase">Standard Export</div>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  Export to CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  Export to JSON
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <div className="px-3 py-1 text-xs text-gray-500 uppercase">Compliance Reports</div>
                <button
                  onClick={() => handleComplianceExport('soc2')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  SOC 2 Evidence (12 mo)
                </button>
                <button
                  onClick={() => handleComplianceExport('pci')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  PCI-DSS Evidence (90 days)
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="cyber-button text-sm"
            title="Audit Log Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-white">{summary.total.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Events</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-green-400">{summary.byStatus.success?.toLocaleString() || 0}</div>
            <div className="text-gray-400 text-sm">Successful</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-red-400">{summary.byStatus.failure?.toLocaleString() || 0}</div>
            <div className="text-gray-400 text-sm">Failed</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-yellow-400">{Object.keys(summary.byCategory).length}</div>
            <div className="text-gray-400 text-sm">Categories</div>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'table' ? (
        <div className="flex gap-6">
          {/* Table */}
          <div className="flex-1 cyber-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No audit logs found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="cyber-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Timestamp</th>
                      <th className="text-left">Event</th>
                      <th className="text-left">User</th>
                      <th className="text-left">Resource</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer hover:bg-gray-800/50 ${selectedLog?.id === log.id ? 'bg-gray-800/70' : ''}`}
                      >
                        <td className="text-gray-400 text-sm whitespace-nowrap">
                          <SmartTime date={log.created_at} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <CategoryBadge category={log.event_category} />
                            <span className="text-white text-sm">
                              {EVENT_TYPES[log.event_type]?.label || log.event_type}
                            </span>
                          </div>
                        </td>
                        <td className="text-gray-300 text-sm">{log.user_email || '-'}</td>
                        <td className="text-gray-400 text-sm max-w-xs truncate">
                          {log.resource_name || log.resource_type || '-'}
                        </td>
                        <td>
                          <StatusBadge status={log.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedLog && (
            <div className="w-96 flex-shrink-0">
              <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
            </div>
          )}
        </div>
      ) : (
        /* Overview View */
        <div className="space-y-6">
          {/* Activity Timeline */}
          <div className="cyber-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
            {dailyData.length > 0 ? (
              <div className="h-48">
                <ActivityChart data={dailyData} />
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                No activity data available
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Events by Category */}
            <div className="cyber-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Events by Category</h3>
              <div className="space-y-3">
                {categoryStats.map(cat => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <CategoryBadge category={cat.category} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{cat.label}</span>
                        <span className="text-sm text-gray-400">{cat.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${cat.color}-500 rounded-full`}
                          style={{ width: `${(cat.count / summary.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Events by Action */}
            <div className="cyber-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Events by Action</h3>
              <div className="space-y-2">
                {actionStats.slice(0, 8).map(item => (
                  <div key={item.action} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <span className="text-sm text-gray-300 capitalize">{item.action}</span>
                    <span className="text-sm font-medium text-white">{item.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <AuditSettingsModal
            userId={user?.uid}
            teamId={profile?.team_id}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </FeatureGate>
  )
}

/**
 * Category Badge
 */
function CategoryBadge({ category }) {
  const info = EVENT_CATEGORIES[category] || { label: category, color: 'gray' }
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    gray: 'bg-gray-500/20 text-gray-400',
    orange: 'bg-orange-500/20 text-orange-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses[info.color] || colorClasses.gray}`}>
      {info.label}
    </span>
  )
}

/**
 * Status Badge
 */
function StatusBadge({ status }) {
  const styles = {
    success: 'bg-green-500/20 text-green-400',
    failure: 'bg-red-500/20 text-red-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.success}`}>
      {status}
    </span>
  )
}

/**
 * Log Detail Panel
 */
function LogDetailPanel({ log, onClose }) {
  const eventInfo = EVENT_TYPES[log.event_type] || {}

  return (
    <div className="cyber-card h-fit sticky top-6">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-white">Event Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Event Type */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Event</div>
          <div className="flex items-center gap-2">
            <CategoryBadge category={log.event_category} />
            <span className="text-white">{eventInfo.label || log.event_type}</span>
          </div>
        </div>

        {/* Timestamp */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Timestamp</div>
          <div className="text-gray-300">{new Date(log.created_at).toLocaleString()}</div>
        </div>

        {/* User */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">User</div>
          <div className="text-gray-300">{log.user_email || log.user_id}</div>
          {log.user_name && <div className="text-gray-500 text-sm">{log.user_name}</div>}
        </div>

        {/* Action */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Action</div>
          <div className="text-gray-300 capitalize">{log.action}</div>
        </div>

        {/* Resource */}
        {(log.resource_type || log.resource_name) && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Resource</div>
            {log.resource_type && <div className="text-gray-400 text-sm capitalize">{log.resource_type}</div>}
            {log.resource_name && <div className="text-gray-300">{log.resource_name}</div>}
            {log.resource_id && <div className="text-gray-500 text-xs font-mono">{log.resource_id}</div>}
          </div>
        )}

        {/* Description */}
        {log.description && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Description</div>
            <div className="text-gray-300 text-sm">{log.description}</div>
          </div>
        )}

        {/* Status */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Status</div>
          <StatusBadge status={log.status} />
          {log.error_message && (
            <div className="text-red-400 text-sm mt-1">{log.error_message}</div>
          )}
        </div>

        {/* Client Info */}
        {(log.ip_address || log.user_agent) && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Client Info</div>
            {log.ip_address && <div className="text-gray-400 text-sm font-mono">{log.ip_address}</div>}
            {log.user_agent && (
              <div className="text-gray-500 text-xs mt-1 truncate" title={log.user_agent}>
                {log.user_agent}
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Metadata</div>
            <pre className="text-gray-400 text-xs bg-gray-800/50 rounded p-2 overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Simple Activity Chart (bar chart)
 */
function ActivityChart({ data }) {
  if (!data || data.length === 0) return null

  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <div className="flex items-end gap-1 h-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-cyber-accent/60 rounded-t hover:bg-cyber-accent transition-colors"
            style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
            title={`${d.date}: ${d.count} events`}
          />
          {data.length <= 14 && (
            <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
              {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Audit Settings Modal
 */
function AuditSettingsModal({ userId, teamId, onClose }) {
  const [settings, setSettings] = useState({
    retentionDays: 90,
    logAuthEvents: true,
    logDataEvents: true,
    logExportEvents: true,
    logSettingsEvents: true,
    logAdminEvents: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [teamId])

  async function loadSettings() {
    setLoading(true)
    try {
      const data = await auditLogSettings.get(teamId)
      if (data) {
        setSettings({
          retentionDays: data.retention_days || 90,
          logAuthEvents: data.log_auth_events ?? true,
          logDataEvents: data.log_data_events ?? true,
          logExportEvents: data.log_export_events ?? true,
          logSettingsEvents: data.log_settings_events ?? true,
          logAdminEvents: data.log_admin_events ?? true,
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await auditLogSettings.update(teamId, settings)
      onClose()
    } catch (err) {
      alert('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const retentionOptions = [
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 180, label: '180 days' },
    { value: 365, label: '1 year' },
    { value: 730, label: '2 years' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Audit Log Settings</h2>
            <p className="text-sm text-gray-400 mt-1">Configure retention and logging preferences</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading settings...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Retention Period */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Log Retention Period
              </label>
              <select
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {retentionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Logs older than this will be automatically purged. Longer retention may be required for compliance.
              </p>
            </div>

            {/* Event Types */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Events to Log
              </label>
              <div className="space-y-2">
                {[
                  { key: 'logAuthEvents', label: 'Authentication Events', desc: 'Login, logout, MFA, sessions' },
                  { key: 'logDataEvents', label: 'Data Access Events', desc: 'Searches, views, watchlist changes' },
                  { key: 'logExportEvents', label: 'Export Events', desc: 'CSV, STIX, PDF exports' },
                  { key: 'logSettingsEvents', label: 'Settings Events', desc: 'Profile, API keys, alert rules' },
                  { key: 'logAdminEvents', label: 'Admin Events', desc: 'Team management, role changes' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                    <input
                      type="checkbox"
                      checked={settings[opt.key]}
                      onChange={(e) => setSettings({ ...settings, [opt.key]: e.target.checked })}
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div>
                      <div className="text-white text-sm">{opt.label}</div>
                      <div className="text-gray-500 text-xs">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Compliance Note */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <div className="text-blue-400 font-medium">Compliance Requirements</div>
                  <div className="text-gray-400 mt-1">
                    SOC 2 Type II requires 12 months of audit logs. PCI-DSS requires 90 days minimum.
                    Ensure your retention period meets your compliance obligations.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
