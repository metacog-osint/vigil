// Sector Drilldown Component
// Expandable sector cards showing incident activity targeting each sector (per Jake's feedback)
// Click a sector to see incidents, top actors, and trend for that sector
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SmartTime } from '../TimeDisplay'
import { Tooltip } from '../Tooltip'

// Sector icons mapping
const SECTOR_ICONS = {
  healthcare: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  finance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  technology: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  manufacturing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  education: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
  ),
  government: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  retail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  energy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

// Sector colors
const SECTOR_COLORS = {
  healthcare: '#ef4444',
  finance: '#f97316',
  technology: '#3b82f6',
  manufacturing: '#8b5cf6',
  education: '#10b981',
  government: '#eab308',
  retail: '#ec4899',
  energy: '#06b6d4',
  default: '#6b7280'
}

export function SectorDrilldown({
  sectors = [],
  loading = false,
  onSectorClick,
  userSector = null
}) {
  const [expandedSector, setExpandedSector] = useState(null)

  if (loading) {
    return (
      <div className="cyber-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
          <div className="h-5 w-48 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const handleSectorClick = (sector) => {
    if (expandedSector === sector.name) {
      setExpandedSector(null)
    } else {
      setExpandedSector(sector.name)
      onSectorClick?.(sector)
    }
  }

  const getSectorIcon = (sectorName) => {
    const key = sectorName?.toLowerCase().replace(/[^a-z]/g, '')
    return SECTOR_ICONS[key] || SECTOR_ICONS.default
  }

  const getSectorColor = (sectorName) => {
    const key = sectorName?.toLowerCase().replace(/[^a-z]/g, '')
    return SECTOR_COLORS[key] || SECTOR_COLORS.default
  }

  const maxCount = Math.max(...sectors.map(s => s.count), 1)

  return (
    <div className="cyber-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-semibold text-white">Targeted Sectors</h3>
          <Tooltip content="Click a sector to see detailed incident activity">
            <span className="text-gray-500 hover:text-gray-300 cursor-help">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </Tooltip>
        </div>
        <Link
          to="/ransomware"
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          View all incidents →
        </Link>
      </div>

      {/* Sector grid */}
      {sectors.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No sector data available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sector cards grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sectors.slice(0, 8).map((sector) => {
              const isExpanded = expandedSector === sector.name
              const isUserSector = userSector && sector.name?.toLowerCase() === userSector.toLowerCase()
              const color = getSectorColor(sector.name)
              const barWidth = (sector.count / maxCount) * 100

              return (
                <button
                  key={sector.name}
                  onClick={() => handleSectorClick(sector)}
                  className={`relative p-3 rounded-lg border text-left transition-all ${
                    isExpanded
                      ? 'border-cyan-500 bg-cyan-900/20'
                      : isUserSector
                      ? 'border-cyan-500/50 bg-cyan-900/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  {/* User sector indicator */}
                  {isUserSector && (
                    <div className="absolute -top-1 -right-1">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color }}>{getSectorIcon(sector.name)}</span>
                    <span className="text-sm text-white font-medium capitalize truncate">
                      {sector.name?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-white mb-1">
                    {sector.count.toLocaleString()}
                  </div>

                  {/* Mini bar */}
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>

                  {/* Trend indicator */}
                  {sector.trend && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${
                      sector.trend > 0 ? 'text-red-400' :
                      sector.trend < 0 ? 'text-green-400' :
                      'text-gray-500'
                    }`}>
                      {sector.trend > 0 ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : sector.trend < 0 ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : null}
                      <span>{Math.abs(sector.trend)}% vs last period</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Expanded sector details */}
          {expandedSector && (
            <div className="animate-fadeIn">
              {sectors
                .filter(s => s.name === expandedSector)
                .map(sector => (
                  <ExpandedSectorPanel
                    key={sector.name}
                    sector={sector}
                    onClose={() => setExpandedSector(null)}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExpandedSectorPanel({ sector, onClose }) {
  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white capitalize">
          {sector.name?.replace(/_/g, ' ')} Sector Activity
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top actors targeting this sector */}
        <div>
          <h5 className="text-sm font-medium text-gray-400 mb-2">Top Actors Targeting</h5>
          {sector.topActors?.length > 0 ? (
            <div className="space-y-2">
              {sector.topActors.slice(0, 5).map(actor => (
                <Link
                  key={actor.name}
                  to={`/actors?search=${encodeURIComponent(actor.name)}`}
                  className="flex items-center justify-between p-2 bg-gray-900/50 rounded hover:bg-gray-900 transition-colors"
                >
                  <span className="text-white">{actor.name}</span>
                  <span className="text-xs text-gray-500">{actor.count} incidents</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No actor data available</p>
          )}
        </div>

        {/* Recent incidents in this sector */}
        <div>
          <h5 className="text-sm font-medium text-gray-400 mb-2">Recent Incidents</h5>
          {sector.recentIncidents?.length > 0 ? (
            <div className="space-y-2">
              {sector.recentIncidents.slice(0, 5).map(incident => (
                <div
                  key={incident.id}
                  className="p-2 bg-gray-900/50 rounded"
                >
                  <div className="text-sm text-white truncate">{incident.victim_name}</div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{incident.threat_actor?.name || 'Unknown'}</span>
                    <SmartTime date={incident.discovered_date} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent incidents</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <Link
          to={`/ransomware?sector=${encodeURIComponent(sector.name)}`}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          View all {sector.count} incidents in {sector.name?.replace(/_/g, ' ')} →
        </Link>
      </div>
    </div>
  )
}

export default SectorDrilldown
