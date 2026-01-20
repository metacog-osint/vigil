/**
 * Settings Helper Components
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { TAG_COLORS } from './SettingsConstants'

export function SettingSection({ title, description, children }) {
  return (
    <div className="bg-cyber-card border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-cyber-accent' : 'bg-gray-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </button>
    </label>
  )
}

export function SavedSearchesList({ searches, onDelete }) {
  if (searches.length === 0) {
    return <p className="text-gray-500 text-sm">No saved searches yet</p>
  }

  return (
    <div className="space-y-2">
      {searches.map((search) => (
        <div
          key={search.id}
          className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2"
        >
          <div>
            <div className="text-white text-sm">{search.name}</div>
            <div className="text-xs text-gray-500">
              {search.search_type} · used {search.use_count} times
            </div>
          </div>
          <button
            onClick={() => onDelete(search.id)}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export function TagsList({ tags, onDelete }) {
  if (tags.length === 0) {
    return <p className="text-gray-500 text-sm">No tags yet</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center gap-2 bg-gray-800/50 rounded-full px-3 py-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
          <span className="text-sm text-white">{tag.name}</span>
          <span className="text-xs text-gray-500">({tag.entity_tags?.[0]?.count || 0})</span>
          <button
            onClick={() => onDelete(tag.id)}
            className="text-gray-500 hover:text-red-400 transition-colors ml-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export function CreateTagModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name, color })
    setName('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-sm p-6">
        <h3 className="text-lg font-medium text-white mb-4">Create Tag</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
              placeholder="Tag name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Color</label>
            <div className="flex gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx(
                    'w-8 h-8 rounded-full transition-transform',
                    color === c && 'ring-2 ring-white scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SyncLogList({ logs }) {
  if (logs.length === 0) {
    return <p className="text-gray-500 text-sm">No sync history available</p>
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-400'
      case 'partial':
        return 'text-yellow-400'
      case 'failed':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{log.source}</span>
              <span className={`text-xs ${getStatusColor(log.status)}`}>{log.status}</span>
            </div>
            <div className="text-xs text-gray-500">
              {log.records_added} added, {log.records_updated} updated
              {log.error_count > 0 && `, ${log.error_count} errors`}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            {log.completed_at
              ? formatDistanceToNow(new Date(log.completed_at), { addSuffix: true })
              : 'In progress'}
          </div>
        </div>
      ))}
    </div>
  )
}
