// Correlation Panel - Shows TTPs, CVEs, and IOCs for an actor
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { correlations } from '../lib/supabase'

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

      {/* IOCs */}
      {iocs.length > 0 && (
        <CorrelationSection
          title="Indicators of Compromise"
          icon="🔍"
          count={iocs.length}
          defaultOpen={false}
        >
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
