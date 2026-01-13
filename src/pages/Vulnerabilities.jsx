import { useState, useEffect } from 'react'
import { vulnerabilities } from '../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyVulnerabilities } from '../components/EmptyState'
import { SeverityBadge, SeverityBar, EPSSBadge } from '../components/SeverityBadge'
import { NewBadge } from '../components/NewIndicator'

export default function Vulnerabilities() {
  const [vulnList, setVulnList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, critical, ransomware
  const [selectedVuln, setSelectedVuln] = useState(null)

  useEffect(() => {
    loadVulnerabilities()
  }, [filter])

  async function loadVulnerabilities() {
    setLoading(true)
    try {
      let data, error

      if (filter === 'critical') {
        const result = await vulnerabilities.getCritical(9.0)
        data = result.data
        error = result.error
      } else {
        const result = await vulnerabilities.getKEV({ limit: 100 })
        data = result.data
        error = result.error

        if (filter === 'ransomware' && data) {
          data = data.filter((v) => v.ransomware_campaign_use)
        }
      }

      if (error) throw error
      setVulnList(data || [])
    } catch (error) {
      console.error('Error loading vulnerabilities:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Known Exploited Vulnerabilities</h1>
        <p className="text-gray-400 text-sm mt-1">
          CISA KEV catalog - actively exploited vulnerabilities
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All KEVs' },
          { key: 'critical', label: 'Critical (9.0+)' },
          { key: 'ransomware', label: 'Ransomware' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-sm ${
              filter === f.key
                ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cyber-card">
          <div className="text-2xl font-bold text-white">{vulnList.length}</div>
          <div className="text-sm text-gray-400">Total KEVs</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-red-400">
            {vulnList.filter((v) => v.cvss_score >= 9).length}
          </div>
          <div className="text-sm text-gray-400">Critical</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-orange-400">
            {vulnList.filter((v) => v.ransomware_campaign_use).length}
          </div>
          <div className="text-sm text-gray-400">Ransomware</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-yellow-400">
            {vulnList.filter((v) => {
              if (!v.kev_due_date) return false
              return new Date(v.kev_due_date) < new Date()
            }).length}
          </div>
          <div className="text-sm text-gray-400">Past Due</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Vuln List */}
        <div className="flex-1">
          {loading ? (
            <SkeletonTable rows={8} cols={4} />
          ) : vulnList.length === 0 ? (
            <EmptyVulnerabilities />
          ) : (
            <div className="cyber-card overflow-hidden">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>CVE ID</th>
                    <th className="hidden md:table-cell">Vendor</th>
                    <th>CVSS</th>
                    <th className="hidden md:table-cell">KEV Added</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {vulnList.map((vuln) => (
                    <tr
                      key={vuln.cve_id}
                      onClick={() => setSelectedVuln(vuln)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyber-accent">{vuln.cve_id}</span>
                          <NewBadge date={vuln.kev_date} thresholdHours={72} />
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {vuln.description?.slice(0, 60)}...
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-sm text-gray-400">
                        {vuln.affected_vendors?.[0] || 'Unknown'}
                      </td>
                      <td>
                        <div className="space-y-1">
                          <SeverityBadge score={vuln.cvss_score} />
                          <SeverityBar score={vuln.cvss_score} className="w-16" />
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-sm text-gray-400">
                        {vuln.kev_date
                          ? formatDistanceToNow(new Date(vuln.kev_date), { addSuffix: true })
                          : 'Unknown'}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {vuln.ransomware_campaign_use && (
                            <span className="badge-critical">RW</span>
                          )}
                          {vuln.kev_due_date && new Date(vuln.kev_due_date) < new Date() && (
                            <span className="badge-high">OVERDUE</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedVuln && (
          <div className="w-96 cyber-card hidden lg:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-mono text-cyber-accent">{selectedVuln.cve_id}</h3>
              <button
                onClick={() => setSelectedVuln(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Description</div>
                <div className="text-gray-300 text-xs">{selectedVuln.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">CVSS Score</div>
                  <SeverityBadge score={selectedVuln.cvss_score} showLabel />
                </div>
                {selectedVuln.epss_score && (
                  <div>
                    <div className="text-gray-500 mb-1">EPSS</div>
                    <EPSSBadge score={selectedVuln.epss_score} percentile={selectedVuln.epss_percentile} />
                  </div>
                )}
              </div>

              {selectedVuln.affected_vendors?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Affected Vendors</div>
                  <div className="text-gray-300">
                    {selectedVuln.affected_vendors.join(', ')}
                  </div>
                </div>
              )}

              {selectedVuln.affected_products?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Affected Products</div>
                  <div className="text-gray-300">
                    {selectedVuln.affected_products.join(', ')}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">KEV Added</div>
                  <div className="text-gray-300">
                    {selectedVuln.kev_date
                      ? format(new Date(selectedVuln.kev_date), 'PP')
                      : 'Unknown'}
                  </div>
                </div>
                {selectedVuln.kev_due_date && (
                  <div>
                    <div className="text-gray-500 mb-1">Due Date</div>
                    <div
                      className={
                        new Date(selectedVuln.kev_due_date) < new Date()
                          ? 'text-red-400'
                          : 'text-gray-300'
                      }
                    >
                      {format(new Date(selectedVuln.kev_due_date), 'PP')}
                    </div>
                  </div>
                )}
              </div>

              {selectedVuln.ransomware_campaign_use && (
                <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
                  <div className="text-red-400 text-xs font-medium">
                    Known Ransomware Campaign Use
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 space-y-2">
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-cyber-accent text-xs hover:underline"
                >
                  View on NVD →
                </a>
                <a
                  href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-cyber-accent text-xs hover:underline"
                >
                  CISA KEV Catalog →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
