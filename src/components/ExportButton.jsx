// Export Button - Reusable export dropdown component
import { useState } from 'react'
import { clsx } from 'clsx'
import { exportToCSV, exportToJSON, exportToSTIX, exportConfigs } from '../lib/export'

const ICONS = {
  csv: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  json: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  stix: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
}

export function ExportButton({
  data = [],
  entityType = 'data',
  filename,
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const config = exportConfigs[entityType] || {}
  const baseFilename = filename || config.filename || `vigil-${entityType}`

  const handleExport = async (format) => {
    if (data.length === 0) {
      alert('No data to export')
      return
    }

    setIsExporting(true)
    setIsOpen(false)

    try {
      switch (format) {
        case 'csv':
          exportToCSV(data, baseFilename, config.columns)
          break
        case 'json':
          exportToJSON(data, baseFilename)
          break
        case 'stix':
          // Convert entity type from plural to singular
          const singularType = entityType.endsWith('s') ? entityType.slice(0, -1) : entityType
          exportToSTIX(data, singularType, { bundleName: baseFilename })
          break
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const exportOptions = [
    { format: 'csv', label: 'Export as CSV', icon: 'csv' },
    { format: 'json', label: 'Export as JSON', icon: 'json' },
  ]

  // Add STIX option for IOCs and actors
  if (entityType === 'iocs' || entityType === 'actors') {
    exportOptions.push({ format: 'stix', label: 'Export as STIX 2.1', icon: 'stix' })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || data.length === 0 || isExporting}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors',
          'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isExporting ? 'Exporting...' : 'Export'}
        <svg className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]">
            <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-800">
              {data.length} record{data.length !== 1 ? 's' : ''} selected
            </div>
            {exportOptions.map((option) => (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {ICONS[option.icon]}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Simple export button without dropdown
export function QuickExportButton({
  data = [],
  entityType = 'data',
  format = 'csv',
  filename,
  label,
  className = '',
}) {
  const [isExporting, setIsExporting] = useState(false)

  const config = exportConfigs[entityType] || {}
  const baseFilename = filename || config.filename || `vigil-${entityType}`

  const handleExport = async () => {
    if (data.length === 0) return

    setIsExporting(true)
    try {
      switch (format) {
        case 'csv':
          exportToCSV(data, baseFilename, config.columns)
          break
        case 'json':
          exportToJSON(data, baseFilename)
          break
        case 'stix':
          const singularType = entityType.endsWith('s') ? entityType.slice(0, -1) : entityType
          exportToSTIX(data, singularType, { bundleName: baseFilename })
          break
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0 || isExporting}
      className={clsx(
        'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
        'text-gray-400 hover:text-white hover:bg-gray-800',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      title={`Export as ${format.toUpperCase()}`}
    >
      {ICONS[format]}
      {label || format.toUpperCase()}
    </button>
  )
}

export default ExportButton
