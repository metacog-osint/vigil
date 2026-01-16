/**
 * Incidents Page - Ransomware Incident Tracking
 * Main orchestration component using extracted sub-components
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchlists } from '../lib/supabase'
import { Tooltip } from '../components/Tooltip'
import { SECTORS, TIME_RANGES } from '../lib/constants'
import {
  useIncidentData,
  useIncidentSort,
  useActorFilter,
  useSavedFilters,
  useIncidentAnalytics,
} from './incidents/useIncidentData'
import IncidentTableView from './incidents/IncidentTableView'
import IncidentOverviewView from './incidents/IncidentOverviewView'
import { IncidentDetailPanel, IncidentDetailModal } from './incidents/IncidentDetailPanel'

export default function Incidents() {
  const navigate = useNavigate()

  // Filter state
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [timeRange, setTimeRange] = useState(30)

  // View state
  const [viewMode, setViewMode] = useState('table')
  const [selectedIncident, setSelectedIncident] = useState(null)

  // Bulk selection
  const [selectedRows, setSelectedRows] = useState(new Set())

  // Keyboard navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableRef = useRef(null)

  // Actor filter hook
  const { actorFilter, setActorFilter, actorName, setActorName, clearActorFilter } = useActorFilter()

  // Data loading hook
  const {
    incidentList,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    dataFreshness,
    actorTrends,
  } = useIncidentData({
    search,
    sectorFilter,
    statusFilter,
    countryFilter,
    timeRange,
    actorFilter,
  })

  // Sorting hook
  const { sortedIncidents, sortConfig, setSortConfig } = useIncidentSort(incidentList)

  // Analytics hook
  const analytics = useIncidentAnalytics(incidentList, timeRange)

  // Saved filters hook
  const {
    savedFiltersOpen,
    setSavedFiltersOpen,
    savedFiltersList,
    saveFilterName,
    setSaveFilterName,
    saveCurrentFilter,
    applySavedFilter,
    deleteSavedFilter,
  } = useSavedFilters((query) => {
    setSearch(query.search || '')
    setSectorFilter(query.sectorFilter || '')
    setStatusFilter(query.statusFilter || '')
    setCountryFilter(query.countryFilter || '')
    setTimeRange(query.timeRange || 30)
    setActorFilter(query.actorFilter || '')
    if (query.sortConfig) setSortConfig(query.sortConfig)
  })

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

  // CSV Export
  const exportToCSV = useCallback(() => {
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
  }, [selectedRows, sortedIncidents])

  // Navigate to actor
  const goToActor = useCallback((actorId) => {
    if (actorId) {
      navigate(`/actors?actor=${actorId}`)
    }
  }, [navigate])

  // Row click handler
  const handleRowClick = useCallback((incident, event) => {
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
  }, [])

  // Add to watchlist
  const addSelectedToWatchlist = useCallback(async () => {
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
  }, [selectedRows])

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearch('')
    setSectorFilter('')
    setStatusFilter('')
    setCountryFilter('')
    setTimeRange(30)
    clearActorFilter()
    setSortConfig({ field: 'discovered_date', direction: 'desc' })
  }, [clearActorFilter, setSortConfig])

  const hasActiveFilters = search || sectorFilter || statusFilter || countryFilter || actorFilter || timeRange !== 30

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Ransomware Incidents</h1>
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
        <div className="flex flex-wrap items-center gap-2">
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
                        onClick={() => saveCurrentFilter({
                          search, sectorFilter, statusFilter, countryFilter, timeRange, sortConfig, actorFilter
                        })}
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
      <div className="hidden md:flex text-xs text-gray-600 gap-4">
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
            onClick={clearAllFilters}
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
        <IncidentOverviewView
          loading={loading}
          analytics={analytics}
          timeRange={timeRange}
          onSetSectorFilter={setSectorFilter}
          onSetActorFilter={(id, name) => {
            setActorFilter(id)
            setActorName(name)
          }}
          onSetCountryFilter={setCountryFilter}
          onSetStatusFilter={setStatusFilter}
          setViewMode={setViewMode}
        />
      ) : (
        <div className="flex gap-6">
          <div className="flex-1" ref={tableRef}>
            <IncidentTableView
              incidents={sortedIncidents}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              loadMore={loadMore}
              totalCount={totalCount}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              sectorFilter={sectorFilter}
              setSectorFilter={setSectorFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedRows={selectedRows}
              selectedIncident={selectedIncident}
              focusedRowIndex={focusedRowIndex}
              onRowClick={handleRowClick}
              onGoToActor={goToActor}
              actorTrends={actorTrends}
              tableRef={tableRef}
            />
          </div>

          {/* Incident Detail Panel (Desktop) */}
          <IncidentDetailPanel
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
            onGoToActor={goToActor}
          />
        </div>
      )}

      {/* Mobile Incident Detail Modal */}
      {selectedIncident && viewMode === 'table' && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onGoToActor={(actorId) => {
            setSelectedIncident(null)
            goToActor(actorId)
          }}
        />
      )}
    </div>
  )
}
