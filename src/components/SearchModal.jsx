// Unified search modal (Cmd+K / Ctrl+K)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { iocs, threatActors, vulnerabilities, incidents } from '../lib/supabase'
import { detectIOCType } from '../lib/utils'

const SEARCH_TYPES = {
  all: { label: 'All', icon: '🔍' },
  actors: { label: 'Actors', icon: '👥' },
  incidents: { label: 'Incidents', icon: '⚠️' },
  vulnerabilities: { label: 'CVEs', icon: '🛡️' },
  iocs: { label: 'IOCs', icon: '📋' },
}

export function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({
    actors: [],
    incidents: [],
    vulnerabilities: [],
    iocs: [],
  })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [recentSearches, setRecentSearches] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vigil-recent-searches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults({ actors: [], incidents: [], vulnerabilities: [], iocs: [] })
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Auto-detect search type based on input
  const detectSearchType = useCallback((input) => {
    if (!input || input.length < 2) return null

    const trimmed = input.trim()

    // CVE pattern
    if (/^CVE-\d{4}-\d+$/i.test(trimmed)) {
      return 'cve'
    }

    // IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(trimmed)) {
      return 'ip'
    }

    // SHA256 hash
    if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      return 'hash'
    }

    // MD5 hash
    if (/^[a-fA-F0-9]{32}$/.test(trimmed)) {
      return 'hash'
    }

    // URL
    if (/^https?:\/\//i.test(trimmed)) {
      return 'url'
    }

    // Domain (has dots, no spaces)
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(trimmed)) {
      return 'domain'
    }

    return 'text'
  }, [])

  // Search function
  const search = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults({ actors: [], incidents: [], vulnerabilities: [], iocs: [] })
      return
    }

    setLoading(true)
    const searchType = detectSearchType(searchQuery)

    try {
      const searchPromises = []

      // Always search actors
      searchPromises.push(
        threatActors.getAll({ search: searchQuery, limit: 5 })
          .then(({ data }) => ({ type: 'actors', data: data || [] }))
          .catch(() => ({ type: 'actors', data: [] }))
      )

      // CVE search
      if (searchType === 'cve' || searchType === 'text') {
        searchPromises.push(
          vulnerabilities.search(searchQuery, 5)
            .then(({ data }) => ({ type: 'vulnerabilities', data: data || [] }))
            .catch(() => ({ type: 'vulnerabilities', data: [] }))
        )
      }

      // IOC search (IP, hash, URL, domain)
      if (['ip', 'hash', 'url', 'domain', 'text'].includes(searchType)) {
        searchPromises.push(
          iocs.search(searchQuery, null)
            .then(({ data }) => ({ type: 'iocs', data: (data || []).slice(0, 5) }))
            .catch(() => ({ type: 'iocs', data: [] }))
        )
      }

      // Incident search
      searchPromises.push(
        incidents.search(searchQuery, 5)
          .then(({ data }) => ({ type: 'incidents', data: data || [] }))
          .catch(() => ({ type: 'incidents', data: [] }))
      )

      const searchResults = await Promise.all(searchPromises)

      const newResults = {
        actors: [],
        incidents: [],
        vulnerabilities: [],
        iocs: [],
      }

      searchResults.forEach(({ type, data }) => {
        newResults[type] = data
      })

      setResults(newResults)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [detectSearchType])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, search])

  // Save to recent searches
  const saveRecentSearch = (searchQuery) => {
    const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5)
    setRecentSearches(newRecent)
    localStorage.setItem('vigil-recent-searches', JSON.stringify(newRecent))
  }

  // Get all results as flat array
  const getAllResults = () => {
    const all = []
    if (activeTab === 'all' || activeTab === 'actors') {
      results.actors.forEach(item => all.push({ ...item, _type: 'actor' }))
    }
    if (activeTab === 'all' || activeTab === 'vulnerabilities') {
      results.vulnerabilities.forEach(item => all.push({ ...item, _type: 'vulnerability' }))
    }
    if (activeTab === 'all' || activeTab === 'iocs') {
      results.iocs.forEach(item => all.push({ ...item, _type: 'ioc' }))
    }
    if (activeTab === 'all' || activeTab === 'incidents') {
      results.incidents.forEach(item => all.push({ ...item, _type: 'incident' }))
    }
    return all
  }

  const allResults = getAllResults()
  const totalResults = results.actors.length + results.vulnerabilities.length + results.iocs.length + results.incidents.length

  // Navigate to selected result
  const handleSelect = (item) => {
    saveRecentSearch(query)
    onClose()

    switch (item._type) {
      case 'actor':
        navigate('/actors', { state: { selectedActorId: item.id } })
        break
      case 'vulnerability':
        navigate('/vulnerabilities', { state: { selectedCveId: item.cve_id } })
        break
      case 'ioc':
        navigate('/iocs', { state: { searchValue: item.value } })
        break
      case 'incident':
        navigate('/incidents', { state: { selectedIncidentId: item.id } })
        break
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allResults[selectedIndex]) {
          handleSelect(allResults[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-cyber-dark border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search actors, CVEs, IOCs, incidents..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
          />
          {loading && (
            <div className="animate-spin w-5 h-5 border-2 border-cyber-accent border-t-transparent rounded-full" />
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Tabs */}
        {totalResults > 0 && (
          <div className="flex gap-1 px-4 py-2 border-b border-gray-800">
            {Object.entries(SEARCH_TYPES).map(([key, { label }]) => {
              const count = key === 'all'
                ? totalResults
                : results[key]?.length || 0

              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key)
                    setSelectedIndex(0)
                  }}
                  className={clsx(
                    'px-3 py-1 text-sm rounded transition-colors',
                    activeTab === key
                      ? 'bg-cyber-accent/20 text-cyber-accent'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1 text-xs opacity-60">({count})</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            // Recent searches
            <div className="p-4">
              {recentSearches.length > 0 && (
                <>
                  <div className="text-xs text-gray-500 mb-2">Recent Searches</div>
                  <div className="space-y-1">
                    {recentSearches.map((recent, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(recent)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">{recent}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="text-xs text-gray-500 mt-4">
                Type to search across all threat data. Auto-detects IPs, CVEs, hashes, and domains.
              </div>
            </div>
          ) : allResults.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-400">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {allResults.map((item, index) => (
                <button
                  key={`${item._type}-${item.id || item.cve_id || item.value}`}
                  onClick={() => handleSelect(item)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-cyber-accent/20 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  {/* Icon */}
                  <span className="text-lg">
                    {item._type === 'actor' && '👥'}
                    {item._type === 'vulnerability' && '🛡️'}
                    {item._type === 'ioc' && '📋'}
                    {item._type === 'incident' && '⚠️'}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {item._type === 'actor' && item.name}
                      {item._type === 'vulnerability' && item.cve_id}
                      {item._type === 'ioc' && item.value}
                      {item._type === 'incident' && (item.victim_name || 'Unknown Victim')}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {item._type === 'actor' && (item.actor_type || 'Threat Actor')}
                      {item._type === 'vulnerability' && item.description?.slice(0, 60)}
                      {item._type === 'ioc' && `${item.type} • ${item.source || 'Unknown source'}`}
                      {item._type === 'incident' && `${item.threat_actor?.name || 'Unknown'} • ${item.victim_sector || 'Unknown sector'}`}
                    </div>
                  </div>

                  {/* Badge */}
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                    {item._type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">esc</kbd>
              close
            </span>
          </div>
          <div>
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">?</kbd> for shortcuts
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchModal
