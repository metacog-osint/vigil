// Watchlists management page
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { watchlists as watchlistsApi } from '../lib/supabase'
import { EmptyState, SkeletonCard, ErrorMessage, TimeAgo } from '../components'
import { FeatureGate } from '../components/UpgradePrompt'

const ENTITY_TYPES = [
  { value: 'actor', label: 'Threat Actors', icon: '👤', color: 'bg-red-500' },
  { value: 'vulnerability', label: 'Vulnerabilities', icon: '🔓', color: 'bg-orange-500' },
  { value: 'ioc', label: 'IOCs', icon: '🎯', color: 'bg-blue-500' },
  { value: 'incident', label: 'Incidents', icon: '⚡', color: 'bg-purple-500' },
]

const COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

function CreateWatchlistModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entityType, setEntityType] = useState('actor')
  const [color, setColor] = useState(COLORS[0])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    try {
      await onCreate({ name, description, entity_type: entityType, color })
      setName('')
      setDescription('')
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Create Watchlist</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
              placeholder="My Watchlist"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Entity Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ENTITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setEntityType(type.value)}
                  className={clsx(
                    'px-3 py-2 rounded border text-left text-sm transition-colors',
                    entityType === type.value
                      ? 'border-cyber-accent bg-cyber-accent/10 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  )}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
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

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WatchlistCard({ watchlist, onDelete }) {
  const entityType = ENTITY_TYPES.find((t) => t.value === watchlist.entity_type)
  const itemCount = watchlist.items?.[0]?.count || 0

  return (
    <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: watchlist.color }}
          />
          <div>
            <Link
              to={`/watchlists/${watchlist.id}`}
              className="font-medium text-white hover:text-cyber-accent transition-colors"
            >
              {watchlist.name}
            </Link>
            {watchlist.description && (
              <p className="text-sm text-gray-500 mt-0.5">{watchlist.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(watchlist.id)}
          className="text-gray-500 hover:text-red-400 transition-colors p-1"
          title="Delete watchlist"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <span>{entityType?.icon}</span>
          <span>{entityType?.label}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-500">
          <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          <TimeAgo date={watchlist.created_at} />
        </div>
      </div>
    </div>
  )
}

export default function Watchlists() {
  const [watchlists, setWatchlists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    loadWatchlists()
  }, [])

  const loadWatchlists = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await watchlistsApi.getAll()
      if (error) throw error
      setWatchlists(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (watchlist) => {
    const { data, error } = await watchlistsApi.create(watchlist)
    if (error) {
      setError(error.message)
      return
    }
    setWatchlists([data, ...watchlists])
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this watchlist?')) return
    const { error } = await watchlistsApi.delete(id)
    if (error) {
      setError(error.message)
      return
    }
    setWatchlists(watchlists.filter((w) => w.id !== id))
  }

  return (
    <FeatureGate feature="watchlist">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Watchlists</h1>
            <p className="text-gray-400 mt-1">Track entities of interest</p>
          </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyber-accent text-white rounded-lg hover:bg-cyber-accent/80 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Watchlist
        </button>
      </div>

      {error && <ErrorMessage message={error} className="mb-4" />}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <EmptyState
          title="No watchlists yet"
          description="Create a watchlist to start tracking threat actors, vulnerabilities, or IOCs"
          action={{
            label: 'Create Watchlist',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlists.map((watchlist) => (
            <WatchlistCard
              key={watchlist.id}
              watchlist={watchlist}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateWatchlistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
      </div>
    </FeatureGate>
  )
}
