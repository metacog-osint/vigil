import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { threatActors, subscribeToTable, incidents, savedSearches, orgProfile, relevance, watchlists } from '../lib/supabase'
import TrendBadge, { TrendIndicator } from '../components/TrendBadge'
import { SmartTime } from '../components/TimeDisplay'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyActors } from '../components/EmptyState'
import { NewBadge } from '../components/NewIndicator'
import { WatchButton } from '../components/WatchButton'
import { Sparkline } from '../components/Sparkline'
import { Timeline } from '../components/Timeline'
import { CorrelationPanel } from '../components/CorrelationPanel'
import { Tooltip, ColumnMenu, SortableHeader, FIELD_TOOLTIPS } from '../components/Tooltip'

const SECTORS = [
  'healthcare',
  'finance',
  'technology',
  'manufacturing',
  'retail',
  'education',
  'energy',
  'government',
]

const TREND_FILTERS = [
  { key: '', label: 'All Trends' },
  { key: 'ESCALATING', label: 'Escalating' },
  { key: 'STABLE', label: 'Stable' },
  { key: 'DECLINING', label: 'Declining' },
]

const ACTOR_TYPES = [
  { key: '', label: 'All Types' },
  { key: 'ransomware', label: 'Ransomware' },
  { key: 'apt', label: 'APT' },
  { key: 'cybercrime', label: 'Cybercrime' },
  { key: 'hacktivism', label: 'Hacktivism' },
  { key: 'initial_access_broker', label: 'Initial Access Broker' },
  { key: 'data_extortion', label: 'Data Extortion' },
]

// Tooltip content and styling for actor types
const ACTOR_TYPE_CONFIG = {
  ransomware: {
    tooltip: 'Ransomware operators encrypt victim data and demand payment for decryption keys.',
    color: 'bg-red-900/50 text-red-400 border-red-800',
    sortOrder: 1
  },
  apt: {
    tooltip: 'Advanced Persistent Threat - state-sponsored groups conducting espionage operations.',
    color: 'bg-purple-900/50 text-purple-400 border-purple-800',
    sortOrder: 2
  },
  cybercrime: {
    tooltip: 'Financially motivated criminals (fraud, theft, carding, etc.).',
    color: 'bg-orange-900/50 text-orange-400 border-orange-800',
    sortOrder: 3
  },
  hacktivism: {
    tooltip: 'Politically or ideologically motivated hackers (Anonymous, Killnet, etc.).',
    color: 'bg-green-900/50 text-green-400 border-green-800',
    sortOrder: 4
  },
  initial_access_broker: {
    tooltip: 'Actors who sell initial network access to other criminals.',
    color: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    sortOrder: 5
  },
  data_extortion: {
    tooltip: 'Groups that steal data without encryption and extort victims with leak threats.',
    color: 'bg-pink-900/50 text-pink-400 border-pink-800',
    sortOrder: 6
  },
  unknown: {
    tooltip: 'Actor type not yet classified.',
    color: 'bg-gray-800/50 text-gray-400 border-gray-700',
    sortOrder: 99
  }
}

// Helper to get type config with fallback
function getTypeConfig(type) {
  const normalized = (type || 'unknown').toLowerCase()
  return ACTOR_TYPE_CONFIG[normalized] || ACTOR_TYPE_CONFIG.unknown
}

// Filter options for column menus
const TYPE_FILTER_OPTIONS = [
  { value: 'ransomware', label: 'Ransomware', color: 'bg-red-400' },
  { value: 'apt', label: 'APT', color: 'bg-purple-400' },
  { value: 'cybercrime', label: 'Cybercrime', color: 'bg-orange-400' },
  { value: 'hacktivism', label: 'Hacktivism', color: 'bg-green-400' },
  { value: 'initial_access_broker', label: 'Initial Access Broker', color: 'bg-yellow-400' },
  { value: 'data_extortion', label: 'Data Extortion', color: 'bg-pink-400' },
]

const TREND_FILTER_OPTIONS = [
  { value: 'ESCALATING', label: 'Escalating', color: 'bg-red-400' },
  { value: 'STABLE', label: 'Stable', color: 'bg-gray-400' },
  { value: 'DECLINING', label: 'Declining', color: 'bg-green-400' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-400' },
  { value: 'inactive', label: 'Inactive', color: 'bg-yellow-400' },
  { value: 'defunct', label: 'Defunct', color: 'bg-gray-400' },
]

// Page size for pagination
const PAGE_SIZE = 50

export default function ThreatActors() {
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [trendFilter, setTrendFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortConfig, setSortConfig] = useState({ field: 'incidents_7d', direction: 'desc' })
  const [trendSummary, setTrendSummary] = useState({ escalating: 0, stable: 0, declining: 0 })
  const [selectedActor, setSelectedActor] = useState(null)
  const [actorIncidents, setActorIncidents] = useState([])

  // Feature 1: Pagination
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Feature 3: Saved Filters
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersList, setSavedFiltersList] = useState([])
  const [saveFilterName, setSaveFilterName] = useState('')

  // Feature 6: Quick Watchlist (selected rows for bulk actions)
  const [selectedRows, setSelectedRows] = useState(new Set())

  // Feature 7: Keyboard Navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableRef = useRef(null)

  // Feature 8: Overview View (renamed from Map - no geographic map implemented)
  const [viewMode, setViewMode] = useState('table') // 'table' or 'overview'

  // Feature 9: Risk Score
  const [userOrgProfile, setUserOrgProfile] = useState(null)
  const [riskScores, setRiskScores] = useState({})

  // Feature 5: Related Actors
  const [relatedActors, setRelatedActors] = useState([])

  // Sort actors based on current config (must be defined before useEffects that use it)
  const sortedActors = useMemo(() => {
    return [...actors].sort((a, b) => {
      if (!sortConfig) return 0

      const { field, direction } = sortConfig
      let aVal = a[field]
      let bVal = b[field]

      // Handle nulls
      if (aVal == null) aVal = field === 'name' ? '' : -Infinity
      if (bVal == null) bVal = field === 'name' ? '' : -Infinity

      // Actor type uses sortOrder for logical grouping
      if (field === 'actor_type') {
        aVal = getTypeConfig(aVal).sortOrder
        bVal = getTypeConfig(bVal).sortOrder
      }

      // String comparison for other text fields
      if (field === 'name' || field === 'status') {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }

      // Date comparison
      if (field === 'last_seen' || field === 'first_seen') {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }

      // Trend status ordering
      if (field === 'trend_status') {
        const order = { 'ESCALATING': 3, 'STABLE': 2, 'DECLINING': 1 }
        aVal = order[aVal] || 0
        bVal = order[bVal] || 0
      }

      // Feature 9: Risk score sorting
      if (field === 'risk_score') {
        aVal = riskScores[a.id] || 0
        bVal = riskScores[b.id] || 0
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [actors, sortConfig, riskScores])

  // Initial load + subscriptions
  useEffect(() => {
    loadActors(true) // true = reset to first page
    loadTrendSummary()
    loadSavedFilters()
    loadOrgProfile()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTable('threat_actors', (payload) => {
      if (payload.eventType === 'INSERT') {
        setActors((prev) => [payload.new, ...prev])
        setTotalCount(c => c + 1)
      } else if (payload.eventType === 'UPDATE') {
        setActors((prev) =>
          prev.map((a) => (a.id === payload.new.id ? payload.new : a))
        )
      }
    })

    return () => unsubscribe()
  }, [search, sectorFilter, trendFilter, typeFilter, statusFilter])

  // Feature 7: Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle when table is visible and not typing in input
      if (viewMode === 'overview' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedRowIndex(i => Math.min(i + 1, sortedActors.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedRowIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          if (focusedRowIndex >= 0 && sortedActors[focusedRowIndex]) {
            setSelectedActor(sortedActors[focusedRowIndex])
          }
          break
        case 'Escape':
          setSelectedActor(null)
          setFocusedRowIndex(-1)
          break
        case '/':
          e.preventDefault()
          document.querySelector('input[type="text"]')?.focus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, focusedRowIndex, sortedActors])

  // Feature 9: Calculate risk scores when org profile or actors change
  useEffect(() => {
    if (userOrgProfile && actors.length > 0) {
      const scores = {}
      actors.forEach(actor => {
        scores[actor.id] = relevance.calculateActorScore(actor, userOrgProfile)
      })
      setRiskScores(scores)
    }
  }, [userOrgProfile, actors])

  // Feature 5: Load related actors when actor is selected
  useEffect(() => {
    if (selectedActor) {
      loadRelatedActors(selectedActor)
    } else {
      setRelatedActors([])
    }
  }, [selectedActor])

  async function loadActors(reset = false) {
    if (reset) {
      setLoading(true)
      setActors([])
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : actors.length
      const { data, error, count } = await threatActors.getAll({
        search,
        sector: sectorFilter,
        trendStatus: trendFilter,
        actorType: typeFilter,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setActors(data || [])
      } else {
        setActors(prev => [...prev, ...(data || [])])
      }
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading actors:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Feature 1: Load more pagination
  const loadMore = () => {
    if (!loadingMore && actors.length < totalCount) {
      loadActors(false)
    }
  }

  const hasMore = actors.length < totalCount

  async function loadTrendSummary() {
    try {
      const summary = await threatActors.getTrendSummary()
      setTrendSummary(summary)
    } catch (error) {
      console.error('Error loading trend summary:', error)
    }
  }

  // Feature 3: Saved Filters
  async function loadSavedFilters() {
    try {
      const { data } = await savedSearches.getAll('anonymous', 'threat_actors')
      setSavedFiltersList(data || [])
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  async function saveCurrentFilter() {
    if (!saveFilterName.trim()) return

    const filterConfig = {
      search, sectorFilter, trendFilter, typeFilter, statusFilter,
      sortConfig
    }

    try {
      await savedSearches.create({
        user_id: 'anonymous',
        name: saveFilterName,
        search_type: 'threat_actors',
        query: filterConfig,
      })
      setSaveFilterName('')
      setSavedFiltersOpen(false)
      loadSavedFilters()
    } catch (error) {
      console.error('Error saving filter:', error)
    }
  }

  function applySavedFilter(filter) {
    const q = filter.query || {}
    setSearch(q.search || '')
    setSectorFilter(q.sectorFilter || '')
    setTrendFilter(q.trendFilter || '')
    setTypeFilter(q.typeFilter || '')
    setStatusFilter(q.statusFilter || '')
    if (q.sortConfig) setSortConfig(q.sortConfig)
    setSavedFiltersOpen(false)
  }

  async function deleteSavedFilter(id) {
    try {
      await savedSearches.delete(id)
      loadSavedFilters()
    } catch (error) {
      console.error('Error deleting filter:', error)
    }
  }

  // Feature 2: Export to CSV
  function exportToCSV() {
    const headers = ['Name', 'Type', 'Trend', 'Incidents 7d', 'Incidents Prev 7d', 'Last Seen', 'Status', 'Risk Score', 'Aliases', 'Target Sectors']
    const rows = sortedActors.map(actor => [
      actor.name,
      actor.actor_type || 'unknown',
      actor.trend_status || 'STABLE',
      actor.incidents_7d || 0,
      actor.incidents_prev_7d || 0,
      actor.last_seen || '',
      actor.status || 'active',
      riskScores[actor.id] || 0,
      (actor.aliases || []).join('; '),
      (actor.target_sectors || []).join('; ')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `threat-actors-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Feature 5: Related Actors
  async function loadRelatedActors(actor) {
    try {
      // Find actors with similar TTPs or target sectors
      const { data } = await threatActors.getAll({ limit: 100 })
      if (!data) return

      const related = data
        .filter(a => a.id !== actor.id)
        .map(a => {
          let score = 0
          // Same type
          if (a.actor_type === actor.actor_type) score += 20
          // Overlapping target sectors
          const sharedSectors = (a.target_sectors || []).filter(s =>
            (actor.target_sectors || []).includes(s)
          )
          score += sharedSectors.length * 15
          // Overlapping TTPs
          const sharedTTPs = (a.ttps || []).filter(t =>
            (actor.ttps || []).includes(t)
          )
          score += sharedTTPs.length * 10
          return { ...a, similarityScore: score }
        })
        .filter(a => a.similarityScore > 0)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 5)

      setRelatedActors(related)
    } catch (error) {
      console.error('Error loading related actors:', error)
    }
  }

  // Feature 6: Quick Watchlist (Shift+click)
  function handleRowClick(actor, event) {
    if (event.shiftKey) {
      // Toggle selection for bulk watchlist
      setSelectedRows(prev => {
        const next = new Set(prev)
        if (next.has(actor.id)) {
          next.delete(actor.id)
        } else {
          next.add(actor.id)
        }
        return next
      })
    } else {
      setSelectedActor(actor)
      setSelectedRows(new Set())
    }
  }

  async function addSelectedToWatchlist() {
    if (selectedRows.size === 0) return

    try {
      const { data: lists } = await watchlists.getAll()
      const actorList = lists?.find(w => w.entity_type === 'threat_actor')

      if (!actorList) {
        alert('No watchlist found for threat actors. Create one first.')
        return
      }

      for (const actorId of selectedRows) {
        await watchlists.addItem(actorList.id, actorId)
      }

      alert(`Added ${selectedRows.size} actors to watchlist`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('Error adding to watchlist:', error)
    }
  }

  // Feature 9: Load org profile for risk scoring
  async function loadOrgProfile() {
    try {
      const profile = await orgProfile.get()
      setUserOrgProfile(profile)
    } catch (error) {
      console.error('Error loading org profile:', error)
    }
  }


  // Load incidents when an actor is selected
  useEffect(() => {
    if (selectedActor) {
      loadActorIncidents(selectedActor.id)
    } else {
      setActorIncidents([])
    }
  }, [selectedActor])

  async function loadActorIncidents(actorId) {
    try {
      const { data } = await incidents.getRecent({ actor_id: actorId, limit: 20, days: 365 })
      setActorIncidents(data || [])
    } catch (error) {
      console.error('Error loading actor incidents:', error)
    }
  }

  // Convert incidents to timeline events
  const timelineEvents = actorIncidents.map((incident) => ({
    id: incident.id,
    type: 'incident',
    title: incident.victim_name || 'Unknown Victim',
    description: `${incident.victim_sector || 'Unknown sector'} - ${incident.status || 'claimed'}`,
    date: incident.discovered_date,
    tags: [incident.victim_country].filter(Boolean),
  }))

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threat Actors</h1>
          <p className="text-gray-400 text-sm mt-1">
            {totalCount.toLocaleString()} actors total
            {(typeFilter || trendFilter || statusFilter || sectorFilter || search) &&
              ` • ${sortedActors.length} shown`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Feature 6: Bulk watchlist button */}
          {selectedRows.size > 0 && (
            <button
              onClick={addSelectedToWatchlist}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Add {selectedRows.size} to Watchlist
            </button>
          )}

          {/* Feature 3: Saved Filters dropdown */}
          <div className="relative">
            <button
              onClick={() => setSavedFiltersOpen(!savedFiltersOpen)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Saved Filters
            </button>
            {savedFiltersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSavedFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-2 min-w-[250px]">
                  {/* Save current filter */}
                  <div className="px-3 pb-2 border-b border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={saveFilterName}
                        onChange={(e) => setSaveFilterName(e.target.value)}
                        placeholder="Filter name..."
                        className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-300"
                      />
                      <button
                        onClick={saveCurrentFilter}
                        disabled={!saveFilterName.trim()}
                        className="px-2 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {/* Saved filters list */}
                  {savedFiltersList.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No saved filters</div>
                  ) : (
                    savedFiltersList.map(filter => (
                      <div key={filter.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800">
                        <button
                          onClick={() => applySavedFilter(filter)}
                          className="flex-1 text-left text-sm text-gray-300 hover:text-white"
                        >
                          {filter.name}
                        </button>
                        <button
                          onClick={() => deleteSavedFilter(filter.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Feature 2: Export button */}
          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-1.5"
            title="Export to CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>

          {/* Feature 8: View mode toggle */}
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'overview' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-600 flex gap-4">
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↑↓</kbd> Navigate</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> View details</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">/</kbd> Search</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Shift+Click</kbd> Select multiple</span>
      </div>

      {/* Trend Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Tooltip
          content={FIELD_TOOLTIPS.escalating_summary.content}
          source={FIELD_TOOLTIPS.escalating_summary.source}
          position="bottom"
        >
          <button
            onClick={() => setTrendFilter(trendFilter === 'ESCALATING' ? '' : 'ESCALATING')}
            className={`cyber-card text-center cursor-pointer transition-all w-full ${
              trendFilter === 'ESCALATING' ? 'ring-2 ring-red-500' : ''
            }`}
          >
            <div className="text-2xl font-bold text-red-400">{trendSummary.escalating}</div>
            <div className="text-sm text-gray-400">Escalating</div>
          </button>
        </Tooltip>
        <Tooltip
          content={FIELD_TOOLTIPS.stable_summary.content}
          source={FIELD_TOOLTIPS.stable_summary.source}
          position="bottom"
        >
          <button
            onClick={() => setTrendFilter(trendFilter === 'STABLE' ? '' : 'STABLE')}
            className={`cyber-card text-center cursor-pointer transition-all w-full ${
              trendFilter === 'STABLE' ? 'ring-2 ring-gray-500' : ''
            }`}
          >
            <div className="text-2xl font-bold text-gray-400">{trendSummary.stable}</div>
            <div className="text-sm text-gray-400">Stable</div>
          </button>
        </Tooltip>
        <Tooltip
          content={FIELD_TOOLTIPS.declining_summary.content}
          source={FIELD_TOOLTIPS.declining_summary.source}
          position="bottom"
        >
          <button
            onClick={() => setTrendFilter(trendFilter === 'DECLINING' ? '' : 'DECLINING')}
            className={`cyber-card text-center cursor-pointer transition-all w-full ${
              trendFilter === 'DECLINING' ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="text-2xl font-bold text-green-400">{trendSummary.declining}</div>
            <div className="text-sm text-gray-400">Declining</div>
          </button>
        </Tooltip>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actors by name..."
            className="cyber-input w-full"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className={`cyber-input ${sectorFilter ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
          title="Filter by target sector"
        >
          <option value="">All Sectors</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector.charAt(0).toUpperCase() + sector.slice(1)}
            </option>
          ))}
        </select>
        {/* Active filters indicator and clear button */}
        {(typeFilter || trendFilter || statusFilter || sectorFilter || search) && (
          <button
            onClick={() => {
              setTypeFilter('')
              setTrendFilter('')
              setStatusFilter('')
              setSectorFilter('')
              setSearch('')
              setSortConfig({ field: 'incidents_7d', direction: 'desc' })
            }}
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 px-3 py-2 rounded border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear all filters
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'overview' ? (
        /* Feature 8: Overview View - Actor analytics dashboard */
        <div className="space-y-6">
          {loading ? (
            <div className="cyber-card p-12 text-center">
              <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="text-gray-400">Loading actor data...</div>
            </div>
          ) : (() => {
            // Use loaded actors for breakdowns (limited sample)
            const sampleActors = actors

            // Calculate all statistics
            const typeCounts = {}
            const trendCounts = { ESCALATING: [], STABLE: [], DECLINING: [] }
            const sectorCounts = {}
            const regionCounts = {}
            let totalIncidents7d = 0

            sampleActors.forEach(actor => {
              // Type counts
              const type = actor.actor_type || 'unknown'
              typeCounts[type] = (typeCounts[type] || 0) + 1

              // Trend with actor data
              const trend = actor.trend_status || 'STABLE'
              if (trendCounts[trend]) {
                trendCounts[trend].push(actor)
              }

              // Sector counts
              (actor.target_sectors || []).forEach(s => {
                sectorCounts[s] = (sectorCounts[s] || 0) + 1
              })

              // Region counts
              const regions = actor.target_countries || actor.target_regions || []
              regions.forEach(r => {
                regionCounts[r] = (regionCounts[r] || 0) + 1
              })

              totalIncidents7d += actor.incidents_7d || 0
            })

            // Get top active actors
            const topActiveActors = [...sampleActors]
              .sort((a, b) => (b.incidents_7d || 0) - (a.incidents_7d || 0))
              .slice(0, 10)

            // Get recently active actors
            const recentlyActiveActors = [...sampleActors]
              .filter(a => a.last_seen)
              .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
              .slice(0, 10)

            return (
              <>
                {/* Summary Stats Row - uses database totals for accuracy */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="cyber-card text-center">
                    <div className="text-3xl font-bold text-white">{totalCount.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">Total Actors</div>
                  </div>
                  <div className="cyber-card text-center">
                    <div className="text-3xl font-bold text-red-400">{trendSummary.escalating}</div>
                    <div className="text-sm text-gray-400">Escalating</div>
                  </div>
                  <div className="cyber-card text-center">
                    <div className="text-3xl font-bold text-cyan-400">{totalIncidents7d}</div>
                    <div className="text-sm text-gray-400">Incidents (7d)*</div>
                  </div>
                  <div className="cyber-card text-center">
                    <div className="text-3xl font-bold text-yellow-400">{Object.keys(sectorCounts).length || '—'}</div>
                    <div className="text-sm text-gray-400">Target Sectors</div>
                  </div>
                  <div className="cyber-card text-center">
                    <div className="text-3xl font-bold text-purple-400">{Object.keys(typeCounts).length}</div>
                    <div className="text-sm text-gray-400">Actor Types</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 text-right">* Based on loaded sample of {sampleActors.length} actors</div>

                {/* Actor Type Breakdown */}
                <div className="cyber-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Actors by Type</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(typeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <button
                          key={type}
                          className={`p-4 rounded-lg cursor-pointer transition-all border hover:scale-105 ${getTypeConfig(type).color} ${typeFilter === type ? 'ring-2 ring-white' : ''}`}
                          onClick={() => {
                            setTypeFilter(typeFilter === type ? '' : type)
                            setViewMode('table')
                          }}
                        >
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-xs capitalize mt-1">{type.replace(/_/g, ' ')}</div>
                          <div className="text-xs opacity-60 mt-1">{((count / (sampleActors.length || 1)) * 100).toFixed(1)}%</div>
                        </button>
                      ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Active Actors */}
                  <div className="cyber-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Most Active (7d)</h3>
                    <div className="space-y-2">
                      {topActiveActors.map((actor, i) => (
                        <button
                          key={actor.id}
                          onClick={() => {
                            setSelectedActor(actor)
                            setViewMode('table')
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                          <span className="flex-1 text-white font-medium">{actor.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs border ${getTypeConfig(actor.actor_type).color}`}>
                            {(actor.actor_type || 'unknown').replace(/_/g, ' ')}
                          </span>
                          <span className="text-cyan-400 font-mono">{actor.incidents_7d || 0}</span>
                          <TrendBadge status={actor.trend_status} showLabel={false} />
                        </button>
                      ))}
                      {topActiveActors.length === 0 && (
                        <div className="text-gray-500 text-center py-4">No incident data available</div>
                      )}
                    </div>
                  </div>

                  {/* Recently Active Actors */}
                  <div className="cyber-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recently Active</h3>
                    <div className="space-y-2">
                      {recentlyActiveActors.map((actor, i) => (
                        <button
                          key={actor.id}
                          onClick={() => {
                            setSelectedActor(actor)
                            setViewMode('table')
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                          <span className="flex-1 text-white font-medium">{actor.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs border ${getTypeConfig(actor.actor_type).color}`}>
                            {(actor.actor_type || 'unknown').replace(/_/g, ' ')}
                          </span>
                          <SmartTime date={actor.last_seen} className="text-gray-400 text-sm" />
                        </button>
                      ))}
                      {recentlyActiveActors.length === 0 && (
                        <div className="text-gray-500 text-center py-4">No recent activity data</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Escalating Actors */}
                {trendCounts.ESCALATING.length > 0 && (
                  <div className="cyber-card p-6 border-red-900/50 border">
                    <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Escalating Actors ({trendCounts.ESCALATING.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {trendCounts.ESCALATING
                        .sort((a, b) => (b.incidents_7d || 0) - (a.incidents_7d || 0))
                        .slice(0, 20)
                        .map(actor => (
                          <button
                            key={actor.id}
                            onClick={() => {
                              setSelectedActor(actor)
                              setViewMode('table')
                            }}
                            className="px-3 py-1.5 bg-red-900/30 border border-red-800 rounded hover:bg-red-900/50 transition-colors text-sm"
                          >
                            <span className="text-white">{actor.name}</span>
                            {actor.incidents_7d > 0 && (
                              <span className="text-red-400 ml-2">{actor.incidents_7d}</span>
                            )}
                          </button>
                        ))}
                      {trendCounts.ESCALATING.length > 20 && (
                        <span className="px-3 py-1.5 text-gray-500 text-sm">+{trendCounts.ESCALATING.length - 20} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Sector and Region Data (if available) */}
                {(Object.keys(sectorCounts).length > 0 || Object.keys(regionCounts).length > 0) && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Sectors */}
                    {Object.keys(sectorCounts).length > 0 && (
                      <div className="cyber-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">By Target Sector</h3>
                        <div className="space-y-2">
                          {Object.entries(sectorCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10)
                            .map(([sector, count]) => (
                              <button
                                key={sector}
                                onClick={() => {
                                  setSectorFilter(sector)
                                  setViewMode('table')
                                }}
                                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                                      style={{ width: `${(count / Object.values(sectorCounts)[0]) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-gray-300 capitalize w-28 text-left">{sector}</span>
                                <span className="text-cyan-400 font-mono w-12 text-right">{count}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Regions */}
                    {Object.keys(regionCounts).length > 0 && (
                      <div className="cyber-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">By Target Region</h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(regionCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 20)
                            .map(([region, count]) => (
                              <span key={region} className="px-3 py-1 bg-gray-800 rounded text-sm">
                                <span className="text-white">{region}</span>
                                <span className="text-gray-500 ml-1">({count})</span>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No data hint */}
                {Object.keys(sectorCounts).length === 0 && Object.keys(regionCounts).length === 0 && (
                  <div className="cyber-card p-6 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p>Target sector and region data is not yet populated for most actors.</p>
                    <p className="text-sm mt-1">Use the type and activity breakdowns above to explore actors.</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      ) : (
      <div className="flex gap-6">
        {/* Actor List */}
        <div className="flex-1" ref={tableRef}>
          {loading ? (
            <SkeletonTable rows={8} cols={6} />
          ) : sortedActors.length === 0 ? (
            <EmptyActors />
          ) : (
            <div className="cyber-card overflow-hidden">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>
                      <ColumnMenu
                        field="name"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={null}
                        onFilter={() => {}}
                        tooltip={FIELD_TOOLTIPS.actor_name}
                      >
                        Actor
                      </ColumnMenu>
                    </th>
                    <th className="hidden md:table-cell">
                      <ColumnMenu
                        field="actor_type"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={typeFilter}
                        onFilter={setTypeFilter}
                        filterOptions={TYPE_FILTER_OPTIONS}
                        tooltip={FIELD_TOOLTIPS.actor_type}
                      >
                        Type
                      </ColumnMenu>
                    </th>
                    <th>
                      <ColumnMenu
                        field="trend_status"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={trendFilter}
                        onFilter={setTrendFilter}
                        filterOptions={TREND_FILTER_OPTIONS}
                        tooltip={FIELD_TOOLTIPS.trend_status}
                      >
                        Trend
                      </ColumnMenu>
                    </th>
                    <th className="hidden lg:table-cell">
                      <ColumnMenu
                        field="incidents_7d"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={null}
                        onFilter={() => {}}
                        tooltip={{
                          content: 'Current week incidents / previous week incidents. Velocity shows incidents per day.',
                          source: 'ransomware.live'
                        }}
                      >
                        7d / Prev
                      </ColumnMenu>
                    </th>
                    <th className="hidden md:table-cell">
                      <ColumnMenu
                        field="last_seen"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={null}
                        onFilter={() => {}}
                        tooltip={FIELD_TOOLTIPS.last_seen}
                      >
                        Last Seen
                      </ColumnMenu>
                    </th>
                    <th>
                      <ColumnMenu
                        field="status"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                        currentFilter={statusFilter}
                        onFilter={setStatusFilter}
                        filterOptions={STATUS_FILTER_OPTIONS}
                        tooltip={FIELD_TOOLTIPS.status}
                      >
                        Status
                      </ColumnMenu>
                    </th>
                    {/* Feature 9: Risk Score column */}
                    {userOrgProfile && (
                      <th className="hidden xl:table-cell">
                        <ColumnMenu
                          field="risk_score"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={null}
                          onFilter={() => {}}
                          tooltip={{
                            content: 'Relevance to your organization based on your sector and tech stack profile.',
                            source: 'Calculated from org profile'
                          }}
                        >
                          Risk
                        </ColumnMenu>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedActors.map((actor, index) => (
                    <tr
                      key={actor.id}
                      onClick={(e) => handleRowClick(actor, e)}
                      className={`cursor-pointer transition-colors ${
                        selectedRows.has(actor.id) ? 'bg-cyan-900/30' : ''
                      } ${
                        focusedRowIndex === index ? 'ring-1 ring-inset ring-cyan-500' : ''
                      }`}
                    >
                      {/* Actor Name Cell */}
                      <td>
                        <div className="flex items-center gap-2">
                          <WatchButton entityType="threat_actor" entityId={actor.id} size="sm" />
                          <div>
                            <Tooltip
                              content={FIELD_TOOLTIPS.actor_name.content}
                              source={actor.source || 'Multiple sources'}
                              position="right"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{actor.name}</span>
                                <NewBadge date={actor.last_seen} thresholdHours={48} />
                              </div>
                            </Tooltip>
                            {actor.aliases?.length > 0 && (
                              <Tooltip
                                content={`All aliases: ${actor.aliases.join(', ')}`}
                                source={FIELD_TOOLTIPS.aliases.source}
                                position="bottom"
                              >
                                <div className="text-xs text-gray-500">
                                  aka {actor.aliases.slice(0, 2).join(', ')}
                                  {actor.aliases.length > 2 && ` +${actor.aliases.length - 2}`}
                                </div>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actor Type Cell */}
                      <td className="hidden md:table-cell">
                        <Tooltip
                          content={getTypeConfig(actor.actor_type).tooltip}
                          source={FIELD_TOOLTIPS.actor_type.source}
                          position="right"
                        >
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeConfig(actor.actor_type).color}`}>
                            {(actor.actor_type || 'unknown').replace(/_/g, ' ')}
                          </span>
                        </Tooltip>
                      </td>

                      {/* Trend Status Cell */}
                      <td>
                        <Tooltip
                          content={
                            actor.trend_status === 'ESCALATING'
                              ? `Activity increased ${actor.incidents_7d > 0 && actor.incidents_prev_7d > 0 ? Math.round(((actor.incidents_7d - actor.incidents_prev_7d) / actor.incidents_prev_7d) * 100) : ''}% vs previous week.`
                              : actor.trend_status === 'DECLINING'
                              ? `Activity decreased vs previous week.`
                              : 'Activity is stable compared to previous week.'
                          }
                          source={FIELD_TOOLTIPS.trend_status.source}
                          position="right"
                        >
                          <span>
                            <TrendBadge status={actor.trend_status} showLabel={false} />
                          </span>
                        </Tooltip>
                      </td>

                      {/* Incidents 7d / Prev Cell with Sparkline */}
                      <td className="hidden lg:table-cell text-sm">
                        <Tooltip
                          content={`This week: ${actor.incidents_7d || 0} incidents. Last week: ${actor.incidents_prev_7d || 0} incidents.${
                            actor.incident_velocity > 0
                              ? ` Averaging ${actor.incident_velocity} incidents per day.`
                              : ''
                          }`}
                          source="ransomware.live"
                          position="left"
                        >
                          <div className="flex items-center gap-2">
                            {/* Feature 4: Activity Sparkline */}
                            {(actor.incidents_7d > 0 || actor.incidents_prev_7d > 0) && (
                              <Sparkline
                                data={[
                                  actor.incidents_prev_7d || 0,
                                  Math.round((actor.incidents_prev_7d || 0) * 0.8 + (actor.incidents_7d || 0) * 0.2),
                                  Math.round((actor.incidents_prev_7d || 0) * 0.5 + (actor.incidents_7d || 0) * 0.5),
                                  Math.round((actor.incidents_prev_7d || 0) * 0.2 + (actor.incidents_7d || 0) * 0.8),
                                  actor.incidents_7d || 0
                                ]}
                                width={40}
                                height={16}
                                showTrend={false}
                              />
                            )}
                            <span>
                              <span className="text-white font-medium">{actor.incidents_7d || 0}</span>
                              <span className="text-gray-500"> / </span>
                              <span className="text-gray-400">{actor.incidents_prev_7d || 0}</span>
                            </span>
                          </div>
                        </Tooltip>
                      </td>

                      {/* Last Seen Cell */}
                      <td className="hidden md:table-cell text-sm text-gray-400">
                        <Tooltip
                          content={FIELD_TOOLTIPS.last_seen.content}
                          source={FIELD_TOOLTIPS.last_seen.source}
                          position="left"
                        >
                          <span>
                            <SmartTime date={actor.last_seen} />
                          </span>
                        </Tooltip>
                      </td>

                      {/* Status Cell */}
                      <td>
                        <Tooltip
                          content={FIELD_TOOLTIPS.status.content}
                          source={FIELD_TOOLTIPS.status.source}
                          position="left"
                        >
                          <span
                            className={`badge-${
                              actor.status === 'active' ? 'high' : 'low'
                            }`}
                          >
                            {actor.status || 'active'}
                          </span>
                        </Tooltip>
                      </td>

                      {/* Feature 9: Risk Score Cell */}
                      {userOrgProfile && (
                        <td className="hidden xl:table-cell">
                          {riskScores[actor.id] > 0 ? (
                            <Tooltip
                              content={`Relevance score based on your org profile: ${
                                riskScores[actor.id] >= 80 ? 'Critical - high relevance to your sector/region' :
                                riskScores[actor.id] >= 60 ? 'High - significant overlap with your profile' :
                                riskScores[actor.id] >= 40 ? 'Medium - some relevance to your organization' :
                                'Low - limited relevance'
                              }`}
                              position="left"
                            >
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                riskScores[actor.id] >= 80 ? 'bg-red-900/50 text-red-400' :
                                riskScores[actor.id] >= 60 ? 'bg-orange-900/50 text-orange-400' :
                                riskScores[actor.id] >= 40 ? 'bg-yellow-900/50 text-yellow-400' :
                                'bg-blue-900/50 text-blue-400'
                              }`}>
                                {riskScores[actor.id]}
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Feature 1: Load More button */}
              {hasMore && (
                <div className="p-4 text-center border-t border-gray-800">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      `Load More (${actors.length} of ${totalCount})`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actor Detail Panel */}
        {selectedActor && (
          <div className="w-80 cyber-card hidden lg:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{selectedActor.name}</h3>
              <button
                onClick={() => setSelectedActor(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Trend Status */}
              <div className="p-3 rounded-lg bg-gray-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500">Trend Status</span>
                  <TrendBadge status={selectedActor.trend_status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Last 7 days:</span>
                    <span className="text-white ml-1">{selectedActor.incidents_7d || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Previous 7d:</span>
                    <span className="text-gray-400 ml-1">{selectedActor.incidents_prev_7d || 0}</span>
                  </div>
                </div>
                {selectedActor.incident_velocity > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Velocity: {selectedActor.incident_velocity} incidents/day
                  </div>
                )}
              </div>

              {/* AI Summary */}
              {selectedActor.ai_summary && (
                <div className="p-3 rounded-lg bg-cyber-accent/10 border border-cyber-accent/30">
                  <div className="text-xs text-cyber-accent mb-1 font-medium">AI Summary</div>
                  <div className="text-gray-300 text-xs">{selectedActor.ai_summary}</div>
                </div>
              )}

              {selectedActor.aliases?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Aliases</div>
                  <div className="text-gray-300">{selectedActor.aliases.join(', ')}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">First Seen</div>
                  <div className="text-gray-300">{selectedActor.first_seen || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Last Seen</div>
                  <div className="text-gray-300">{selectedActor.last_seen || 'Unknown'}</div>
                </div>
              </div>

              {selectedActor.target_sectors?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Target Sectors</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedActor.target_sectors.map((sector) => (
                      <span key={sector} className="badge-info">
                        {sector}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedActor.ttps?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">TTPs (MITRE)</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedActor.ttps.map((ttp) => (
                      <span key={ttp} className="text-xs font-mono text-cyber-accent">
                        {ttp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedActor.description && (
                <div>
                  <div className="text-gray-500 mb-1">Description</div>
                  <div className="text-gray-300 text-xs">{selectedActor.description}</div>
                </div>
              )}

              {/* Activity Timeline */}
              {timelineEvents.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <div className="text-gray-500 mb-2">Recent Activity ({timelineEvents.length} incidents)</div>
                  <Timeline events={timelineEvents} maxItems={5} className="max-h-64 overflow-y-auto" />
                </div>
              )}

              {/* Correlation Panel - TTPs, CVEs, IOCs */}
              <div className="pt-4 border-t border-gray-800">
                <CorrelationPanel actorId={selectedActor.id} actorName={selectedActor.name} />
              </div>

              {/* Feature 5: Related Actors */}
              {relatedActors.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <div className="text-gray-500 mb-2">Similar Actors</div>
                  <div className="space-y-2">
                    {relatedActors.map(actor => (
                      <button
                        key={actor.id}
                        onClick={() => setSelectedActor(actor)}
                        className="w-full flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 text-left transition-colors"
                      >
                        <div>
                          <div className="text-sm text-white">{actor.name}</div>
                          <div className="text-xs text-gray-500">
                            {actor.actor_type} • {actor.similarityScore}% match
                          </div>
                        </div>
                        <TrendBadge status={actor.trend_status} showLabel={false} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800">
                <div className="text-gray-500 text-xs">
                  Source: {selectedActor.source || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
