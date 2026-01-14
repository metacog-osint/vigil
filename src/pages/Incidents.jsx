import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { incidents, subscribeToTable, savedSearches, threatActors, watchlists } from '../lib/supabase'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyIncidents } from '../components/EmptyState'
import { NewBadge } from '../components/NewIndicator'
import { WatchButton } from '../components/WatchButton'
import { SmartTime, FullDate } from '../components/TimeDisplay'
import { Tooltip, ColumnMenu } from '../components/Tooltip'
import { Sparkline } from '../components/Sparkline'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'

// Chart colors
const CHART_COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#ec4899', '#6366f1']
const SECTOR_COLORS = {
  technology: '#06b6d4',
  finance: '#10b981',
  healthcare: '#ef4444',
  manufacturing: '#f59e0b',
  retail: '#8b5cf6',
  education: '#ec4899',
  energy: '#f97316',
  government: '#6366f1',
  other: '#6b7280',
}

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

const TIME_RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'All', value: 0 },
]

const STATUS_OPTIONS = [
  { value: 'claimed', label: 'Claimed', color: 'bg-orange-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-red-400' },
  { value: 'leaked', label: 'Leaked', color: 'bg-red-600' },
  { value: 'paid', label: 'Paid', color: 'bg-yellow-400' },
]

const SECTOR_FILTER_OPTIONS = SECTORS.map(s => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
  color: 'bg-cyan-400'
}))

// Page size for pagination
const PAGE_SIZE = 50

export default function Incidents() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [incidentList, setIncidentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [timeRange, setTimeRange] = useState(30)
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [sortConfig, setSortConfig] = useState({ field: 'discovered_date', direction: 'desc' })

  // Actor filter from URL (when coming from ThreatActors page)
  const [actorFilter, setActorFilter] = useState('')
  const [actorName, setActorName] = useState('')

  // Pagination
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Saved filters
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersList, setSavedFiltersList] = useState([])
  const [saveFilterName, setSaveFilterName] = useState('')

  // Keyboard navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableRef = useRef(null)

  // View mode (table or overview)
  const [viewMode, setViewMode] = useState('table')

  // Bulk selection
  const [selectedRows, setSelectedRows] = useState(new Set())

  // Data freshness
  const [lastIncidentDate, setLastIncidentDate] = useState(null)

  // Actor incident counts for sparklines
  const [actorTrends, setActorTrends] = useState({})

  // Handle URL params for actor filter
  useEffect(() => {
    const actorId = searchParams.get('actor')
    if (actorId) {
      setActorFilter(actorId)
      // Load actor name
      loadActorName(actorId)
    }
  }, [searchParams])

  async function loadActorName(actorId) {
    try {
      const { data } = await threatActors.getById(actorId)
      if (data) {
        setActorName(data.name)
      }
    } catch (error) {
      console.error('Error loading actor:', error)
    }
  }

  // Sort incidents
  const sortedIncidents = useMemo(() => {
    return [...incidentList].sort((a, b) => {
      if (!sortConfig) return 0

      const { field, direction } = sortConfig
      let aVal = a[field]
      let bVal = b[field]

      // Handle nested threat_actor field
      if (field === 'actor_name') {
        aVal = a.threat_actor?.name || ''
        bVal = b.threat_actor?.name || ''
      }

      // Handle nulls
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''

      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      // Date comparison
      if (field === 'discovered_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [incidentList, sortConfig])

  // Initial load + subscriptions
  useEffect(() => {
    loadIncidents(true)
    loadSavedFilters()

    const unsubscribe = subscribeToTable('incidents', (payload) => {
      if (payload.eventType === 'INSERT') {
        setIncidentList((prev) => [payload.new, ...prev])
        setTotalCount(c => c + 1)
      }
    })

    return () => unsubscribe()
  }, [search, sectorFilter, statusFilter, countryFilter, timeRange, actorFilter])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode === 'overview' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedRowIndex(i => Math.min(i + 1, sortedIncidents.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedRowIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          if (focusedRowIndex >= 0 && sortedIncidents[focusedRowIndex]) {
            setSelectedIncident(sortedIncidents[focusedRowIndex])
          }
          break
        case 'Escape':
          setSelectedIncident(null)
          setFocusedRowIndex(-1)
          setSelectedRows(new Set())
          break
        case '/':
          e.preventDefault()
          document.querySelector('input[type="text"]')?.focus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, focusedRowIndex, sortedIncidents])

  async function loadIncidents(reset = false) {
    if (reset) {
      setLoading(true)
      setIncidentList([])
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : incidentList.length
      const { data, error, count } = await incidents.getAll({
        search,
        sector: sectorFilter,
        status: statusFilter,
        country: countryFilter,
        actor_id: actorFilter,
        days: timeRange,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setIncidentList(data || [])
        // Set data freshness from most recent incident
        if (data && data.length > 0) {
          setLastIncidentDate(data[0].discovered_date)
        }
        // Calculate actor trends for sparklines
        calculateActorTrends(data || [])
      } else {
        setIncidentList(prev => [...prev, ...(data || [])])
      }
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Calculate actor incident trends for sparklines
  function calculateActorTrends(data) {
    const trends = {}
    const now = new Date()

    data.forEach(inc => {
      const actorId = inc.actor_id
      if (!actorId) return

      if (!trends[actorId]) {
        trends[actorId] = { week1: 0, week2: 0, week3: 0, week4: 0 }
      }

      const incDate = new Date(inc.discovered_date)
      const daysAgo = Math.floor((now - incDate) / (1000 * 60 * 60 * 24))

      if (daysAgo <= 7) trends[actorId].week1++
      else if (daysAgo <= 14) trends[actorId].week2++
      else if (daysAgo <= 21) trends[actorId].week3++
      else if (daysAgo <= 28) trends[actorId].week4++
    })

    setActorTrends(trends)
  }

  const loadMore = () => {
    if (!loadingMore && incidentList.length < totalCount) {
      loadIncidents(false)
    }
  }

  const hasMore = incidentList.length < totalCount

  // Saved filters
  async function loadSavedFilters() {
    try {
      const { data } = await savedSearches.getAll('anonymous', 'incidents')
      setSavedFiltersList(data || [])
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  async function saveCurrentFilter() {
    if (!saveFilterName.trim()) return

    const filterConfig = {
      search, sectorFilter, statusFilter, countryFilter, timeRange, sortConfig, actorFilter
    }

    try {
      await savedSearches.create({
        user_id: 'anonymous',
        name: saveFilterName,
        search_type: 'incidents',
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
    setStatusFilter(q.statusFilter || '')
    setCountryFilter(q.countryFilter || '')
    setTimeRange(q.timeRange || 30)
    setActorFilter(q.actorFilter || '')
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

  // CSV Export
  function exportToCSV() {
    const dataToExport = selectedRows.size > 0
      ? sortedIncidents.filter(inc => selectedRows.has(inc.id))
      : sortedIncidents

    const headers = ['Victim', 'Actor', 'Sector', 'Country', 'Status', 'Discovered', 'Website', 'Source']
    const rows = dataToExport.map(inc => [
      inc.victim_name || '',
      inc.threat_actor?.name || '',
      inc.victim_sector || '',
      inc.victim_country || '',
      inc.status || '',
      inc.discovered_date || '',
      inc.victim_website || '',
      inc.source || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `incidents-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Navigate to actor
  function goToActor(actorId) {
    if (actorId) {
      navigate(`/actors?actor=${actorId}`)
    }
  }

  // Bulk select with shift+click
  function handleRowClick(incident, event) {
    if (event.shiftKey) {
      setSelectedRows(prev => {
        const next = new Set(prev)
        if (next.has(incident.id)) {
          next.delete(incident.id)
        } else {
          next.add(incident.id)
        }
        return next
      })
    } else {
      setSelectedIncident(incident)
      setSelectedRows(new Set())
    }
  }

  async function addSelectedToWatchlist() {
    if (selectedRows.size === 0) return

    try {
      const { data: lists } = await watchlists.getAll()
      const incidentList = lists?.find(w => w.entity_type === 'incident')

      if (!incidentList) {
        alert('No watchlist found for incidents. Create one first.')
        return
      }

      for (const incidentId of selectedRows) {
        await watchlists.addItem(incidentList.id, incidentId)
      }

      alert(`Added ${selectedRows.size} incidents to watchlist`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('Error adding to watchlist:', error)
    }
  }

  // Clear actor filter
  function clearActorFilter() {
    setActorFilter('')
    setActorName('')
    setSearchParams({})
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'claimed': return 'bg-orange-900/50 text-orange-400 border border-orange-800'
      case 'confirmed': return 'bg-red-900/50 text-red-400 border border-red-800'
      case 'leaked': return 'bg-red-900/70 text-red-300 border border-red-700'
      case 'paid': return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
      default: return 'bg-gray-800/50 text-gray-400 border border-gray-700'
    }
  }

  // Compute analytics for overview
  const analytics = useMemo(() => {
    if (incidentList.length === 0) return null

    const actorCounts = {}
    const sectorCounts = {}
    const countryCounts = {}
    const statusCounts = {}
    const dailyCounts = {}

    for (const incident of incidentList) {
      const actorName = incident.threat_actor?.name || 'Unknown'
      const actorId = incident.actor_id
      const sectorName = incident.victim_sector || 'Other'
      const countryName = incident.victim_country || 'Unknown'
      const status = incident.status || 'unknown'

      // Actor counts with ID
      if (!actorCounts[actorName]) {
        actorCounts[actorName] = { count: 0, id: actorId }
      }
      actorCounts[actorName].count++

      sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1
      countryCounts[countryName] = (countryCounts[countryName] || 0) + 1
      statusCounts[status] = (statusCounts[status] || 0) + 1

      // Daily timeline
      if (incident.discovered_date) {
        const dateKey = incident.discovered_date.split('T')[0]
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1
      }
    }

    const topActors = Object.entries(actorCounts)
      .map(([name, data]) => ({ name, count: data.count, id: data.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topSectors = Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Sector data for pie chart (with colors)
    const sectorPieData = topSectors.slice(0, 8).map(s => ({
      name: s.name.charAt(0).toUpperCase() + s.name.slice(1),
      value: s.count,
      color: SECTOR_COLORS[s.name.toLowerCase()] || SECTOR_COLORS.other
    }))

    const topCountries = Object.entries(countryCounts)
      .filter(([name]) => name !== 'Unknown')
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    const statuses = Object.entries(statusCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Timeline data - adapts to selected time range
    const timelineData = []
    const now = new Date()
    const days = timeRange === 0 ? 90 : timeRange // Default to 90 for "All"

    // Determine label interval based on time range
    let labelInterval
    if (days <= 7) labelInterval = 1
    else if (days <= 30) labelInterval = 5
    else if (days <= 90) labelInterval = 10
    else labelInterval = 30

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      timelineData.push({
        date: dateKey,
        label: i % labelInterval === 0 ? monthDay : '',
        incidents: dailyCounts[dateKey] || 0
      })
    }

    return { topActors, topSectors, sectorPieData, topCountries, statuses, timelineData }
  }, [incidentList, timeRange])

  const hasActiveFilters = search || sectorFilter || statusFilter || countryFilter || actorFilter || timeRange !== 30

  // Data freshness indicator
  const dataFreshness = useMemo(() => {
    if (!lastIncidentDate) return null
    const date = new Date(lastIncidentDate)
    const now = new Date()
    const hoursAgo = Math.floor((now - date) / (1000 * 60 * 60))

    if (hoursAgo < 24) return { text: `${hoursAgo}h ago`, color: 'text-green-400' }
    if (hoursAgo < 72) return { text: `${Math.floor(hoursAgo / 24)}d ago`, color: 'text-yellow-400' }
    return { text: `${Math.floor(hoursAgo / 24)}d ago`, color: 'text-red-400' }
  }, [lastIncidentDate])

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ransomware Incidents</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400 text-sm">
              {totalCount.toLocaleString()} incidents total
              {hasActiveFilters && ` • ${sortedIncidents.length} shown`}
            </p>
            {dataFreshness && (
              <span className={`text-xs ${dataFreshness.color} flex items-center gap-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Latest: {dataFreshness.text}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Bulk actions */}
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

          {/* Saved Filters dropdown */}
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

          {/* Export button */}
          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-1.5"
            title={selectedRows.size > 0 ? `Export ${selectedRows.size} selected` : 'Export to CSV'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export{selectedRows.size > 0 ? ` (${selectedRows.size})` : ''}
          </button>

          {/* View toggle */}
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

      {/* Actor filter banner */}
      {actorFilter && actorName && (
        <div className="bg-cyan-900/30 border border-cyan-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-cyan-400">
            Showing incidents for: <strong>{actorName}</strong>
          </span>
          <button
            onClick={clearActorFilter}
            className="text-cyan-400 hover:text-white flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-600 flex gap-4">
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↑↓</kbd> Navigate</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> View details</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">/</kbd> Search</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Shift+Click</kbd> Select multiple</span>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by victim name or actor..."
            className="cyber-input w-full"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className={`cyber-input ${sectorFilter ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
        >
          <option value="">All Sectors</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector.charAt(0).toUpperCase() + sector.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1.5 rounded text-sm ${
                timeRange === range.value
                  ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch('')
              setSectorFilter('')
              setStatusFilter('')
              setCountryFilter('')
              setTimeRange(30)
              clearActorFilter()
              setSortConfig({ field: 'discovered_date', direction: 'desc' })
            }}
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 px-3 py-2 rounded border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tooltip content="Total ransomware incidents matching current filters" source="ransomware.live">
          <div className="cyber-card cursor-help">
            <div className="text-2xl font-bold text-white">{totalCount.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Incidents</div>
          </div>
        </Tooltip>
        <Tooltip content="Incidents discovered in the last 7 days" source="Calculated from discovered_date">
          <div className="cyber-card cursor-help">
            <div className="text-2xl font-bold text-green-400">
              {incidentList.filter((i) => {
                if (!i.discovered_date) return false
                const d = new Date(i.discovered_date)
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return d >= weekAgo
              }).length}
            </div>
            <div className="text-sm text-gray-400">This Week</div>
          </div>
        </Tooltip>
        <Tooltip content="Most frequently targeted industry sector in current view" source="Sector classification">
          <div className="cyber-card cursor-help">
            {analytics?.topSectors?.[0] ? (
              <>
                <div className="text-2xl font-bold text-orange-400 capitalize">
                  {analytics.topSectors[0].name}
                </div>
                <div className="text-sm text-gray-400">
                  Top Sector ({analytics.topSectors[0].count})
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-500">—</div>
                <div className="text-sm text-gray-400">Top Sector</div>
              </>
            )}
          </div>
        </Tooltip>
        <Tooltip content="Distinct threat actor groups with incidents in current view" source="ransomware.live">
          <div className="cyber-card cursor-help">
            <div className="text-2xl font-bold text-cyber-accent">
              {[...new Set(incidentList.map((i) => i.actor_id).filter(Boolean))].length}
            </div>
            <div className="text-sm text-gray-400">Active Groups</div>
          </div>
        </Tooltip>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'overview' ? (
        /* Overview Analytics View */
        <div className="space-y-6">
          {loading ? (
            <div className="cyber-card p-12 text-center">
              <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="text-gray-400">Loading analytics...</div>
            </div>
          ) : analytics && (
            <>
              {/* Incident Timeline Chart */}
              <div className="cyber-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Incident Activity ({timeRange === 0 ? 'Last 90 Days' : timeRange === 365 ? 'Last Year' : `Last ${timeRange} Days`})
                  </h3>
                  <Tooltip content="Daily count of ransomware incidents by discovered date. Spikes indicate increased threat actor activity." source="ransomware.live">
                    <span className="text-gray-500 hover:text-gray-300 cursor-help">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </Tooltip>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={analytics.timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="label"
                      stroke="#6b7280"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#9ca3af' }}
                      itemStyle={{ color: '#06b6d4' }}
                      formatter={(value) => [value, 'Incidents']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
                    />
                    <Area
                      type="monotone"
                      dataKey="incidents"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#incidentGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Charts Row - Pie and Bar */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sector Distribution Pie */}
                <div className="cyber-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-white">Sector Distribution</h3>
                    <Tooltip content="Industry sectors targeted by ransomware groups. Click any slice to filter the table by that sector." source="Sector classification">
                      <span className="text-gray-500 hover:text-gray-300 cursor-help">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </Tooltip>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={analytics.sectorPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(data) => {
                          setSectorFilter(data.name.toLowerCase())
                          setViewMode('table')
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {analytics.sectorPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value, name) => [value, name]}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        formatter={(value) => <span style={{ color: '#d1d5db', fontSize: '12px' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Actors Bar Chart */}
                <div className="cyber-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-white">Most Active Threat Actors</h3>
                    <Tooltip content="Ransomware groups ranked by incident count. Click any bar to filter incidents by that actor." source="ransomware.live">
                      <span className="text-gray-500 hover:text-gray-300 cursor-help">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </Tooltip>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={analytics.topActors.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                      <XAxis type="number" stroke="#6b7280" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#6b7280"
                        fontSize={11}
                        width={75}
                        tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value) => [value, 'Incidents']}
                        cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#ef4444"
                        radius={[0, 4, 4, 0]}
                        onClick={(data) => {
                          if (data.id) {
                            setActorFilter(data.id)
                            setActorName(data.name)
                            setViewMode('table')
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Countries and Status */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Countries */}
                <div className="cyber-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-white">Top Targeted Countries</h3>
                    <Tooltip content="Countries where victim organizations are located. Note: Country data is often incomplete in source feeds." source="ransomware.live (sparse)">
                      <span className="text-gray-500 hover:text-gray-300 cursor-help">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analytics.topCountries.map((country, i) => (
                      <button
                        key={country.name}
                        onClick={() => {
                          setCountryFilter(country.name)
                          setViewMode('table')
                        }}
                        className="px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
                        style={{
                          borderLeft: `3px solid ${CHART_COLORS[i % CHART_COLORS.length]}`
                        }}
                      >
                        <span className="text-white font-medium">{country.name}</span>
                        <span className="text-cyan-400 font-mono">{country.count}</span>
                      </button>
                    ))}
                    {analytics.topCountries.length === 0 && (
                      <span className="text-gray-500">No country data available</span>
                    )}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="cyber-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-white">Incident Status</h3>
                    <Tooltip content="Claimed: announced by actor. Confirmed: verified attack. Leaked: data published. Paid: ransom paid." source="ransomware.live">
                      <span className="text-gray-500 hover:text-gray-300 cursor-help">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {analytics.statuses.map((status) => (
                      <button
                        key={status.name}
                        onClick={() => {
                          setStatusFilter(status.name)
                          setViewMode('table')
                        }}
                        className={`p-3 rounded-lg transition-all ${getStatusColor(status.name)} hover:opacity-80`}
                      >
                        <div className="text-2xl font-bold">{status.count}</div>
                        <div className="text-xs capitalize">{status.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="flex gap-6">
          <div className="flex-1" ref={tableRef}>
            {loading ? (
              <SkeletonTable rows={8} cols={5} />
            ) : sortedIncidents.length === 0 ? (
              <EmptyIncidents />
            ) : (
              <div className="cyber-card overflow-hidden">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>
                        <ColumnMenu
                          field="victim_name"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={null}
                          onFilter={() => {}}
                          tooltip={{ content: 'Organization or company targeted in the attack', source: 'ransomware.live' }}
                        >
                          Victim
                        </ColumnMenu>
                      </th>
                      <th>
                        <ColumnMenu
                          field="actor_name"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={null}
                          onFilter={() => {}}
                          tooltip={{ content: 'Threat actor or ransomware group responsible', source: 'ransomware.live' }}
                        >
                          Actor
                        </ColumnMenu>
                      </th>
                      <th className="hidden md:table-cell">
                        <ColumnMenu
                          field="victim_sector"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={sectorFilter}
                          onFilter={setSectorFilter}
                          filterOptions={SECTOR_FILTER_OPTIONS}
                          tooltip={{ content: 'Industry sector of the victim organization', source: 'Classified' }}
                        >
                          Sector
                        </ColumnMenu>
                      </th>
                      <th className="hidden lg:table-cell">
                        <ColumnMenu
                          field="status"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={statusFilter}
                          onFilter={setStatusFilter}
                          filterOptions={STATUS_OPTIONS}
                          tooltip={{ content: 'claimed = announced by actor, confirmed = verified, leaked = data published, paid = ransom paid', source: 'ransomware.live' }}
                        >
                          Status
                        </ColumnMenu>
                      </th>
                      <th>
                        <ColumnMenu
                          field="discovered_date"
                          currentSort={sortConfig}
                          onSort={setSortConfig}
                          currentFilter={null}
                          onFilter={() => {}}
                          tooltip={{ content: 'Date the incident was discovered or announced', source: 'ransomware.live' }}
                        >
                          Date
                        </ColumnMenu>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIncidents.map((incident, index) => (
                      <tr
                        key={incident.id}
                        onClick={(e) => handleRowClick(incident, e)}
                        className={`cursor-pointer transition-colors ${
                          selectedRows.has(incident.id) ? 'bg-cyan-900/30' : ''
                        } ${
                          selectedIncident?.id === incident.id ? 'bg-cyan-900/20' : ''
                        } ${
                          focusedRowIndex === index ? 'ring-1 ring-inset ring-cyan-500' : ''
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <WatchButton entityType="incident" entityId={incident.id} size="sm" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {incident.victim_name || 'Unknown'}
                                </span>
                                <NewBadge date={incident.discovered_date} thresholdHours={48} />
                              </div>
                              {incident.victim_country && (
                                <div className="text-xs text-gray-500">{incident.victim_country}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                goToActor(incident.actor_id)
                              }}
                              className="text-cyber-accent hover:text-cyan-300 hover:underline text-left"
                            >
                              {incident.threat_actor?.name || 'Unknown'}
                            </button>
                            {actorTrends[incident.actor_id] && (
                              <Sparkline
                                data={[
                                  actorTrends[incident.actor_id].week4,
                                  actorTrends[incident.actor_id].week3,
                                  actorTrends[incident.actor_id].week2,
                                  actorTrends[incident.actor_id].week1
                                ]}
                                width={40}
                                height={16}
                              />
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell text-gray-400 capitalize">
                          {incident.victim_sector || '—'}
                        </td>
                        <td className="hidden lg:table-cell">
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(incident.status)}`}>
                            {incident.status || 'unknown'}
                          </span>
                        </td>
                        <td className="text-gray-400 text-sm">
                          <SmartTime date={incident.discovered_date} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Load More button */}
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
                        `Load More (${incidentList.length} of ${totalCount})`
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Incident Detail Panel */}
          {selectedIncident && (
            <div className="w-80 cyber-card hidden lg:block">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white truncate">
                  {selectedIncident.victim_name || 'Unknown'}
                </h3>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Threat Actor</div>
                  <button
                    onClick={() => goToActor(selectedIncident.actor_id)}
                    className="text-cyber-accent font-medium hover:text-cyan-300 hover:underline"
                  >
                    {selectedIncident.threat_actor?.name || 'Unknown'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-500 mb-1">Sector</div>
                    <div className="text-gray-300 capitalize">
                      {selectedIncident.victim_sector || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Country</div>
                    <div className="text-gray-300">
                      {selectedIncident.victim_country || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 mb-1">Discovered</div>
                  <div className="text-gray-300">
                    <FullDate date={selectedIncident.discovered_date} />
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 mb-1">Status</div>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedIncident.status)}`}>
                    {selectedIncident.status || 'unknown'}
                  </span>
                </div>

                {selectedIncident.data_leaked && (
                  <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
                    <div className="text-red-400 text-xs font-medium">Data Leaked</div>
                    {selectedIncident.data_size && (
                      <div className="text-red-300 text-xs">
                        Size: {selectedIncident.data_size}
                      </div>
                    )}
                  </div>
                )}

                {selectedIncident.victim_website && (
                  <div>
                    <div className="text-gray-500 mb-1">Website</div>
                    <div className="text-gray-300 text-xs font-mono truncate">
                      {selectedIncident.victim_website}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-800">
                  <div className="text-gray-500 text-xs">
                    Source: {selectedIncident.source || 'ransomware.live'}
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
