// Unified search modal (Cmd+K / Ctrl+K)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { iocs, threatActors, vulnerabilities, incidents, supabase } from '../lib/supabase'
import { parseNaturalQuery, queryToFilters } from '../lib/ai'
import { IOCQuickLookupCard } from './widgets'
import { useSmartDefaults, filterNavPages } from '../hooks/useSmartDefaults'

const SEARCH_TYPES = {
  all: { label: 'All', icon: '🔍' },
  actors: { label: 'Actors', icon: '👥' },
  incidents: { label: 'Incidents', icon: '⚠️' },
  vulnerabilities: { label: 'CVEs', icon: '🛡️' },
  iocs: { label: 'IOCs', icon: '📋' },
}

// Keywords that suggest natural language query
const NL_KEYWORDS = [
  'show',
  'find',
  'list',
  'get',
  'search',
  'what',
  'which',
  'who',
  'latest',
  'recent',
  'top',
  'active',
  'escalating',
  'critical',
  'high',
  'targeting',
  'affecting',
  'attacks',
  'victims',
  'from',
  'in',
  'with',
]

// Detect if query looks like natural language vs structured/IOC search
function isNaturalLanguageQuery(query) {
  if (!query || query.length < 5) return false

  const trimmed = query.toLowerCase().trim()
  const words = trimmed.split(/\s+/)

  // If only one word, not natural language
  if (words.length < 2) return false

  // If contains structured query syntax (field:value), not NL
  if (/\w+:[<>=!*]?\w+/.test(trimmed)) return false

  // Check for NL keywords
  const hasNLKeyword = words.some((word) => NL_KEYWORDS.includes(word))

  // Contains common NL patterns
  const hasNLPattern =
    /\b(show me|find all|list|get|what are|which|who is|recent|latest|top \d+|attacks on|targeting|affecting|from the|in the|with)\b/i.test(
      trimmed
    )

  return hasNLKeyword || hasNLPattern
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
  const [iocLookupMode, setIocLookupMode] = useState(false)
  const [iocLookupData, setIocLookupData] = useState(null)
  const [nlMode, setNlMode] = useState(false)
  const [nlParsedQuery, setNlParsedQuery] = useState(null)
  const [showNavMode, setShowNavMode] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const smartDefaults = useSmartDefaults()

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
      setIocLookupMode(false)
      setIocLookupData(null)
      setNlMode(false)
      setNlParsedQuery(null)
      setShowNavMode(false)
    }
  }, [isOpen])

  // Check for navigation mode (query starts with ">")
  useEffect(() => {
    setShowNavMode(query.startsWith('>'))
  }, [query])

  // Get filtered nav pages when in nav mode
  const filteredNavPages = showNavMode ? filterNavPages(query.slice(1).trim()) : []

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
  const search = useCallback(
    async (searchQuery) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults({ actors: [], incidents: [], vulnerabilities: [], iocs: [] })
        setIocLookupMode(false)
        setIocLookupData(null)
        setNlMode(false)
        setNlParsedQuery(null)
        return
      }

      setLoading(true)
      const searchType = detectSearchType(searchQuery)

      // Check if this looks like a specific IOC - enable quick lookup mode
      const isSpecificIOC = ['ip', 'hash', 'cve', 'url', 'domain'].includes(searchType)

      // Check if this looks like natural language
      const isNL = isNaturalLanguageQuery(searchQuery)

      try {
        // Natural language query mode
        if (isNL) {
          setIocLookupMode(false)
          setIocLookupData(null)
          setNlMode(true)

          // Parse the natural language query
          const parsed = await parseNaturalQuery(searchQuery)
          const filters = queryToFilters(parsed)
          setNlParsedQuery(parsed)

          const searchPromises = []
          const targetType = parsed.type

          // Search actors if type matches or not specified
          if (!targetType || targetType === 'actors') {
            const actorFilters = { limit: 5 }
            if (filters.search) actorFilters.search = filters.search
            if (filters.actor) actorFilters.search = filters.actor
            if (filters.trendStatus) actorFilters.trendStatus = filters.trendStatus
            if (filters.sectors?.length) actorFilters.sectors = filters.sectors

            searchPromises.push(
              threatActors
                .getAll(actorFilters)
                .then(({ data }) => ({ type: 'actors', data: data || [] }))
                .catch(() => ({ type: 'actors', data: [] }))
            )
          }

          // Search vulnerabilities if type matches or not specified
          if (!targetType || targetType === 'vulnerabilities') {
            searchPromises.push(
              (async () => {
                let query = supabase.from('vulnerabilities').select('*').limit(5)

                if (filters.severity) {
                  query = query.eq('severity', filters.severity)
                }
                if (filters.isKev) {
                  query = query.not('kev_date', 'is', null)
                }
                if (filters.hasExploit) {
                  query = query.eq('has_exploit', true)
                }

                const { data } = await query.order('cvss_score', { ascending: false })
                return { type: 'vulnerabilities', data: data || [] }
              })().catch(() => ({ type: 'vulnerabilities', data: [] }))
            )
          }

          // Search IOCs if type matches or not specified
          if (!targetType || targetType === 'iocs') {
            searchPromises.push(
              iocs
                .search(filters.search || filters.actor || '', filters.type || null)
                .then(({ data }) => ({ type: 'iocs', data: (data || []).slice(0, 5) }))
                .catch(() => ({ type: 'iocs', data: [] }))
            )
          }

          // Search incidents if type matches or not specified
          if (!targetType || targetType === 'incidents') {
            searchPromises.push(
              (async () => {
                let query = supabase
                  .from('incidents')
                  .select('*, threat_actor:threat_actors(name)')
                  .limit(5)

                if (filters.actor) {
                  const { data: actorData } = await threatActors.getAll({
                    search: filters.actor,
                    limit: 1,
                  })
                  if (actorData?.[0]?.id) {
                    query = query.eq('threat_actor_id', actorData[0].id)
                  }
                }
                if (filters.sectors?.length) {
                  query = query.in('victim_sector', filters.sectors)
                }

                const { data } = await query.order('discovered_date', { ascending: false })
                return { type: 'incidents', data: data || [] }
              })().catch(() => ({ type: 'incidents', data: [] }))
            )
          }

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
          setLoading(false)
          return
        }

        // If it's a specific IOC, use quick lookup for enriched results
        if (isSpecificIOC) {
          setNlMode(false)
          setNlParsedQuery(null)
          const lookupResult = await iocs.quickLookup(searchQuery)
          lookupResult.searchValue = searchQuery
          setIocLookupData(lookupResult)
          setIocLookupMode(true)

          // Still do regular search for other result types
          const actorResults = await threatActors
            .getAll({ search: searchQuery, limit: 3 })
            .catch(() => ({ data: [] }))

          setResults({
            actors: actorResults.data || [],
            incidents: [],
            vulnerabilities: lookupResult.vulnerabilities || [],
            iocs: lookupResult.iocs || [],
          })
          setSelectedIndex(0)
          setLoading(false)
          return
        }

        // Regular search mode
        setIocLookupMode(false)
        setIocLookupData(null)
        setNlMode(false)
        setNlParsedQuery(null)

        const searchPromises = []

        // Always search actors
        searchPromises.push(
          threatActors
            .getAll({ search: searchQuery, limit: 5 })
            .then(({ data }) => ({ type: 'actors', data: data || [] }))
            .catch(() => ({ type: 'actors', data: [] }))
        )

        // CVE search
        if (searchType === 'cve' || searchType === 'text') {
          searchPromises.push(
            vulnerabilities
              .search(searchQuery, 5)
              .then(({ data }) => ({ type: 'vulnerabilities', data: data || [] }))
              .catch(() => ({ type: 'vulnerabilities', data: [] }))
          )
        }

        // IOC search (IP, hash, URL, domain)
        if (['ip', 'hash', 'url', 'domain', 'text'].includes(searchType)) {
          searchPromises.push(
            iocs
              .search(searchQuery, null)
              .then(({ data }) => ({ type: 'iocs', data: (data || []).slice(0, 5) }))
              .catch(() => ({ type: 'iocs', data: [] }))
          )
        }

        // Incident search
        searchPromises.push(
          incidents
            .search(searchQuery, 5)
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
    },
    [detectSearchType]
  )

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, search])

  // Save to recent searches
  const saveRecentSearch = (searchQuery) => {
    const newRecent = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5)
    setRecentSearches(newRecent)
    localStorage.setItem('vigil-recent-searches', JSON.stringify(newRecent))
  }

  // Get all results as flat array
  const getAllResults = () => {
    const all = []
    if (activeTab === 'all' || activeTab === 'actors') {
      results.actors.forEach((item) => all.push({ ...item, _type: 'actor' }))
    }
    if (activeTab === 'all' || activeTab === 'vulnerabilities') {
      results.vulnerabilities.forEach((item) => all.push({ ...item, _type: 'vulnerability' }))
    }
    if (activeTab === 'all' || activeTab === 'iocs') {
      results.iocs.forEach((item) => all.push({ ...item, _type: 'ioc' }))
    }
    if (activeTab === 'all' || activeTab === 'incidents') {
      results.incidents.forEach((item) => all.push({ ...item, _type: 'incident' }))
    }
    return all
  }

  const allResults = getAllResults()
  const totalResults =
    results.actors.length +
    results.vulnerabilities.length +
    results.iocs.length +
    results.incidents.length

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
    // Handle navigation mode
    if (showNavMode) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filteredNavPages.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredNavPages[selectedIndex]) {
            navigate(filteredNavPages[selectedIndex].path)
            onClose()
          }
          break
        case 'Escape':
          onClose()
          break
      }
      return
    }

    // Regular search mode
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-cyber-dark border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
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
              const count = key === 'all' ? totalResults : results[key]?.length || 0

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
                  {count > 0 && <span className="ml-1 text-xs opacity-60">({count})</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {showNavMode ? (
            // Navigation mode (query starts with ">")
            <div className="p-4">
              <div className="text-xs text-cyan-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                Go to page
              </div>
              <div className="space-y-1">
                {filteredNavPages.map((page, i) => (
                  <button
                    key={page.path}
                    onClick={() => {
                      navigate(page.path)
                      onClose()
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors',
                      i === selectedIndex
                        ? 'bg-cyber-accent/20 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="flex-1">{page.label}</span>
                    <span className="text-xs text-gray-600">{page.path}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : query.length < 2 ? (
            // Empty state with quick actions
            <div className="p-4">
              {/* Quick Actions based on user's sector */}
              {smartDefaults.quickActions && smartDefaults.quickActions.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Quick Actions
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {smartDefaults.quickActions.map((action) => (
                      <button
                        key={action.path}
                        onClick={() => {
                          navigate(action.path)
                          onClose()
                        }}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-center"
                      >
                        <span className="text-cyber-accent text-lg">
                          {action.icon === 'shield' && '🛡️'}
                          {action.icon === 'document' && '📋'}
                          {action.icon === 'bell' && '🔔'}
                          {action.icon === 'trending' && '📈'}
                          {action.icon === 'chart' && '📊'}
                          {action.icon === 'alert' && '⚠️'}
                          {action.icon === 'search' && '🔍'}
                          {action.icon === 'grid' && '⊞'}
                          {action.icon === 'target' && '🎯'}
                          {action.icon === 'server' && '🖥️'}
                          {action.icon === 'activity' && '📡'}
                          {action.icon === 'users' && '👥'}
                          {action.icon === 'star' && '⭐'}
                          {action.icon === 'home' && '🏠'}
                        </span>
                        <span className="text-xs text-gray-300">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">Recent Searches</div>
                  <div className="space-y-1">
                    {recentSearches.map((recent, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(recent)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded"
                      >
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm">{recent}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Searches based on sector */}
              {smartDefaults.quickSearches && smartDefaults.quickSearches.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">Suggested for You</div>
                  <div className="flex flex-wrap gap-2">
                    {smartDefaults.quickSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Help text */}
              <div className="text-xs text-gray-600 border-t border-gray-800 pt-3 mt-3 space-y-1">
                <div>
                  <span className="text-gray-500">Search:</span> Type anything to search actors,
                  CVEs, IOCs
                </div>
                <div>
                  <span className="text-cyan-500/70">&gt;</span>{' '}
                  <span className="text-gray-500">Go to:</span> Type &gt; to navigate to a page
                </div>
                <div>
                  <span className="text-purple-500/70">NL:</span>{' '}
                  <span className="text-gray-500">Try:</span> "escalating actors targeting
                  healthcare"
                </div>
              </div>
            </div>
          ) : nlMode && nlParsedQuery ? (
            // Natural Language Mode - show interpreted query
            <div className="p-4">
              <div className="text-xs text-purple-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Natural Language Search
                {nlParsedQuery.aiParsed && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px]">
                    AI
                  </span>
                )}
              </div>
              {/* Show interpreted filters */}
              <div className="text-xs text-gray-400 mb-3 bg-gray-800/50 rounded p-2">
                <span className="text-gray-500">Interpreted as:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {nlParsedQuery.type && (
                    <span className="px-1.5 py-0.5 bg-gray-700 rounded">{nlParsedQuery.type}</span>
                  )}
                  {nlParsedQuery.trendStatus && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">
                      {nlParsedQuery.trendStatus}
                    </span>
                  )}
                  {nlParsedQuery.severity && (
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                      {nlParsedQuery.severity}
                    </span>
                  )}
                  {nlParsedQuery.sectors?.map((s, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                      {s}
                    </span>
                  ))}
                  {nlParsedQuery.actor && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">
                      {nlParsedQuery.actor}
                    </span>
                  )}
                  {nlParsedQuery.isKev && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">KEV</span>
                  )}
                  {nlParsedQuery.hasExploit && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                      Has Exploit
                    </span>
                  )}
                </div>
              </div>
              {/* Results */}
              {allResults.length === 0 && !loading ? (
                <div className="text-center text-gray-400 py-4">
                  No results found for this query
                </div>
              ) : (
                <div className="space-y-1">
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
                      <span className="text-lg">
                        {item._type === 'actor' && '👥'}
                        {item._type === 'vulnerability' && '🛡️'}
                        {item._type === 'ioc' && '📋'}
                        {item._type === 'incident' && '⚠️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {item._type === 'actor' && item.name}
                          {item._type === 'vulnerability' && item.cve_id}
                          {item._type === 'ioc' && item.value}
                          {item._type === 'incident' && (item.victim_name || 'Unknown Victim')}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {item._type === 'actor' &&
                            (item.trend_status || item.actor_type || 'Threat Actor')}
                          {item._type === 'vulnerability' &&
                            `CVSS ${item.cvss_score} • ${item.description?.slice(0, 40)}...`}
                          {item._type === 'ioc' &&
                            `${item.type} • ${item.source || 'Unknown source'}`}
                          {item._type === 'incident' &&
                            `${item.threat_actor?.name || 'Unknown'} • ${item.victim_sector || 'Unknown sector'}`}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                        {item._type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : iocLookupMode && iocLookupData ? (
            // IOC Quick Lookup Mode - show enriched results
            <div className="p-4">
              <div className="text-xs text-cyber-accent mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                IOC Quick Lookup
              </div>
              <IOCQuickLookupCard
                data={iocLookupData}
                type={iocLookupData.type}
                onNavigate={(path, state) => {
                  onClose()
                  navigate(path, { state })
                }}
              />
              {/* Show other results if any */}
              {results.actors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">Related Actors</div>
                  {results.actors.map((actor, _i) => (
                    <button
                      key={actor.id}
                      onClick={() => handleSelect({ ...actor, _type: 'actor' })}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded text-left text-gray-300 hover:bg-gray-800"
                    >
                      <span>👥</span>
                      <span className="flex-1">{actor.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : allResults.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-400">No results found for "{query}"</div>
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
                      {item._type === 'incident' &&
                        `${item.threat_actor?.name || 'Unknown'} • ${item.victim_sector || 'Unknown sector'}`}
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

        {/* Footer - hidden on mobile since keyboard shortcuts don't apply to touch */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
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
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">?</kbd>{' '}
            for shortcuts
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchModal
