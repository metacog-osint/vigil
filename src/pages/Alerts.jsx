// Security Alerts page - CISA and other security alerts
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { alerts as alertsApi } from '../lib/supabase'
import { SkeletonTable, EmptyState, ErrorMessage, TimeAgo, SeverityBadge } from '../components'

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'malware', label: 'Malware' },
  { value: 'vulnerability', label: 'Vulnerability' },
  { value: 'apt', label: 'APT' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'general', label: 'General' },
]

const SEVERITIES = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

function AlertCard({ alert }) {
  const categoryColors = {
    ransomware: 'bg-red-500/20 text-red-400',
    malware: 'bg-orange-500/20 text-orange-400',
    vulnerability: 'bg-yellow-500/20 text-yellow-400',
    apt: 'bg-purple-500/20 text-purple-400',
    phishing: 'bg-blue-500/20 text-blue-400',
    general: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-medium text-white line-clamp-2">
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyber-accent transition-colors"
          >
            {alert.title}
          </a>
        </h3>
        <SeverityBadge severity={alert.severity} />
      </div>

      <p className="text-sm text-gray-400 line-clamp-3 mb-3">
        {alert.description}
      </p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={clsx('px-2 py-0.5 rounded capitalize', categoryColors[alert.category] || categoryColors.general)}>
            {alert.category || 'general'}
          </span>
          {alert.cve_ids?.length > 0 && (
            <span className="text-gray-500">
              {alert.cve_ids.length} CVE{alert.cve_ids.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="uppercase">{alert.source}</span>
          <TimeAgo date={alert.published_date} />
        </div>
      </div>

      {/* CVE tags */}
      {alert.cve_ids?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {alert.cve_ids.slice(0, 5).map((cve) => (
            <Link
              key={cve}
              to={`/vulnerabilities?cve=${cve}`}
              className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded hover:bg-gray-700 hover:text-white transition-colors"
            >
              {cve}
            </Link>
          ))}
          {alert.cve_ids.length > 5 && (
            <span className="text-xs text-gray-600">+{alert.cve_ids.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadAlerts()
  }, [category, severity, page])

  const loadAlerts = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, count, error } = await alertsApi.getRecent({
        limit: pageSize,
        offset: page * pageSize,
        category,
        severity,
        days: 90,
      })

      if (error) throw error
      setAlerts(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Security Alerts</h1>
        <p className="text-gray-400 mt-1">Official cybersecurity alerts from CISA and US-CERT</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0) }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(0) }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent"
        >
          {SEVERITIES.map((sev) => (
            <option key={sev.value} value={sev.value}>{sev.label}</option>
          ))}
        </select>

        <div className="text-sm text-gray-500 flex items-center">
          {totalCount} alert{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-4" />}

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No alerts found"
          description="No security alerts match your current filters"
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
