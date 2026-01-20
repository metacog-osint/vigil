/**
 * ThreatActors Page
 * Main page for viewing and analyzing threat actors
 * Refactored to use extracted components from ./actors/
 */
import { useState, useEffect, useRef } from 'react'
import { watchlists } from '../lib/supabase'
import { Tooltip, FIELD_TOOLTIPS } from '../components/Tooltip'
import { SECTORS } from '../lib/constants'

// Extracted components and hooks
import {
  useActorData,
  useActorSort,
  useActorIncidents,
  useRelatedActors,
  useSavedFilters,
} from './actors'
import ActorDetailPanel from './actors/ActorDetailPanel'
import ActorOverviewView from './actors/ActorOverviewView'
import ActorTableView from './actors/ActorTableView'

export default function ThreatActors() {
  // Filter state
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [trendFilter, setTrendFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // UI state
  const [selectedActor, setSelectedActor] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableRef = useRef(null)

  // Data hooks
  const filters = { search, sectorFilter, trendFilter, typeFilter, statusFilter }
  const {
    actors,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    trendSummary,
    userOrgProfile,
    riskScores,
  } = useActorData(filters)

  const { sortedActors, sortConfig, setSortConfig } = useActorSort(actors, riskScores)
  const { timelineEvents } = useActorIncidents(selectedActor)
  const relatedActors = useRelatedActors(selectedActor)
  const savedFiltersHook = useSavedFilters()

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode === 'overview' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
        return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedRowIndex((i) => Math.min(i + 1, sortedActors.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedRowIndex((i) => Math.max(i - 1, 0))
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

  // Row click handler
  function handleRowClick(actor, event) {
    if (event.shiftKey) {
      setSelectedRows((prev) => {
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

  // Bulk watchlist add
  async function addSelectedToWatchlist() {
    if (selectedRows.size === 0) return

    try {
      const { data: lists } = await watchlists.getAll()
      const actorList = lists?.find((w) => w.entity_type === 'threat_actor')

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

  // Export to CSV
  function exportToCSV() {
    const headers = [
      'Name',
      'Type',
      'Trend',
      'Incidents 7d',
      'Incidents Prev 7d',
      'Last Seen',
      'Status',
      'Risk Score',
      'Aliases',
      'Target Sectors',
    ]
    const rows = sortedActors.map((actor) => [
      actor.name,
      actor.actor_type || 'unknown',
      actor.trend_status || 'STABLE',
      actor.incidents_7d || 0,
      actor.incidents_prev_7d || 0,
      actor.last_seen || '',
      actor.status || 'active',
      riskScores[actor.id] || 0,
      (actor.aliases || []).join('; '),
      (actor.target_sectors || []).join('; '),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `threat-actors-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Clear all filters
  function clearFilters() {
    setTypeFilter('')
    setTrendFilter('')
    setStatusFilter('')
    setSectorFilter('')
    setSearch('')
    setSortConfig({ field: 'incidents_7d', direction: 'desc' })
  }

  const hasActiveFilters = typeFilter || trendFilter || statusFilter || sectorFilter || search

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Threat Actors</h1>
          <p className="text-gray-400 text-sm mt-1">
            {totalCount.toLocaleString()} actors total
            {hasActiveFilters && ` • ${sortedActors.length} shown`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk watchlist button */}
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
              onClick={() =>
                savedFiltersHook.setSavedFiltersOpen(!savedFiltersHook.savedFiltersOpen)
              }
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Saved Filters
            </button>
            {savedFiltersHook.savedFiltersOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => savedFiltersHook.setSavedFiltersOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-2 min-w-[250px]">
                  <div className="px-3 pb-2 border-b border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={savedFiltersHook.saveFilterName}
                        onChange={(e) => savedFiltersHook.setSaveFilterName(e.target.value)}
                        placeholder="Filter name..."
                        className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-300"
                      />
                      <button
                        onClick={() =>
                          savedFiltersHook.saveCurrentFilter({
                            search,
                            sectorFilter,
                            trendFilter,
                            typeFilter,
                            statusFilter,
                            sortConfig,
                          })
                        }
                        disabled={!savedFiltersHook.saveFilterName.trim()}
                        className="px-2 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {savedFiltersHook.savedFiltersList.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No saved filters</div>
                  ) : (
                    savedFiltersHook.savedFiltersList.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800"
                      >
                        <button
                          onClick={() => {
                            const q = filter.query || {}
                            setSearch(q.search || '')
                            setSectorFilter(q.sectorFilter || '')
                            setTrendFilter(q.trendFilter || '')
                            setTypeFilter(q.typeFilter || '')
                            setStatusFilter(q.statusFilter || '')
                            if (q.sortConfig) setSortConfig(q.sortConfig)
                            savedFiltersHook.setSavedFiltersOpen(false)
                          }}
                          className="flex-1 text-left text-sm text-gray-300 hover:text-white"
                        >
                          {filter.name}
                        </button>
                        <button
                          onClick={() => savedFiltersHook.deleteSavedFilter(filter.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export
          </button>

          {/* View mode toggle */}
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'overview' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden md:flex text-xs text-gray-600 gap-4">
        <span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↑↓</kbd> Navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> View details
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">/</kbd> Search
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Shift+Click</kbd> Select
          multiple
        </span>
      </div>

      {/* Trend Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Tooltip
          content={FIELD_TOOLTIPS.escalating_summary.content}
          source={FIELD_TOOLTIPS.escalating_summary.source}
          position="bottom"
        >
          <button
            onClick={() => setTrendFilter(trendFilter === 'ESCALATING' ? '' : 'ESCALATING')}
            className={`cyber-card text-center cursor-pointer transition-all w-full ${trendFilter === 'ESCALATING' ? 'ring-2 ring-red-500' : ''}`}
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
            className={`cyber-card text-center cursor-pointer transition-all w-full ${trendFilter === 'STABLE' ? 'ring-2 ring-gray-500' : ''}`}
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
            className={`cyber-card text-center cursor-pointer transition-all w-full ${trendFilter === 'DECLINING' ? 'ring-2 ring-green-500' : ''}`}
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
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 px-3 py-2 rounded border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear all filters
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'overview' ? (
        <ActorOverviewView
          actors={actors}
          loading={loading}
          totalCount={totalCount}
          trendSummary={trendSummary}
          onSelectActor={setSelectedActor}
          onSetTypeFilter={setTypeFilter}
          onSetSectorFilter={setSectorFilter}
          typeFilter={typeFilter}
          setViewMode={setViewMode}
        />
      ) : (
        <div className="flex gap-6">
          <div className="flex-1" ref={tableRef}>
            <ActorTableView
              actors={sortedActors}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              loadMore={loadMore}
              totalCount={totalCount}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              trendFilter={trendFilter}
              setTrendFilter={setTrendFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedRows={selectedRows}
              focusedRowIndex={focusedRowIndex}
              onRowClick={handleRowClick}
              userOrgProfile={userOrgProfile}
              riskScores={riskScores}
            />
          </div>

          {/* Desktop Detail Panel */}
          {selectedActor && (
            <ActorDetailPanel
              actor={selectedActor}
              onClose={() => setSelectedActor(null)}
              timelineEvents={timelineEvents}
              relatedActors={relatedActors}
              onSelectActor={setSelectedActor}
            />
          )}
        </div>
      )}

      {/* Mobile Detail Modal */}
      {selectedActor && viewMode === 'table' && (
        <ActorDetailPanel
          actor={selectedActor}
          onClose={() => setSelectedActor(null)}
          timelineEvents={timelineEvents}
          relatedActors={relatedActors}
          onSelectActor={setSelectedActor}
          isMobile={true}
        />
      )}
    </div>
  )
}
