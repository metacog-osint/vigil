/**
 * IOC Search Content - used within the unified IOCs page
 * Supports demo mode with mock data
 */
import { useState, useEffect } from 'react'
import { iocs } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import {
  SkeletonList,
  EmptyIOCs,
  ExportButton,
  EnrichmentPanel,
  EnrichmentBadges,
} from '../../components'
import { useDemo } from '../../contexts/DemoContext'
import useDemoData from '../../hooks/useDemoData'

const IOC_TYPES = [
  { key: '', label: 'All Types' },
  { key: 'hash_sha256', label: 'SHA256' },
  { key: 'hash_md5', label: 'MD5' },
  { key: 'ip', label: 'IP Address' },
  { key: 'domain', label: 'Domain' },
  { key: 'url', label: 'URL' },
]

export default function IOCSearchContent() {
  const { isDemoMode } = useDemo()
  const demoData = useDemoData()

  const [searchValue, setSearchValue] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [results, setResults] = useState([])
  const [recentIOCs, setRecentIOCs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchValue.trim()) return

    setLoading(true)
    setSearched(true)

    // Demo mode: search mock IOCs
    if (isDemoMode) {
      const searchLower = searchValue.trim().toLowerCase()
      let filtered = demoData.iocs.filter(
        (ioc) =>
          ioc.value.toLowerCase().includes(searchLower) ||
          ioc.actor_name?.toLowerCase().includes(searchLower)
      )
      if (typeFilter) {
        filtered = filtered.filter((ioc) => ioc.type === typeFilter)
      }
      setResults(filtered)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await iocs.search(searchValue.trim(), typeFilter || null)
      if (error) throw error
      setResults(data || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRecentIOCs() {
    // Demo mode: use mock IOCs
    if (isDemoMode) {
      setRecentIOCs(demoData.iocs)
      return
    }

    try {
      const { data, error } = await iocs.getRecent(50)
      if (error) throw error
      setRecentIOCs(data || [])
    } catch (error) {
      console.error('Error loading recent IOCs:', error)
    }
  }

  useEffect(() => {
    loadRecentIOCs()
  }, [isDemoMode])

  const getTypeBadge = (type) => {
    switch (type) {
      case 'hash_sha256':
      case 'hash_md5':
      case 'hash_sha1':
        return 'badge-info'
      case 'ip':
        return 'badge-high'
      case 'domain':
        return 'badge-medium'
      case 'url':
        return 'badge-low'
      default:
        return 'badge-info'
    }
  }

  const getConfidenceBadge = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'badge-critical'
      case 'medium':
        return 'badge-medium'
      case 'low':
        return 'badge-low'
      default:
        return 'badge-info'
    }
  }

  const displayList = searched ? results : recentIOCs

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="cyber-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Enter hash, IP, domain, or URL..."
              className="cyber-input w-full font-mono"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="cyber-input"
          >
            {IOC_TYPES.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
          <button type="submit" className="cyber-button-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Examples: SHA256 hash, MD5 hash, IP address, domain name
        </div>
      </form>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {searched ? `Search Results (${results.length})` : `Recent IOCs (${recentIOCs.length})`}
          </h2>
          <ExportButton
            data={displayList}
            entityType="iocs"
            filename={searched ? 'vigil-ioc-search-results' : 'vigil-recent-iocs'}
          />
        </div>

        {loading ? (
          <SkeletonList items={5} />
        ) : displayList.length === 0 ? (
          <EmptyIOCs />
        ) : (
          <div className="space-y-2">
            {displayList.map((ioc) => (
              <div key={ioc.id} className="cyber-card">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={getTypeBadge(ioc.type)}>
                      {ioc.type.replace('hash_', '').toUpperCase()}
                    </span>
                    <span className={getConfidenceBadge(ioc.confidence)}>{ioc.confidence}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-white break-all">{ioc.value}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {ioc.malware_family && (
                        <span className="text-orange-400">{ioc.malware_family}</span>
                      )}
                      {ioc.threat_actor?.name && (
                        <span className="text-cyber-accent">{ioc.threat_actor.name}</span>
                      )}
                      {ioc.tags?.length > 0 && <span>{ioc.tags.slice(0, 3).join(', ')}</span>}
                    </div>
                    <EnrichmentBadges metadata={ioc.metadata} ioc={ioc} />
                  </div>

                  <div className="text-right text-xs text-gray-500">
                    <div>
                      First:{' '}
                      {ioc.first_seen
                        ? formatDistanceToNow(new Date(ioc.first_seen), { addSuffix: true })
                        : 'Unknown'}
                    </div>
                    <div>
                      Last:{' '}
                      {ioc.last_seen
                        ? formatDistanceToNow(new Date(ioc.last_seen), { addSuffix: true })
                        : 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                  {ioc.type.includes('hash') && (
                    <>
                      <a
                        href={`https://www.virustotal.com/gui/file/${ioc.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyber-accent hover:underline"
                      >
                        VirusTotal →
                      </a>
                      <a
                        href={`https://bazaar.abuse.ch/browse.php?search=${ioc.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyber-accent hover:underline"
                      >
                        MalwareBazaar →
                      </a>
                    </>
                  )}
                  {ioc.type === 'ip' && (
                    <>
                      <a
                        href={`https://www.abuseipdb.com/check/${ioc.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyber-accent hover:underline"
                      >
                        AbuseIPDB →
                      </a>
                      <a
                        href={`https://www.shodan.io/host/${ioc.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyber-accent hover:underline"
                      >
                        Shodan →
                      </a>
                    </>
                  )}
                  {ioc.type === 'domain' && (
                    <a
                      href={`https://www.virustotal.com/gui/domain/${ioc.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyber-accent hover:underline"
                    >
                      VirusTotal →
                    </a>
                  )}
                  {ioc.source_url && (
                    <a
                      href={ioc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:underline ml-auto"
                    >
                      Source: {ioc.source}
                    </a>
                  )}
                </div>

                <EnrichmentPanel ioc={ioc} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
