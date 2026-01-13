import { useState, useEffect } from 'react'
import { incidents, subscribeToTable } from '../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import { SkeletonList } from '../components/Skeleton'
import { EmptyIncidents } from '../components/EmptyState'

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
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
  { label: 'All', value: 0 },
]

export default function Incidents() {
  const [incidentList, setIncidentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [sectorFilter, setSectorFilter] = useState('')
  const [timeRange, setTimeRange] = useState(365)
  const [selectedIncident, setSelectedIncident] = useState(null)

  useEffect(() => {
    loadIncidents()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTable('incidents', (payload) => {
      if (payload.eventType === 'INSERT') {
        setIncidentList((prev) => [payload.new, ...prev])
      }
    })

    return () => unsubscribe()
  }, [sectorFilter, timeRange])

  async function loadIncidents() {
    setLoading(true)
    try {
      const { data, error } = await incidents.getRecent({
        sector: sectorFilter,
        days: timeRange,
        limit: 100,
      })

      if (error) throw error
      setIncidentList(data || [])
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'claimed':
        return 'badge-high'
      case 'confirmed':
        return 'badge-critical'
      case 'leaked':
        return 'badge-critical'
      case 'paid':
        return 'badge-medium'
      default:
        return 'badge-info'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Ransomware Incidents</h1>
        <p className="text-gray-400 text-sm mt-1">
          Recent ransomware attacks and data leaks
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cyber-card">
          <div className="text-2xl font-bold text-white">{incidentList.length}</div>
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
            {[...new Set(incidentList.map((i) => i.actor_id))].length}
          </div>
          <div className="text-sm text-gray-400">Active Groups</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Incident List */}
        <div className="flex-1">
          {loading ? (
            <SkeletonList items={8} />
          ) : incidentList.length === 0 ? (
            <EmptyIncidents />
          ) : (
            <div className="space-y-2">
              {incidentList.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={`cyber-card cursor-pointer ${
                    selectedIncident?.id === incident.id ? 'cyber-glow' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {incident.victim_name || 'Unknown Victim'}
                        </span>
                        <span className={getStatusColor(incident.status)}>
                          {incident.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span className="text-cyber-accent">
                          {incident.threat_actor?.name || 'Unknown Actor'}
                        </span>
                        {incident.victim_sector && (
                          <span>{incident.victim_sector}</span>
                        )}
                        {incident.victim_country && (
                          <span>{incident.victim_country}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 ml-4">
                      {incident.discovered_date
                        ? formatDistanceToNow(new Date(incident.discovered_date), {
                            addSuffix: true,
                          })
                        : 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
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
                <div className="text-cyber-accent font-medium">
                  {selectedIncident.threat_actor?.name || 'Unknown'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 mb-1">Sector</div>
                  <div className="text-gray-300">
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
                  {selectedIncident.discovered_date
                    ? format(new Date(selectedIncident.discovered_date), 'PPP')
                    : 'Unknown'}
                </div>
              </div>

              <div>
                <div className="text-gray-500 mb-1">Status</div>
                <span className={getStatusColor(selectedIncident.status)}>
                  {selectedIncident.status}
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
                  Source: {selectedIncident.source || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
