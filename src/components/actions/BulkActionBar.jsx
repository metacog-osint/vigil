/**
 * BulkActionBar Component
 *
 * Floating action bar for bulk operations on selected items.
 */
import { useState } from 'react'
import { clsx } from 'clsx'

export function BulkActionBar({
  selectedIds = [],
  entityType, // 'actors', 'incidents', 'iocs', 'vulnerabilities'
  onClear,
  onExport,
  onAddToWatchlist,
  onCreateAlert,
  onDelete,
  className = '',
}) {
  const [isExporting, setIsExporting] = useState(false)
  const count = selectedIds.length

  if (count === 0) return null

  const handleExport = async () => {
    if (onExport) {
      setIsExporting(true)
      try {
        await onExport(selectedIds)
      } finally {
        setIsExporting(false)
      }
    }
  }

  return (
    <div
      className={clsx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-cyber-dark border border-cyan-500/50 rounded-xl shadow-lg shadow-cyan-500/10',
        'flex items-center gap-2 px-4 py-3',
        'animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
          <span className="text-cyan-400 font-medium">{count}</span>
        </div>
        <span className="text-sm text-gray-400">
          {count === 1 ? 'item' : 'items'} selected
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Export */}
        {onExport && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Export selected"
          >
            {isExporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            <span>Export</span>
          </button>
        )}

        {/* Add to Watchlist */}
        {onAddToWatchlist && (
          <button
            onClick={() => onAddToWatchlist(selectedIds)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors"
            title="Add to watchlist"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span>Watch</span>
          </button>
        )}

        {/* Create Alert */}
        {onCreateAlert && (
          <button
            onClick={() => onCreateAlert(selectedIds)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-colors"
            title="Create alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Alert</span>
          </button>
        )}

        {/* Delete (if allowed) */}
        {onDelete && (
          <button
            onClick={() => onDelete(selectedIds)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
            title="Delete selected"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Clear selection */}
      <button
        onClick={onClear}
        className="ml-2 p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default BulkActionBar
