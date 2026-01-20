// Watch Button - Add entities to watchlists
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { watchlists as watchlistsApi } from '../lib/supabase'

export function WatchButton({ entityType, entityId, className = '', size = 'md' }) {
  const [watchlists, setWatchlists] = useState([])
  const [isWatched, setIsWatched] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadWatchlists()
  }, [entityId])

  const loadWatchlists = async () => {
    const { data } = await watchlistsApi.getAll()
    const filtered = (data || []).filter((w) => w.entity_type === entityType)
    setWatchlists(filtered)

    // Check if entity is in any watchlist
    const watched = await watchlistsApi.isWatched(entityId)
    setIsWatched(watched)
  }

  const toggleWatchlist = async (watchlistId, isInList) => {
    setIsLoading(true)
    try {
      if (isInList) {
        await watchlistsApi.removeItem(watchlistId, entityId)
      } else {
        await watchlistsApi.addItem(watchlistId, entityId)
      }
      await loadWatchlists()
    } finally {
      setIsLoading(false)
      setIsOpen(false)
    }
  }

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  // Close on Escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        className={clsx(
          'transition-colors',
          isWatched ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-gray-300',
          className
        )}
        title={isWatched ? 'On watchlist' : 'Add to watchlist'}
      >
        <svg
          className={sizes[size]}
          fill={isWatched ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div
            className="absolute right-0 top-full mt-1 z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px]"
            role="listbox"
            aria-label="Watchlist options"
          >
            {watchlists.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No watchlists for this type</div>
            ) : (
              watchlists.map((wl) => {
                const isInList = wl.items?.some((i) => i.entity_id === entityId)
                return (
                  <button
                    key={wl.id}
                    onClick={() => toggleWatchlist(wl.id, isInList)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wl.color }} />
                    <span className="text-gray-300 flex-1">{wl.name}</span>
                    {isInList && (
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default WatchButton
