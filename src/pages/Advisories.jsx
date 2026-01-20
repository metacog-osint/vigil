import { useState, useEffect } from 'react'
import { advisories, ECOSYSTEMS } from '../lib/supabase/advisories'
import { formatDistanceToNow } from 'date-fns'
import { SkeletonTable } from '../components/Skeleton'
import { SeverityBadge } from '../components/SeverityBadge'
import { NewBadge } from '../components/NewIndicator'

// Map GHSA severity to our severity levels
function mapSeverity(ghsaSeverity) {
  const map = {
    critical: 'critical',
    high: 'high',
    moderate: 'medium',
    medium: 'medium',
    low: 'low',
  }
  return map[ghsaSeverity?.toLowerCase()] || 'info'
}

export default function Advisories() {
  const [advisoryList, setAdvisoryList] = useState([])
  const [loading, setLoading] = useState(true)
  const [ecosystem, setEcosystem] = useState('')
  const [severity, setSeverity] = useState('')
  const [search, setSearch] = useState('')
  const [selectedAdvisory, setSelectedAdvisory] = useState(null)
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, ecosystems: [] })

  useEffect(() => {
    loadAdvisories()
  }, [ecosystem, severity])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadAdvisories() {
    setLoading(true)
    try {
      const { data, error } = await advisories.getAll({
        limit: 100,
        ecosystem: ecosystem || null,
        severity: severity || null,
        search: search || null,
      })

      if (error) throw error
      setAdvisoryList(data || [])
    } catch (error) {
      console.error('Error loading advisories:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const ecosystemStats = await advisories.getCountsByEcosystem()
      const severityStats = await advisories.getCountsBySeverity()

      setStats({
        total: ecosystemStats.reduce((sum, e) => sum + e.total, 0),
        critical: severityStats.find((s) => s.severity === 'critical')?.count || 0,
        high: severityStats.find((s) => s.severity === 'high')?.count || 0,
        ecosystems: ecosystemStats,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    loadAdvisories()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Security Advisories</h1>
        <p className="text-gray-400 text-sm mt-1">
          GitHub Security Advisory Database - Supply chain vulnerabilities
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cyber-card">
          <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total Advisories</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-red-400">{stats.critical.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Critical</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-orange-400">{stats.high.toLocaleString()}</div>
          <div className="text-sm text-gray-400">High</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-cyber-accent">{stats.ecosystems.length}</div>
          <div className="text-sm text-gray-400">Ecosystems</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ecosystem</label>
          <select
            value={ecosystem}
            onChange={(e) => setEcosystem(e.target.value)}
            className="cyber-input text-sm"
          >
            <option value="">All Ecosystems</option>
            {ECOSYSTEMS.map((eco) => (
              <option key={eco.value} value={eco.value}>
                {eco.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="cyber-input text-sm"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages, CVEs..."
            className="cyber-input text-sm w-48"
          />
          <button type="submit" className="cyber-button text-sm">
            Search
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Advisory List */}
        <div className="flex-1">
          {loading ? (
            <SkeletonTable rows={8} cols={4} />
          ) : advisoryList.length === 0 ? (
            <div className="cyber-card text-center py-12">
              <div className="text-gray-400 mb-2">No advisories found</div>
              <p className="text-gray-500 text-sm">Run the GHSA ingestion to populate this data.</p>
            </div>
          ) : (
            <div className="cyber-card overflow-hidden">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Advisory</th>
                    <th className="hidden md:table-cell">Package</th>
                    <th>Severity</th>
                    <th className="hidden lg:table-cell">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {advisoryList.map((adv) => (
                    <tr
                      key={adv.ghsa_id}
                      onClick={() => setSelectedAdvisory(adv)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyber-accent text-sm">{adv.ghsa_id}</span>
                          <NewBadge date={adv.published_at} thresholdHours={168} />
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {adv.summary?.slice(0, 60)}...
                        </div>
                        {adv.cve_id && (
                          <div className="text-xs text-gray-600 font-mono">{adv.cve_id}</div>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="text-sm text-gray-300">{adv.package_name || '—'}</div>
                        <div className="text-xs text-gray-500 capitalize">{adv.ecosystem}</div>
                      </td>
                      <td>
                        <SeverityBadge severity={mapSeverity(adv.severity)} showLabel />
                      </td>
                      <td className="hidden lg:table-cell text-sm text-gray-400">
                        {adv.published_at
                          ? formatDistanceToNow(new Date(adv.published_at), { addSuffix: true })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedAdvisory && (
          <div className="w-96 cyber-card hidden lg:block max-h-[calc(100vh-200px)] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-mono text-cyber-accent">{selectedAdvisory.ghsa_id}</h3>
              <button
                onClick={() => setSelectedAdvisory(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Summary</div>
                <div className="text-gray-300 text-xs">{selectedAdvisory.summary}</div>
              </div>

              {selectedAdvisory.description && (
                <div>
                  <div className="text-gray-500 mb-1">Description</div>
                  <div className="text-gray-400 text-xs max-h-32 overflow-auto">
                    {selectedAdvisory.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">Severity</div>
                  <SeverityBadge severity={mapSeverity(selectedAdvisory.severity)} showLabel />
                </div>
                {selectedAdvisory.cvss_score && (
                  <div>
                    <div className="text-gray-500 mb-1">CVSS</div>
                    <SeverityBadge score={selectedAdvisory.cvss_score} />
                  </div>
                )}
              </div>

              {selectedAdvisory.cve_id && (
                <div>
                  <div className="text-gray-500 mb-1">CVE</div>
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${selectedAdvisory.cve_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-cyber-accent hover:underline"
                  >
                    {selectedAdvisory.cve_id}
                  </a>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">Ecosystem</div>
                  <div className="text-gray-300 capitalize">{selectedAdvisory.ecosystem}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Package</div>
                  <div className="text-gray-300 font-mono text-xs">
                    {selectedAdvisory.package_name || '—'}
                  </div>
                </div>
              </div>

              {selectedAdvisory.vulnerable_versions && (
                <div>
                  <div className="text-gray-500 mb-1">Vulnerable Versions</div>
                  <div className="text-red-400 font-mono text-xs">
                    {selectedAdvisory.vulnerable_versions}
                  </div>
                </div>
              )}

              {selectedAdvisory.patched_versions && (
                <div>
                  <div className="text-gray-500 mb-1">Patched Versions</div>
                  <div className="text-green-400 font-mono text-xs">
                    {selectedAdvisory.patched_versions}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 space-y-2">
                <a
                  href={
                    selectedAdvisory.source_url ||
                    `https://github.com/advisories/${selectedAdvisory.ghsa_id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-cyber-accent text-xs hover:underline"
                >
                  View on GitHub →
                </a>
                {selectedAdvisory.cve_id && (
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${selectedAdvisory.cve_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-cyber-accent text-xs hover:underline"
                  >
                    View on NVD →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Advisory Detail Modal */}
      {selectedAdvisory && (
        <div className="lg:hidden fixed inset-0 z-50 bg-cyber-darker/95 overflow-auto">
          <div className="min-h-screen p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-mono text-cyber-accent">{selectedAdvisory.ghsa_id}</h2>
              <button
                onClick={() => setSelectedAdvisory(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="cyber-card space-y-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Summary</div>
                <div className="text-gray-300">{selectedAdvisory.summary}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">Severity</div>
                  <SeverityBadge severity={mapSeverity(selectedAdvisory.severity)} showLabel />
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Ecosystem</div>
                  <div className="text-gray-300 capitalize">{selectedAdvisory.ecosystem}</div>
                </div>
              </div>

              <div>
                <div className="text-gray-500 mb-1">Package</div>
                <div className="text-gray-300 font-mono">
                  {selectedAdvisory.package_name || '—'}
                </div>
              </div>

              {selectedAdvisory.vulnerable_versions && (
                <div>
                  <div className="text-gray-500 mb-1">Vulnerable</div>
                  <div className="text-red-400 font-mono text-sm">
                    {selectedAdvisory.vulnerable_versions}
                  </div>
                </div>
              )}

              {selectedAdvisory.patched_versions && (
                <div>
                  <div className="text-gray-500 mb-1">Patched</div>
                  <div className="text-green-400 font-mono text-sm">
                    {selectedAdvisory.patched_versions}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 space-y-2">
                <a
                  href={
                    selectedAdvisory.source_url ||
                    `https://github.com/advisories/${selectedAdvisory.ghsa_id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-cyber-accent hover:underline"
                >
                  View on GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
