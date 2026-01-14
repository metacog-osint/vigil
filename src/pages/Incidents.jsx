import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidents, subscribeToTable, savedSearches } from '../lib/supabase'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyIncidents } from '../components/EmptyState'
import { NewBadge } from '../components/NewIndicator'
import { WatchButton } from '../components/WatchButton'
import { SmartTime, FullDate } from '../components/TimeDisplay'
import { IncidentFlow } from '../components/IncidentFlow'
import { Tooltip, ColumnMenu, FIELD_TOOLTIPS } from '../components/Tooltip'

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
  const [incidentList, setIncidentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState(30)
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [sortConfig, setSortConfig] = useState({ field: 'discovered_date', direction: 'desc' })

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
  }, [search, sectorFilter, statusFilter, timeRange])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

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
          break
        case '/':
          e.preventDefault()
          document.querySelector('input[type="text"]')?.focus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedRowIndex, sortedIncidents])

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
        days: timeRange,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setIncidentList(data || [])
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
      search, sectorFilter, statusFilter, timeRange, sortConfig
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
    setTimeRange(q.timeRange || 30)
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
    const headers = ['Victim', 'Actor', 'Sector', 'Country', 'Status', 'Discovered', 'Website', 'Source']
    const rows = sortedIncidents.map(inc => [
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
  function goToActor(actorId, actorName) {
    if (actorId) {
      navigate(`/actors?actor=${actorId}`)
    }
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

  // Compute flow data for IncidentFlow visualization
  const flowData = useMemo(() => {
    if (incidentList.length === 0) return { actors: [], sectors: [], flows: [] }

    const actorCounts = {}
    const sectorCounts = {}
    const actorSectorLinks = {}

    for (const incident of incidentList) {
      const actorName = incident.threat_actor?.name || 'Unknown'
      const sectorName = incident.victim_sector || 'Unknown'

      actorCounts[actorName] = (actorCounts[actorName] || 0) + 1
      sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1

      const linkKey = `${actorName}|${sectorName}`
      actorSectorLinks[linkKey] = (actorSectorLinks[linkKey] || 0) + 1
    }

    const actors = Object.entries(actorCounts)
      .map(([name, incidents]) => ({ name, incidents }))
      .sort((a, b) => b.incidents - a.incidents)
      .slice(0, 5)

    const sectors = Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topActorNames = new Set(actors.map(a => a.name))
    const topSectorNames = new Set(sectors.map(s => s.name))

    const flows = Object.entries(actorSectorLinks)
      .filter(([key]) => {
        const [actor, sector] = key.split('|')
        return topActorNames.has(actor) && topSectorNames.has(sector)
      })
      .map(([key, value]) => {
        const [source, target] = key.split('|')
        return { source, target, value, sourceCategory: 'actor', targetCategory: 'sector' }
      })

    return { actors, sectors, flows }
  }, [incidentList])

  const hasActiveFilters = search || sectorFilter || statusFilter || timeRange !== 30

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ransomware Incidents</h1>
          <p className="text-gray-400 text-sm mt-1">
            {totalCount.toLocaleString()} incidents total
            {hasActiveFilters && ` • ${sortedIncidents.length} shown`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
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
            title="Export to CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-600 flex gap-4">
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↑↓</kbd> Navigate</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> View details</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">/</kbd> Search</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> Close panel</span>
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
              setTimeRange(30)
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
        <div className="cyber-card">
          <div className="text-2xl font-bold text-white">{totalCount.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total Incidents</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-red-400">
            {incidentList.filter((i) => i.status === 'leaked').length}
          </div>
          <div className="text-sm text-gray-400">Data Leaked</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-orange-400">
            {incidentList.filter((i) => i.victim_sector === 'healthcare').length}
          </div>
          <div className="text-sm text-gray-400">Healthcare</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-cyber-accent">
            {[...new Set(incidentList.map((i) => i.actor_id).filter(Boolean))].length}
          </div>
          <div className="text-sm text-gray-400">Active Groups</div>
        </div>
      </div>

      {/* Attack Flow Visualization */}
      {!loading && incidentList.length > 0 && flowData.flows.length > 0 && (
        <div className="cyber-card">
          <h3 className="text-lg font-semibold text-white mb-4">Attack Flow: Actors → Sectors</h3>
          <IncidentFlow flows={flowData.flows} />
        </div>
      )}

      {/* Content */}
      <div className="flex gap-6">
        {/* Incident Table */}
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
                      onClick={() => setSelectedIncident(incident)}
                      className={`cursor-pointer transition-colors ${
                        selectedIncident?.id === incident.id ? 'bg-cyan-900/30' : ''
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goToActor(incident.actor_id, incident.threat_actor?.name)
                          }}
                          className="text-cyber-accent hover:text-cyan-300 hover:underline text-left"
                        >
                          {incident.threat_actor?.name || 'Unknown'}
                        </button>
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
                  onClick={() => goToActor(selectedIncident.actor_id, selectedIncident.threat_actor?.name)}
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
    </div>
  )
}
