// IOC Quick Lookup Card - Rich display for IOC search results with enrichment links
import { clsx } from 'clsx'
import { iocs } from '../lib/supabase'

const TYPE_COLORS = {
  ip: 'text-orange-400 bg-orange-500/20',
  hash_sha256: 'text-purple-400 bg-purple-500/20',
  hash_sha1: 'text-purple-400 bg-purple-500/20',
  hash_md5: 'text-purple-400 bg-purple-500/20',
  hash: 'text-purple-400 bg-purple-500/20',
  domain: 'text-blue-400 bg-blue-500/20',
  url: 'text-cyan-400 bg-cyan-500/20',
  cve: 'text-red-400 bg-red-500/20',
  email: 'text-green-400 bg-green-500/20',
  unknown: 'text-gray-400 bg-gray-500/20',
}

const CONFIDENCE_COLORS = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
}

function TypeBadge({ type }) {
  const displayType = type?.replace('hash_', '').toUpperCase() || 'UNKNOWN'
  return (
    <span className={clsx(
      'px-2 py-0.5 text-xs font-mono rounded',
      TYPE_COLORS[type] || TYPE_COLORS.unknown
    )}>
      {displayType}
    </span>
  )
}

function EnrichmentLinks({ value, type }) {
  const links = iocs.getEnrichmentLinks(value, type)

  if (links.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {link.name}
        </a>
      ))}
    </div>
  )
}

function CopyButton({ value }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-500 hover:text-white transition-colors"
      title="Copy to clipboard"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  )
}

export function IOCQuickLookupCard({ data, type, onNavigate }) {
  const { iocs: iocResults = [], malware = [], vulnerabilities = [], found } = data

  if (!found) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>No matches found in database</p>
        <EnrichmentLinks value={data.searchValue} type={type} />
      </div>
    )
  }

  const primaryResult = iocResults[0] || malware[0] || vulnerabilities[0]

  return (
    <div className="space-y-4">
      {/* Primary Result */}
      {primaryResult && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <TypeBadge type={primaryResult.type || type} />
                {primaryResult.confidence && (
                  <span className={clsx(
                    'text-xs',
                    CONFIDENCE_COLORS[primaryResult.confidence] || 'text-gray-400'
                  )}>
                    {primaryResult.confidence} confidence
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-white break-all">
                  {primaryResult.value || primaryResult.sha256 || primaryResult.cve_id}
                </code>
                <CopyButton value={primaryResult.value || primaryResult.sha256 || primaryResult.cve_id} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {primaryResult.malware_family && (
              <div>
                <span className="text-gray-500">Malware:</span>
                <span className="ml-1 text-white">{primaryResult.malware_family}</span>
              </div>
            )}
            {primaryResult.threat_actor && (
              <div>
                <span className="text-gray-500">Actor:</span>
                <span className="ml-1 text-cyber-accent">{primaryResult.threat_actor.name}</span>
                {primaryResult.threat_actor.trend_status === 'ESCALATING' && (
                  <span className="ml-1 text-red-400">(Escalating)</span>
                )}
              </div>
            )}
            {primaryResult.source && (
              <div>
                <span className="text-gray-500">Source:</span>
                <span className="ml-1 text-white">{primaryResult.source}</span>
              </div>
            )}
            {primaryResult.first_seen && (
              <div>
                <span className="text-gray-500">First seen:</span>
                <span className="ml-1 text-white">{new Date(primaryResult.first_seen).toLocaleDateString()}</span>
              </div>
            )}
            {primaryResult.last_seen && (
              <div>
                <span className="text-gray-500">Last seen:</span>
                <span className="ml-1 text-white">{new Date(primaryResult.last_seen).toLocaleDateString()}</span>
              </div>
            )}
            {primaryResult.cvss_score && (
              <div>
                <span className="text-gray-500">CVSS:</span>
                <span className={clsx(
                  'ml-1 font-bold',
                  primaryResult.cvss_score >= 9 ? 'text-red-400' :
                  primaryResult.cvss_score >= 7 ? 'text-orange-400' :
                  primaryResult.cvss_score >= 4 ? 'text-yellow-400' : 'text-green-400'
                )}>{primaryResult.cvss_score}</span>
              </div>
            )}
          </div>

          {/* Enrichment Links */}
          <EnrichmentLinks
            value={primaryResult.value || primaryResult.sha256 || primaryResult.cve_id}
            type={primaryResult.type || type}
          />
        </div>
      )}

      {/* Additional Results */}
      {iocResults.length > 1 && (
        <div className="text-xs text-gray-500">
          + {iocResults.length - 1} more result(s) found
        </div>
      )}

      {/* Related Malware Samples */}
      {malware.length > 0 && iocResults.length === 0 && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
          <div className="text-xs text-purple-400 mb-1">Malware Sample Match</div>
          <div className="text-sm text-white">
            {malware[0].signature || 'Unknown malware'}
          </div>
        </div>
      )}

      {/* Related CVEs */}
      {vulnerabilities.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
          <div className="text-xs text-red-400 mb-1">Vulnerability</div>
          <div className="text-sm text-white">
            {vulnerabilities[0].cve_id} - CVSS {vulnerabilities[0].cvss_score || 'N/A'}
          </div>
          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
            {vulnerabilities[0].description}
          </div>
        </div>
      )}
    </div>
  )
}

export default IOCQuickLookupCard
