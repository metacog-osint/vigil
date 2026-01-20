import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

// Enrichment data display for IOCs
// Shows data from IP Reputation, Shodan InternetDB, VirusTotal, and HybridAnalysis

// Reputation level styling
const REPUTATION_LEVELS = {
  malicious: {
    label: 'Malicious',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    barColor: 'bg-red-500',
  },
  suspicious: {
    label: 'Suspicious',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    barColor: 'bg-orange-500',
  },
  risky: {
    label: 'Risky',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    barColor: 'bg-yellow-500',
  },
  low_risk: {
    label: 'Low Risk',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    barColor: 'bg-green-500',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    barColor: 'bg-gray-500',
  },
}

function ReputationSection({ ioc }) {
  if (!ioc?.reputation_score && ioc?.reputation_score !== 0) return null

  const level = ioc.reputation_level || 'unknown'
  const score = ioc.reputation_score || 0
  const factors = ioc.reputation_factors || []
  const config = REPUTATION_LEVELS[level] || REPUTATION_LEVELS.unknown

  return (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold ${config.color}`}>IP REPUTATION</span>
        <span className={`px-2 py-0.5 rounded text-xs ${config.bgColor} ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Risk Score</span>
          <span className={`text-sm font-bold ${config.color}`}>{score}/100</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} transition-all`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Contributing factors */}
      {factors.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 block mb-2">Contributing Sources:</span>
          <div className="space-y-1">
            {factors.slice(0, 6).map((factor, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 capitalize">
                  {factor.source?.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-2">
                  {factor.type && <span className="text-gray-500">{factor.type}</span>}
                  <span
                    className={
                      factor.score >= 15
                        ? 'text-red-400'
                        : factor.score >= 10
                          ? 'text-orange-400'
                          : 'text-gray-400'
                    }
                  >
                    +{factor.score}
                  </span>
                </div>
              </div>
            ))}
            {factors.length > 6 && (
              <span className="text-xs text-gray-500">+{factors.length - 6} more sources</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ShodanSection({ metadata }) {
  if (!metadata?.shodan_checked) return null

  const found = metadata.shodan_found
  const ports = metadata.shodan_ports || []
  const vulns = metadata.shodan_vulns || []
  const hostnames = metadata.shodan_hostnames || []
  const tags = metadata.shodan_tags || []

  return (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-orange-400">SHODAN</span>
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(metadata.shodan_checked), { addSuffix: true })}
        </span>
      </div>

      {!found ? (
        <p className="text-xs text-gray-500">Not found in Shodan InternetDB</p>
      ) : (
        <div className="space-y-2">
          {ports.length > 0 && (
            <div>
              <span className="text-xs text-gray-400">Open Ports: </span>
              <span className="text-xs text-white font-mono">
                {ports.slice(0, 10).join(', ')}
                {ports.length > 10 && ` +${ports.length - 10} more`}
              </span>
            </div>
          )}

          {vulns.length > 0 && (
            <div>
              <span className="text-xs text-gray-400">Vulnerabilities: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {vulns.slice(0, 5).map((v) => (
                  <a
                    key={v}
                    href={`https://nvd.nist.gov/vuln/detail/${v}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge-critical text-xs hover:underline"
                  >
                    {v}
                  </a>
                ))}
                {vulns.length > 5 && (
                  <span className="text-xs text-gray-500">+{vulns.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {hostnames.length > 0 && (
            <div>
              <span className="text-xs text-gray-400">Hostnames: </span>
              <span className="text-xs text-white font-mono">
                {hostnames.slice(0, 3).join(', ')}
              </span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="badge-info text-xs">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VirusTotalSection({ metadata, iocType, iocValue }) {
  if (!metadata?.vt_checked) return null

  const found = metadata.vt_found
  const malicious = metadata.vt_malicious || 0
  const suspicious = metadata.vt_suspicious || 0
  const total = metadata.vt_total || 0

  const getMaliciousColor = (count) => {
    if (count === 0) return 'text-green-400'
    if (count < 5) return 'text-yellow-400'
    if (count < 15) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-blue-400">VIRUSTOTAL</span>
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(metadata.vt_checked), { addSuffix: true })}
        </span>
        {metadata.vt_link && (
          <a
            href={metadata.vt_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyber-accent hover:underline ml-auto"
          >
            View Report
          </a>
        )}
      </div>

      {!found ? (
        <p className="text-xs text-gray-500">Not found in VirusTotal</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400">Detection: </span>
              <span className={`text-sm font-bold ${getMaliciousColor(malicious)}`}>
                {malicious}/{total}
              </span>
              {suspicious > 0 && (
                <span className="text-xs text-yellow-400 ml-2">({suspicious} suspicious)</span>
              )}
            </div>
          </div>

          {metadata.vt_popular_threat_label && (
            <div>
              <span className="text-xs text-gray-400">Threat: </span>
              <span className="text-xs text-red-400 font-medium">
                {metadata.vt_popular_threat_label}
              </span>
            </div>
          )}

          {metadata.vt_type_description && (
            <div>
              <span className="text-xs text-gray-400">Type: </span>
              <span className="text-xs text-white">{metadata.vt_type_description}</span>
            </div>
          )}

          {metadata.vt_country && (
            <div>
              <span className="text-xs text-gray-400">Country: </span>
              <span className="text-xs text-white">{metadata.vt_country}</span>
              {metadata.vt_as_owner && (
                <span className="text-xs text-gray-400"> ({metadata.vt_as_owner})</span>
              )}
            </div>
          )}

          {metadata.vt_names && metadata.vt_names.length > 0 && (
            <div>
              <span className="text-xs text-gray-400">Names: </span>
              <span className="text-xs text-white font-mono">
                {metadata.vt_names.slice(0, 3).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HybridAnalysisSection({ metadata }) {
  if (!metadata?.ha_checked) return null

  const found = metadata.ha_found
  const verdict = metadata.ha_verdict
  const threatScore = metadata.ha_threat_score

  const getVerdictColor = (v) => {
    if (v === 'malicious') return 'text-red-400'
    if (v === 'suspicious') return 'text-orange-400'
    if (v === 'whitelisted') return 'text-green-400'
    return 'text-gray-400'
  }

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-red-400'
    if (score >= 30) return 'text-orange-400'
    return 'text-green-400'
  }

  return (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-purple-400">HYBRID ANALYSIS</span>
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(metadata.ha_checked), { addSuffix: true })}
        </span>
        {metadata.ha_link && (
          <a
            href={metadata.ha_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyber-accent hover:underline ml-auto"
          >
            View Report
          </a>
        )}
      </div>

      {!found ? (
        <p className="text-xs text-gray-500">Not found in Hybrid Analysis</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            {verdict && (
              <div>
                <span className="text-xs text-gray-400">Verdict: </span>
                <span className={`text-xs font-bold uppercase ${getVerdictColor(verdict)}`}>
                  {verdict}
                </span>
              </div>
            )}

            {threatScore !== undefined && (
              <div>
                <span className="text-xs text-gray-400">Threat Score: </span>
                <span className={`text-sm font-bold ${getScoreColor(threatScore)}`}>
                  {threatScore}/100
                </span>
              </div>
            )}
          </div>

          {metadata.ha_vx_family && (
            <div>
              <span className="text-xs text-gray-400">Malware Family: </span>
              <span className="text-xs text-red-400 font-medium">{metadata.ha_vx_family}</span>
            </div>
          )}

          {metadata.ha_type && (
            <div>
              <span className="text-xs text-gray-400">File Type: </span>
              <span className="text-xs text-white">{metadata.ha_type}</span>
            </div>
          )}

          {metadata.ha_filename && (
            <div>
              <span className="text-xs text-gray-400">Filename: </span>
              <span className="text-xs text-white font-mono">{metadata.ha_filename}</span>
            </div>
          )}

          {metadata.ha_tags && metadata.ha_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {metadata.ha_tags.slice(0, 5).map((t) => (
                <span key={t} className="badge-info text-xs">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EnrichmentPanel({ ioc, onEnrich, isEnriching }) {
  const [expanded, setExpanded] = useState(false)
  const metadata = ioc?.metadata || {}

  const hasReputation = ioc?.reputation_score !== undefined && ioc?.reputation_score !== null
  const hasEnrichment =
    metadata.shodan_checked || metadata.vt_checked || metadata.ha_checked || hasReputation

  // Determine which enrichments are available based on IOC type
  const iocType = ioc?.type
  const canEnrichShodan = iocType === 'ip'
  const canEnrichVT = ['ip', 'domain', 'sha256', 'sha1', 'md5', 'hash_sha256', 'hash_md5'].includes(
    iocType
  )
  const canEnrichHA = ['sha256', 'sha1', 'md5', 'hash_sha256', 'hash_md5', 'hash_sha1'].includes(
    iocType
  )

  if (!hasEnrichment && !onEnrich) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium">Enrichment Data</span>
          {hasEnrichment && (
            <span className="badge-info text-xs">
              {[
                hasReputation && 'Reputation',
                metadata.shodan_checked && 'Shodan',
                metadata.vt_checked && 'VT',
                metadata.ha_checked && 'HA',
              ]
                .filter(Boolean)
                .join(' + ')}
            </span>
          )}
        </button>

        {onEnrich && (
          <button
            onClick={() => onEnrich(ioc)}
            disabled={isEnriching}
            className="text-xs text-cyber-accent hover:underline disabled:opacity-50"
          >
            {isEnriching ? 'Enriching...' : 'Refresh'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2">
          {!hasEnrichment ? (
            <p className="text-xs text-gray-500 py-2">
              No enrichment data available yet.
              {onEnrich && ' Click Refresh to fetch enrichment data.'}
            </p>
          ) : (
            <>
              {hasReputation && <ReputationSection ioc={ioc} />}
              {canEnrichShodan && <ShodanSection metadata={metadata} />}
              {canEnrichVT && (
                <VirusTotalSection metadata={metadata} iocType={iocType} iocValue={ioc?.value} />
              )}
              {canEnrichHA && <HybridAnalysisSection metadata={metadata} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function EnrichmentBadges({ metadata, ioc }) {
  const badges = []

  // IP Reputation badge
  if (ioc?.reputation_score !== undefined && ioc?.reputation_score !== null) {
    const score = ioc.reputation_score
    const level = ioc.reputation_level || 'unknown'
    const config = REPUTATION_LEVELS[level] || REPUTATION_LEVELS.unknown
    if (score > 0 || level !== 'unknown') {
      badges.push({
        label: `Risk: ${score}`,
        color:
          level === 'malicious'
            ? 'badge-critical'
            : level === 'suspicious'
              ? 'badge-high'
              : level === 'risky'
                ? 'badge-medium'
                : 'badge-info',
        title: `${config.label} - IP reputation score based on ${(ioc.reputation_factors || []).length} sources`,
      })
    }
  }

  if (!metadata) {
    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-1">
        {badges.map((badge, i) => (
          <span key={i} className={`${badge.color} text-xs`} title={badge.title}>
            {badge.label}
          </span>
        ))}
      </div>
    ) : null
  }

  // Shodan badges
  if (metadata.shodan_vulns?.length > 0) {
    badges.push({
      label: `${metadata.shodan_vulns.length} CVEs`,
      color: 'badge-critical',
      title: metadata.shodan_vulns.slice(0, 5).join(', '),
    })
  }

  // VirusTotal badges
  if (metadata.vt_checked && metadata.vt_found) {
    const malicious = metadata.vt_malicious || 0
    if (malicious > 0) {
      badges.push({
        label: `VT ${malicious}/${metadata.vt_total || 0}`,
        color: malicious > 10 ? 'badge-critical' : malicious > 3 ? 'badge-high' : 'badge-medium',
        title: metadata.vt_popular_threat_label || 'VirusTotal detections',
      })
    }
  }

  // HybridAnalysis badges
  if (metadata.ha_verdict === 'malicious') {
    badges.push({
      label: 'Malicious',
      color: 'badge-critical',
      title: metadata.ha_vx_family || 'Hybrid Analysis verdict',
    })
  } else if (metadata.ha_threat_score >= 70) {
    badges.push({
      label: `HA ${metadata.ha_threat_score}/100`,
      color: 'badge-high',
      title: 'Hybrid Analysis threat score',
    })
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, i) => (
        <span key={i} className={`${badge.color} text-xs`} title={badge.title}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}

export default EnrichmentPanel
