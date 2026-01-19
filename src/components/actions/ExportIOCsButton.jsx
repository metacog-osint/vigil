/**
 * ExportIOCsButton Component
 *
 * One-click button to export IOCs associated with an entity.
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { iocs } from '../../lib/supabase'

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV', extension: 'csv' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'stix', label: 'STIX 2.1', extension: 'json' },
  { id: 'txt', label: 'Plain Text', extension: 'txt' },
]

export function ExportIOCsButton({
  entityType, // 'actor', 'incident', 'campaign'
  entityId,
  entityName,
  className = '',
  size = 'md',
  showLabel = false,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [exportCount, setExportCount] = useState(null)

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const buttonSizes = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  }

  // Fetch IOC count when dropdown opens
  const handleOpen = async () => {
    setIsOpen(!isOpen)
    if (!isOpen && exportCount === null) {
      try {
        const { count } = await iocs.getByEntity(entityType, entityId, { count: true })
        setExportCount(count || 0)
      } catch {
        setExportCount(0)
      }
    }
  }

  // Export IOCs in specified format
  const handleExport = async (format) => {
    setIsLoading(true)
    try {
      const { data } = await iocs.getByEntity(entityType, entityId)

      if (!data || data.length === 0) {
        alert('No IOCs found to export')
        return
      }

      let content, mimeType
      const filename = `iocs_${entityName || entityId}_${new Date().toISOString().split('T')[0]}.${format.extension}`

      switch (format.id) {
        case 'csv':
          content = convertToCSV(data)
          mimeType = 'text/csv'
          break
        case 'json':
          content = JSON.stringify(data, null, 2)
          mimeType = 'application/json'
          break
        case 'stix':
          content = JSON.stringify(convertToSTIX(data), null, 2)
          mimeType = 'application/json'
          break
        case 'txt':
          content = data.map(ioc => ioc.value).join('\n')
          mimeType = 'text/plain'
          break
        default:
          content = JSON.stringify(data, null, 2)
          mimeType = 'application/json'
      }

      // Trigger download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setIsOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export IOCs')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        disabled={isLoading}
        className={clsx(
          'text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50',
          buttonSizes[size],
          className
        )}
        title="Export IOCs"
        aria-label="Export IOCs"
        aria-expanded={isOpen}
      >
        {isLoading ? (
          <svg className={clsx(sizes[size], 'animate-spin')} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className={sizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        {showLabel && <span className="ml-1.5 text-sm">Export</span>}
      </button>

      {/* Format Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]">
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs text-gray-500">
                {exportCount !== null ? `${exportCount} IOCs available` : 'Loading...'}
              </span>
            </div>
            {EXPORT_FORMATS.map((format) => (
              <button
                key={format.id}
                onClick={() => handleExport(format)}
                disabled={isLoading || exportCount === 0}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{format.label}</span>
                <span className="text-xs text-gray-500">.{format.extension}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Helper: Convert IOC data to CSV
function convertToCSV(data) {
  const headers = ['type', 'value', 'confidence', 'first_seen', 'last_seen', 'tags']
  const rows = data.map(ioc => [
    ioc.type,
    ioc.value,
    ioc.confidence || '',
    ioc.first_seen || '',
    ioc.last_seen || '',
    (ioc.tags || []).join(';'),
  ])
  return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
}

// Helper: Convert IOC data to STIX 2.1 format
function convertToSTIX(data) {
  const stixTypeMap = {
    ip: 'ipv4-addr',
    ipv4: 'ipv4-addr',
    ipv6: 'ipv6-addr',
    domain: 'domain-name',
    url: 'url',
    md5: 'file',
    sha1: 'file',
    sha256: 'file',
    email: 'email-addr',
  }

  const objects = data.map(ioc => {
    const stixType = stixTypeMap[ioc.type?.toLowerCase()] || 'indicator'

    if (stixType === 'file') {
      return {
        type: 'file',
        id: `file--${crypto.randomUUID()}`,
        hashes: { [ioc.type.toUpperCase()]: ioc.value },
      }
    }

    return {
      type: stixType,
      id: `${stixType}--${crypto.randomUUID()}`,
      value: ioc.value,
    }
  })

  return {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects,
  }
}

export default ExportIOCsButton
