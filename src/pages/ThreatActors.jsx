import { useState, useEffect } from 'react'
import { threatActors, subscribeToTable, incidents } from '../lib/supabase'
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

  useEffect(() => {
    loadActors()
    loadTrendSummary()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTable('threat_actors', (payload) => {
      if (payload.eventType === 'INSERT') {
        setActors((prev) => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setActors((prev) =>
          prev.map((a) => (a.id === payload.new.id ? payload.new : a))
        )
      }
    })

    return () => unsubscribe()
  }, [search, sectorFilter, trendFilter, typeFilter, statusFilter])

  async function loadActors() {
    setLoading(true)
    try {
      const { data, error } = await threatActors.getAll({
        search,
        sector: sectorFilter,
        trendStatus: trendFilter,
        actorType: typeFilter,
        status: statusFilter,
        limit: 100,
      })

      if (error) throw error
      setActors(data || [])
    } catch (error) {
      console.error('Error loading actors:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTrendSummary() {
    try {
      const summary = await threatActors.getTrendSummary()
      setTrendSummary(summary)
    } catch (error) {
      console.error('Error loading trend summary:', error)
    }
  }

  // Sort actors based on current config
  const sortedActors = [...actors].sort((a, b) => {
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

    if (aVal < bVal) return direction === 'asc' ? -1 : 1
    if (aVal > bVal) return direction === 'asc' ? 1 : -1
    return 0
  })

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Threat Actors</h1>
        <p className="text-gray-400 text-sm mt-1">
          Ransomware groups and cybercrime actors
        </p>
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
      <div className="flex gap-6">
        {/* Actor List */}
        <div className="flex-1">
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
                  </tr>
                </thead>
                <tbody>
                  {sortedActors.map((actor) => (
                    <tr
                      key={actor.id}
                      onClick={() => setSelectedActor(actor)}
                      className="cursor-pointer"
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

                      {/* Incidents 7d / Prev Cell */}
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
                          <span>
                            <span className="text-white font-medium">{actor.incidents_7d || 0}</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-gray-400">{actor.incidents_prev_7d || 0}</span>
                            {actor.incident_velocity > 0 && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({actor.incident_velocity}/d)
                              </span>
                            )}
                          </span>
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
                    </tr>
                  ))}
                </tbody>
              </table>
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

              <div className="pt-4 border-t border-gray-800">
                <div className="text-gray-500 text-xs">
                  Source: {selectedActor.source || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
