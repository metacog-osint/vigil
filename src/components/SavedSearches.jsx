import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { savedSearches, recentSearches, getFilterSummary, COLOR_OPTIONS, ICON_OPTIONS } from '../lib/savedSearches'

/**
 * SavedSearches Panel - Shows saved and recent searches for a page
 */
export function SavedSearchesPanel({ page, currentFilters, onApply, onClose }) {
  const { user } = useAuth()
  const [searches, setSearches] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeTab, setActiveTab] = useState('saved')

  useEffect(() => {
    if (user?.uid) {
      loadData()
    }
  }, [user?.uid, page])

  async function loadData() {
    setLoading(true)
    try {
      const [savedData, recentData] = await Promise.all([
        savedSearches.getAll(user.uid, page),
        recentSearches.getAll(user.uid, page, 10),
      ])
      setSearches(savedData)
      setRecent(recentData)
    } catch (err) {
      console.error('Failed to load saved searches:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(search) {
    await savedSearches.recordUse(search.id)
    onApply(search.filters, search)
    onClose?.()
  }

  async function handleApplyRecent(recentSearch) {
    onApply(recentSearch.filters)
    onClose?.()
  }

  async function handleDelete(searchId) {
    if (!confirm('Delete this saved search?')) return
    try {
      await savedSearches.delete(searchId, user.uid)
      setSearches(prev => prev.filter(s => s.id !== searchId))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  async function handleTogglePin(search) {
    try {
      const updated = await savedSearches.togglePin(search.id, user.uid, !search.is_pinned)
      setSearches(prev => prev.map(s => s.id === search.id ? updated : s))
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  async function handleSetDefault(search) {
    try {
      await savedSearches.setDefault(search.id, user.uid, page)
      setSearches(prev => prev.map(s => ({
        ...s,
        is_default: s.id === search.id,
      })))
    } catch (err) {
      console.error('Failed to set default:', err)
    }
  }

  async function handleSave(searchData) {
    try {
      const newSearch = await savedSearches.create(user.uid, {
        ...searchData,
        page,
        filters: currentFilters,
      })
      setSearches(prev => [...prev, newSearch])
      setShowSaveModal(false)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  return (
    <div className="bg-cyber-dark border border-gray-800 rounded-lg shadow-xl">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'saved' ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-gray-400 hover:text-white'
            }`}
          >
            Saved
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'recent' ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-gray-400 hover:text-white'
            }`}
          >
            Recent
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaveModal(true)}
            className="text-sm text-cyber-accent hover:text-cyber-accent/80"
          >
            Save Current
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-2 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
        ) : activeTab === 'saved' ? (
          searches.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No saved searches yet
            </div>
          ) : (
            <div className="space-y-1">
              {searches.map(search => (
                <SearchItem
                  key={search.id}
                  search={search}
                  onApply={() => handleApply(search)}
                  onDelete={() => handleDelete(search.id)}
                  onTogglePin={() => handleTogglePin(search)}
                  onSetDefault={() => handleSetDefault(search)}
                />
              ))}
            </div>
          )
        ) : (
          recent.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No recent searches
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map(search => (
                <div
                  key={search.id}
                  onClick={() => handleApplyRecent(search)}
                  className="p-2 rounded hover:bg-gray-800/50 cursor-pointer"
                >
                  <div className="text-sm text-gray-300 truncate">
                    {search.query || getFilterSummary(search.filters)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {search.result_count !== null && `${search.result_count} results • `}
                    {new Date(search.searched_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveSearchModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleSave}
          filters={currentFilters}
        />
      )}
    </div>
  )
}

/**
 * Individual search item
 */
function SearchItem({ search, onApply, onDelete, onTogglePin, onSetDefault }) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="group relative">
      <div
        onClick={onApply}
        className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
          search.is_default ? 'bg-cyber-accent/10 border border-cyber-accent/30' : 'hover:bg-gray-800/50'
        }`}
      >
        {/* Color indicator */}
        {search.color && (
          <span className={`w-2 h-2 rounded-full bg-${search.color}-500 flex-shrink-0`}></span>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{search.name}</span>
            {search.is_pinned && (
              <svg className="w-3 h-3 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
            {search.is_default && (
              <span className="text-xs text-cyber-accent">(default)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {getFilterSummary(search.filters)}
          </div>
        </div>

        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
          className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-32">
            <button
              onClick={() => { onTogglePin(); setShowMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-gray-800"
            >
              {search.is_pinned ? 'Unpin' : 'Pin to top'}
            </button>
            <button
              onClick={() => { onSetDefault(); setShowMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-gray-800"
            >
              Set as default
            </button>
            <button
              onClick={() => { onDelete(); setShowMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left text-red-400 hover:bg-gray-800"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Save Search Modal
 */
function SaveSearchModal({ onClose, onSave, filters }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await onSave({ name, description, color, isPinned, isDefault })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-sm">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Save Search</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Healthcare Ransomware"
              className="cyber-input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional..."
              className="cyber-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(color === opt.value ? '' : opt.value)}
                  className={`w-6 h-6 rounded-full ${opt.class} ${
                    color === opt.value ? 'ring-2 ring-offset-2 ring-offset-cyber-dark ring-white' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Current Filters</label>
            <div className="text-xs text-gray-500 bg-gray-800/50 rounded p-2">
              {getFilterSummary(filters)}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Pin to quick access</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Set as default for this page</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="cyber-button">Cancel</button>
            <button type="submit" disabled={saving || !name} className="cyber-button-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * SaveSearchButton - Trigger button for save dialog
 */
export function SaveSearchButton({ page, currentFilters, onSaved }) {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)

  async function handleSave(searchData) {
    try {
      await savedSearches.create(user.uid, {
        ...searchData,
        page,
        filters: currentFilters,
      })
      setShowModal(false)
      onSaved?.()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="cyber-button text-sm"
        title="Save current search"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>

      {showModal && (
        <SaveSearchModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          filters={currentFilters}
        />
      )}
    </>
  )
}

/**
 * Hook to manage saved search state
 */
export function useSavedSearch(page) {
  const { user } = useAuth()
  const [defaultSearch, setDefaultSearch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.uid && page) {
      loadDefault()
    }
  }, [user?.uid, page])

  async function loadDefault() {
    setLoading(true)
    try {
      const search = await savedSearches.getDefault(user.uid, page)
      setDefaultSearch(search)
    } catch {
      // No default set
    } finally {
      setLoading(false)
    }
  }

  return {
    defaultSearch,
    loading,
    refresh: loadDefault,
  }
}

export default SavedSearchesPanel
