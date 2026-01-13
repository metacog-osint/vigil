import { useState, useEffect } from 'react'
import { threatActors, subscribeToTable, incidents } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import TrendBadge, { TrendIndicator } from '../components/TrendBadge'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyActors } from '../components/EmptyState'
import { NewBadge } from '../components/NewIndicator'
import { WatchButton } from '../components/WatchButton'
import { Sparkline } from '../components/Sparkline'
import { Timeline } from '../components/Timeline'
import { CorrelationPanel } from '../components/CorrelationPanel'

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

export default function ThreatActors() {
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [trendFilter, setTrendFilter] = useState('')
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
  }, [search, sectorFilter, trendFilter])

  async function loadActors() {
    setLoading(true)
    try {
      const { data, error } = await threatActors.getAll({
        search,
        sector: sectorFilter,
        trendStatus: trendFilter,
        limit: 50,
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

      {/* Trend Summary */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setTrendFilter(trendFilter === 'ESCALATING' ? '' : 'ESCALATING')}
          className={`cyber-card text-center cursor-pointer transition-all ${
            trendFilter === 'ESCALATING' ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <div className="text-2xl font-bold text-red-400">{trendSummary.escalating}</div>
          <div className="text-sm text-gray-400">Escalating</div>
        </button>
        <button
          onClick={() => setTrendFilter(trendFilter === 'STABLE' ? '' : 'STABLE')}
          className={`cyber-card text-center cursor-pointer transition-all ${
            trendFilter === 'STABLE' ? 'ring-2 ring-gray-500' : ''
          }`}
        >
          <div className="text-2xl font-bold text-gray-400">{trendSummary.stable}</div>
          <div className="text-sm text-gray-400">Stable</div>
        </button>
        <button
          onClick={() => setTrendFilter(trendFilter === 'DECLINING' ? '' : 'DECLINING')}
          className={`cyber-card text-center cursor-pointer transition-all ${
            trendFilter === 'DECLINING' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="text-2xl font-bold text-green-400">{trendSummary.declining}</div>
          <div className="text-sm text-gray-400">Declining</div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actors..."
            className="cyber-input w-full"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="cyber-input"
        >
          <option value="">All Sectors</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector.charAt(0).toUpperCase() + sector.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={trendFilter}
          onChange={(e) => setTrendFilter(e.target.value)}
          className="cyber-input"
        >
          {TREND_FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Actor List */}
        <div className="flex-1">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : actors.length === 0 ? (
            <EmptyActors />
          ) : (
            <div className="cyber-card overflow-hidden">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Actor</th>
                    <th className="hidden md:table-cell">Type</th>
                    <th>Trend</th>
                    <th className="hidden lg:table-cell">7d / Prev</th>
                    <th className="hidden md:table-cell">Last Seen</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actors.map((actor) => (
                    <tr
                      key={actor.id}
                      onClick={() => setSelectedActor(actor)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <WatchButton entityType="threat_actor" entityId={actor.id} size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{actor.name}</span>
                              <NewBadge date={actor.last_seen} thresholdHours={48} />
                            </div>
                            {actor.aliases?.length > 0 && (
                              <div className="text-xs text-gray-500">
                                aka {actor.aliases.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="badge-info">{actor.actor_type || 'ransomware'}</span>
                      </td>
                      <td>
                        <TrendBadge status={actor.trend_status} showLabel={false} />
                      </td>
                      <td className="hidden lg:table-cell text-sm">
                        <span className="text-white">{actor.incidents_7d || 0}</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-gray-400">{actor.incidents_prev_7d || 0}</span>
                        {actor.incident_velocity > 0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({actor.incident_velocity}/d)
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-sm text-gray-400">
                        {actor.last_seen
                          ? formatDistanceToNow(new Date(actor.last_seen), { addSuffix: true })
                          : 'Unknown'}
                      </td>
                      <td>
                        <span
                          className={`badge-${
                            actor.status === 'active' ? 'high' : 'low'
                          }`}
                        >
                          {actor.status || 'active'}
                        </span>
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
