// Event detail panel component for unified events timeline
// Shows context-aware details based on event type
import { Link } from 'react-router-dom'
import { EventTypeBadge, getEventTypeConfig } from '../EventTypeBadge'
import { SeverityBadge } from '../SeverityBadge'
import { SmartTime } from '../TimeDisplay'

export function EventDetailPanel({ event, onClose, isMobile = false }) {
  if (!event) return null

  const config = getEventTypeConfig(event.event_type)

  return (
    <div
      className={`${isMobile ? 'w-full' : 'w-80'} cyber-card flex-shrink-0 overflow-y-auto ${isMobile ? 'max-h-none' : 'max-h-[calc(100vh-12rem)]'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <EventTypeBadge type={event.event_type} size="sm" className="mb-2" />
          <h3
            className={`font-semibold text-white ${isMobile ? 'text-base' : 'text-lg truncate'}`}
            title={event.title}
          >
            {event.title}
          </h3>
          {event.subtitle && (
            <p className={`text-sm text-gray-400 ${isMobile ? '' : 'truncate'}`}>
              {event.subtitle}
            </p>
          )}
        </div>
        {!isMobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Common fields */}
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-gray-500 mb-1">Severity</div>
            <SeverityBadge severity={event.severity} showLabel />
          </div>
          <div>
            <div className="text-gray-500 mb-1">Time</div>
            <SmartTime date={event.timestamp} className="text-gray-300" />
          </div>
        </div>

        {/* Type-specific details */}
        {event.event_type === 'ransomware' && <RansomwareDetails event={event} />}
        {event.event_type === 'alert' && <AlertDetails event={event} />}
        {event.event_type === 'vulnerability' && <VulnerabilityDetails event={event} />}
        {event.event_type === 'ioc' && <IOCDetails event={event} />}
        {event.event_type === 'malware' && <MalwareDetails event={event} />}
        {event.event_type === 'breach' && <BreachDetails event={event} />}

        {/* Source link */}
        {event.source_url && (
          <div className="pt-4 border-t border-gray-800">
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
            >
              View source
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function RansomwareDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      {event.actor_name && (
        <div>
          <div className="text-gray-500 mb-1">Threat Actor</div>
          <Link
            to={`/actors?search=${encodeURIComponent(event.actor_name)}`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            {event.actor_name}
          </Link>
        </div>
      )}
      {event.sector && (
        <div>
          <div className="text-gray-500 mb-1">Sector</div>
          <div className="text-gray-300 capitalize">{event.sector}</div>
        </div>
      )}
      {event.country && (
        <div>
          <div className="text-gray-500 mb-1">Country</div>
          <div className="text-gray-300">{event.country}</div>
        </div>
      )}
      {event.status && (
        <div>
          <div className="text-gray-500 mb-1">Status</div>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              event.status === 'leaked'
                ? 'bg-red-500/20 text-red-400'
                : event.status === 'confirmed'
                  ? 'bg-orange-500/20 text-orange-400'
                  : event.status === 'claimed'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {event.status}
          </span>
        </div>
      )}
      {raw.ransom_amount && (
        <div>
          <div className="text-gray-500 mb-1">Ransom Demand</div>
          <div className="text-gray-300">
            {raw.ransom_currency || '$'}
            {Number(raw.ransom_amount).toLocaleString()}
          </div>
        </div>
      )}
    </>
  )
}

function AlertDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      {raw.category && (
        <div>
          <div className="text-gray-500 mb-1">Category</div>
          <div className="text-gray-300">{raw.category}</div>
        </div>
      )}
      {raw.cve_ids?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Related CVEs</div>
          <div className="flex flex-wrap gap-1">
            {raw.cve_ids.slice(0, 5).map((cve) => (
              <Link
                key={cve}
                to={`/vulnerabilities?search=${cve}`}
                className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded"
              >
                {cve}
              </Link>
            ))}
            {raw.cve_ids.length > 5 && (
              <span className="text-xs text-gray-500">+{raw.cve_ids.length - 5} more</span>
            )}
          </div>
        </div>
      )}
      {raw.description && (
        <div>
          <div className="text-gray-500 mb-1">Description</div>
          <div className="text-gray-300 text-xs line-clamp-4">{raw.description}</div>
        </div>
      )}
    </>
  )
}

function VulnerabilityDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      {event.cvss_score !== undefined && (
        <div>
          <div className="text-gray-500 mb-1">CVSS Score</div>
          <SeverityBadge score={event.cvss_score} showScore showLabel />
        </div>
      )}
      {raw.kev_date && (
        <div>
          <div className="text-gray-500 mb-1">Added to KEV</div>
          <SmartTime date={raw.kev_date} className="text-gray-300" />
        </div>
      )}
      {raw.kev_due_date && (
        <div>
          <div className="text-gray-500 mb-1">Remediation Due</div>
          <SmartTime date={raw.kev_due_date} className="text-gray-300" />
        </div>
      )}
      {raw.affected_products?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Affected Products</div>
          <div className="text-gray-300 text-xs">
            {raw.affected_products.slice(0, 3).join(', ')}
            {raw.affected_products.length > 3 && ` +${raw.affected_products.length - 3} more`}
          </div>
        </div>
      )}
      {raw.description && (
        <div>
          <div className="text-gray-500 mb-1">Description</div>
          <div className="text-gray-300 text-xs line-clamp-4">{raw.description}</div>
        </div>
      )}
    </>
  )
}

function IOCDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      <div>
        <div className="text-gray-500 mb-1">Value</div>
        <div className="text-gray-300 font-mono text-xs break-all bg-gray-800 p-2 rounded">
          {raw.value}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-500 mb-1">Type</div>
          <div className="text-gray-300">{raw.type}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Confidence</div>
          <div className="text-gray-300 capitalize">{raw.confidence || 'Unknown'}</div>
        </div>
      </div>
      {raw.malware_family && (
        <div>
          <div className="text-gray-500 mb-1">Malware Family</div>
          <div className="text-gray-300">{raw.malware_family}</div>
        </div>
      )}
      {event.actor_name && (
        <div>
          <div className="text-gray-500 mb-1">Associated Actor</div>
          <Link
            to={`/actors?search=${encodeURIComponent(event.actor_name)}`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            {event.actor_name}
          </Link>
        </div>
      )}
      {raw.source && (
        <div>
          <div className="text-gray-500 mb-1">Source</div>
          <div className="text-gray-300">{raw.source}</div>
        </div>
      )}
    </>
  )
}

function MalwareDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      {raw.signature && (
        <div>
          <div className="text-gray-500 mb-1">Family/Signature</div>
          <div className="text-gray-300">{raw.signature}</div>
        </div>
      )}
      {raw.sha256 && (
        <div>
          <div className="text-gray-500 mb-1">SHA256</div>
          <div className="text-gray-300 font-mono text-xs break-all bg-gray-800 p-2 rounded">
            {raw.sha256}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {raw.file_type && (
          <div>
            <div className="text-gray-500 mb-1">File Type</div>
            <div className="text-gray-300">{raw.file_type}</div>
          </div>
        )}
        {raw.file_size && (
          <div>
            <div className="text-gray-500 mb-1">Size</div>
            <div className="text-gray-300">{formatBytes(raw.file_size)}</div>
          </div>
        )}
      </div>
      {raw.filename && (
        <div>
          <div className="text-gray-500 mb-1">Filename</div>
          <div className="text-gray-300 text-xs truncate">{raw.filename}</div>
        </div>
      )}
      {raw.tags?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {raw.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function BreachDetails({ event }) {
  const raw = event.raw || {}
  return (
    <>
      {event.pwn_count && (
        <div>
          <div className="text-gray-500 mb-1">Accounts Compromised</div>
          <div className="text-2xl font-bold text-white">{event.pwn_count.toLocaleString()}</div>
        </div>
      )}
      {raw.domain && (
        <div>
          <div className="text-gray-500 mb-1">Domain</div>
          <div className="text-gray-300">{raw.domain}</div>
        </div>
      )}
      {raw.data_classes?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Data Exposed</div>
          <div className="flex flex-wrap gap-1">
            {raw.data_classes.slice(0, 6).map((dc) => (
              <span
                key={dc}
                className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded"
              >
                {dc}
              </span>
            ))}
            {raw.data_classes.length > 6 && (
              <span className="text-xs text-gray-500">+{raw.data_classes.length - 6} more</span>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-500 mb-1">Verified</div>
          <div className={raw.is_verified ? 'text-green-400' : 'text-gray-400'}>
            {raw.is_verified ? 'Yes' : 'No'}
          </div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Sensitive</div>
          <div className={raw.is_sensitive ? 'text-red-400' : 'text-gray-400'}>
            {raw.is_sensitive ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
      {raw.description && (
        <div>
          <div className="text-gray-500 mb-1">Description</div>
          <div className="text-gray-300 text-xs line-clamp-4">{raw.description}</div>
        </div>
      )}
    </>
  )
}

function formatBytes(bytes) {
  if (!bytes) return 'Unknown'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export default EventDetailPanel
