// Correlation Panel - Shows TTPs, CVEs, and IOCs for an actor
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { correlations } from '../../lib/supabase'

function LoadingState() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
      <div className="h-20 bg-gray-700 rounded"></div>
      <div className="h-20 bg-gray-700 rounded"></div>
    </div>
  )
}

function CorrelationSection({ title, icon, count, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium text-white">{title}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.5 bg-cyber-accent/20 text-cyber-accent text-xs rounded">
              {count}
            </span>
          )}
        </div>
        <svg
          className={clsx('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-3 bg-gray-900/50">{children}</div>}
    </div>
  )
}

function TechniqueItem({ technique }) {
  return (
    <Link
      to="/techniques"
      state={{ selectedTechnique: technique.technique_id }}
      className="block p-2 bg-gray-800/50 rounded hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-cyber-accent font-mono">{technique.technique_id}</span>
          <div className="text-sm text-white">{technique.technique_name || technique.name}</div>
        </div>
        {technique.tactic && (
          <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-700 rounded">
            {technique.tactic}
          </span>
        )}
      </div>
    </Link>
  )
}

function VulnerabilityItem({ vuln }) {
  const severityColor = {
    critical: 'text-red-400 bg-red-500/10',
    high: 'text-orange-400 bg-orange-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    low: 'text-blue-400 bg-blue-500/10',
  }[vuln.severity?.toLowerCase()] || 'text-gray-400 bg-gray-500/10'

  return (
    <Link
      to="/vulnerabilities"
      state={{ selectedCve: vuln.cve_id }}
      className="block p-2 bg-gray-800/50 rounded hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-cyber-accent font-mono">{vuln.cve_id}</span>
          {vuln.is_kev && (
            <span className="ml-2 text-xs text-red-400 px-1.5 py-0.5 bg-red-500/10 rounded">KEV</span>
          )}
        </div>
        {vuln.cvss_score && (
          <span className={clsx('text-xs px-2 py-0.5 rounded', severityColor)}>
            CVSS {vuln.cvss_score}
          </span>
        )}
      </div>
      {vuln.description && (
        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{vuln.description}</div>
      )}
    </Link>
  )
}

function IOCItem({ ioc }) {
  const typeColors = {
    ip: 'text-blue-400 bg-blue-500/10',
    domain: 'text-purple-400 bg-purple-500/10',
    hash: 'text-green-400 bg-green-500/10',
    url: 'text-orange-400 bg-orange-500/10',
  }

  return (
    <div className="p-2 bg-gray-800/50 rounded">
      <div className="flex items-center justify-between">
        <span className={clsx('text-xs px-1.5 py-0.5 rounded', typeColors[ioc.type] || 'text-gray-400 bg-gray-500/10')}>
          {ioc.type?.toUpperCase()}
        </span>
        {ioc.confidence && (
          <span className="text-xs text-gray-500">{ioc.confidence}% conf</span>
        )}
      </div>
      <div className="text-sm text-white font-mono mt-1 truncate" title={ioc.value}>
        {ioc.value}
      </div>
      {ioc.malware_family && (
        <div className="text-xs text-gray-500 mt-1">Family: {ioc.malware_family}</div>
      )}
    </div>
  )
}

function MalwareItem({ sample }) {
  return (
    <div className="p-2 bg-gray-800/50 rounded">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white">{sample.signature || sample.malware_family || 'Unknown'}</span>
        {sample.file_type && (
          <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-700 rounded">
            {sample.file_type}
          </span>
        )}
      </div>
      {sample.sha256 && (
        <div className="text-xs text-gray-400 font-mono mt-1 truncate" title={sample.sha256}>
          SHA256: {sample.sha256.substring(0, 32)}...
        </div>
      )}
      {sample.first_seen && (
        <div className="text-xs text-gray-500 mt-1">
          First seen: {new Date(sample.first_seen).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}

// IOC Analytics Component - pie chart, confidence breakdown, source grouping
const IOC_TYPE_COLORS = {
  ip: '#3B82F6',      // blue
  domain: '#A855F7',  // purple
  hash: '#22C55E',    // green
  url: '#F97316',     // orange
  md5: '#10B981',     // emerald
  sha1: '#14B8A6',    // teal
  sha256: '#059669',  // green
  email: '#EC4899',   // pink
  other: '#6B7280',   // gray
}

const CONFIDENCE_COLORS = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function IOCAnalytics({ iocs, actorName, onExport }) {
  // Calculate IOC type distribution
  const typeDistribution = useMemo(() => {
    const counts = {}
    iocs.forEach(ioc => {
      const type = (ioc.type || 'other').toLowerCase()
      counts[type] = (counts[type] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.toUpperCase(), value, color: IOC_TYPE_COLORS[name] || IOC_TYPE_COLORS.other }))
      .sort((a, b) => b.value - a.value)
  }, [iocs])

  // Calculate confidence breakdown
  const confidenceBreakdown = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 }
    iocs.forEach(ioc => {
      const conf = ioc.confidence
      if (conf >= 80) counts.high++
      else if (conf >= 50) counts.medium++
      else counts.low++
    })
    return counts
  }, [iocs])

  // Group by source
  const sourceGroups = useMemo(() => {
    const groups = {}
    iocs.forEach(ioc => {
      const source = ioc.source || ioc.feed_name || 'Unknown'
      if (!groups[source]) groups[source] = []
      groups[source].push(ioc)
    })
    return Object.entries(groups)
      .map(([name, items]) => ({ name, count: items.length }))
      .sort((a, b) => b.count - a.count)
  }, [iocs])

  const totalIOCs = iocs.length

  return (
    <div className="space-y-4">
      {/* Type Distribution Pie Chart */}
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={40}
                paddingAngle={2}
              >
                {typeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-2">Type Distribution</div>
          <div className="flex flex-wrap gap-1">
            {typeDistribution.slice(0, 5).map(({ name, value, color }) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {name}: {value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Confidence Breakdown</div>
        <div className="flex gap-2">
          {Object.entries(confidenceBreakdown).map(([level, count]) => (
            <div
              key={level}
              className={clsx('flex-1 text-center py-2 rounded border', CONFIDENCE_COLORS[level])}
            >
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs capitalize">{level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Groups */}
      {sourceGroups.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-2">Sources</div>
          <div className="flex flex-wrap gap-1">
            {sourceGroups.slice(0, 6).map(({ name, count }) => (
              <span
                key={name}
                className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded border border-gray-700"
              >
                {name}: {count}
              </span>
            ))}
            {sourceGroups.length > 6 && (
              <span className="px-2 py-1 text-gray-500 text-xs">
                +{sourceGroups.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={onExport}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyber-accent/20 text-cyber-accent rounded hover:bg-cyber-accent/30 transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export {totalIOCs} IOCs
      </button>
    </div>
  )
}

// Export IOCs to CSV/JSON
function handleExportIOCs(iocs, actorName) {
  if (!iocs || iocs.length === 0) return

  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `${actorName?.replace(/\s+/g, '_') || 'actor'}_iocs_${timestamp}`

  // Prepare CSV content
  const headers = ['Type', 'Value', 'Confidence', 'Source', 'Malware Family', 'First Seen', 'Last Seen']
  const rows = iocs.map(ioc => [
    ioc.type || '',
    ioc.value || '',
    ioc.confidence || '',
    ioc.source || ioc.feed_name || '',
    ioc.malware_family || '',
    ioc.first_seen || '',
    ioc.last_seen || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function CorrelationPanel({ actorId, actorName }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!actorId) return

    async function loadCorrelations() {
      setLoading(true)
      setError(null)
      try {
        const result = await correlations.getActorCorrelations(actorId)
        setData(result)
      } catch (err) {
        console.error('Error loading correlations:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadCorrelations()
  }, [actorId])

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm text-gray-400">Attack Profile</h3>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
        Error loading correlations: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No correlation data available
      </div>
    )
  }

  const { techniques = [], vulnerabilities = [], iocs = [], malware = [] } = data

  const totalCorrelations = techniques.length + vulnerabilities.length + iocs.length + malware.length

  if (totalCorrelations === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No known TTPs, CVEs, or IOCs associated with {actorName || 'this actor'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-gray-400">Attack Profile</h3>

      {/* TTPs */}
      <CorrelationSection
        title="Techniques (TTPs)"
        icon="🎯"
        count={techniques.length}
        defaultOpen={techniques.length > 0}
      >
        {techniques.length > 0 ? (
          <div className="space-y-2">
            {techniques.slice(0, 10).map((t, i) => (
              <TechniqueItem key={t.technique_id || i} technique={t} />
            ))}
            {techniques.length > 10 && (
              <div className="text-xs text-gray-500 text-center py-2">
                +{techniques.length - 10} more techniques
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No known techniques</div>
        )}
      </CorrelationSection>

      {/* Vulnerabilities */}
      <CorrelationSection
        title="Exploited Vulnerabilities"
        icon="🛡️"
        count={vulnerabilities.length}
        defaultOpen={vulnerabilities.length > 0}
      >
        {vulnerabilities.length > 0 ? (
          <div className="space-y-2">
            {vulnerabilities.slice(0, 10).map((v, i) => (
              <VulnerabilityItem key={v.cve_id || i} vuln={v} />
            ))}
            {vulnerabilities.length > 10 && (
              <div className="text-xs text-gray-500 text-center py-2">
                +{vulnerabilities.length - 10} more CVEs
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No known exploited vulnerabilities</div>
        )}
      </CorrelationSection>

      {/* Malware */}
      {malware.length > 0 && (
        <CorrelationSection
          title="Associated Malware"
          icon="🦠"
          count={malware.length}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {malware.slice(0, 5).map((m, i) => (
              <MalwareItem key={m.id || i} sample={m} />
            ))}
            {malware.length > 5 && (
              <div className="text-xs text-gray-500 text-center py-2">
                +{malware.length - 5} more samples
              </div>
            )}
          </div>
        </CorrelationSection>
      )}

      {/* IOCs - Enhanced with Analytics */}
      {iocs.length > 0 && (
        <CorrelationSection
          title="Indicators of Compromise"
          icon="🔍"
          count={iocs.length}
          defaultOpen={false}
        >
          <div className="space-y-4">
            {/* IOC Analytics */}
            <IOCAnalytics
              iocs={iocs}
              actorName={actorName}
              onExport={() => handleExportIOCs(iocs, actorName)}
            />

            {/* IOC List */}
            <div className="border-t border-gray-700 pt-3">
              <div className="text-xs text-gray-400 mb-2">Recent IOCs</div>
              <div className="space-y-2">
                {iocs.slice(0, 10).map((ioc, i) => (
                  <IOCItem key={ioc.id || i} ioc={ioc} />
                ))}
                {iocs.length > 10 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    +{iocs.length - 10} more IOCs
                  </div>
                )}
              </div>
            </div>
          </div>
        </CorrelationSection>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-700">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{techniques.length}</div>
          <div className="text-xs text-gray-500">TTPs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{vulnerabilities.length}</div>
          <div className="text-xs text-gray-500">CVEs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{malware.length}</div>
          <div className="text-xs text-gray-500">Malware</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{iocs.length}</div>
          <div className="text-xs text-gray-500">IOCs</div>
        </div>
      </div>
    </div>
  )
}

// Compact version for use in list items
export function CorrelationSummary({ techniques = 0, vulnerabilities = 0, iocs = 0 }) {
  const total = techniques + vulnerabilities + iocs
  if (total === 0) return null

  return (
    <div className="flex items-center gap-2 text-xs">
      {techniques > 0 && (
        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">
          {techniques} TTPs
        </span>
      )}
      {vulnerabilities > 0 && (
        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
          {vulnerabilities} CVEs
        </span>
      )}
      {iocs > 0 && (
        <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded">
          {iocs} IOCs
        </span>
      )}
    </div>
  )
}

export default CorrelationPanel
