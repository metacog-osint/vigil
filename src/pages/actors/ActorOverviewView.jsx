/**
 * Actor Overview View Component
 * Analytics dashboard view for threat actors
 */
import TrendBadge from '../../components/TrendBadge'
import { SmartTime } from '../../components/TimeDisplay'
import { getTypeConfig } from './ActorConstants'

export function ActorOverviewView({
  actors,
  loading,
  totalCount,
  trendSummary,
  onSelectActor,
  onSetTypeFilter,
  onSetSectorFilter,
  typeFilter,
  setViewMode,
}) {
  if (loading) {
    return (
      <div className="cyber-card p-12 text-center">
        <svg
          className="animate-spin w-8 h-8 mx-auto mb-4 text-cyan-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <div className="text-gray-400">Loading actor data...</div>
      </div>
    )
  }

  // Calculate all statistics
  const typeCounts = {}
  const trendCounts = { ESCALATING: [], STABLE: [], DECLINING: [] }
  const sectorCounts = {}
  const regionCounts = {}
  let totalIncidents7d = 0

  actors.forEach((actor) => {
    const type = actor.actor_type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1

    const trend = actor.trend_status || 'STABLE'
    if (trendCounts[trend]) {
      trendCounts[trend].push(actor)
    }

    ;(actor.target_sectors || []).forEach((s) => {
      sectorCounts[s] = (sectorCounts[s] || 0) + 1
    })

    const regions = actor.target_countries || actor.target_regions || []
    regions.forEach((r) => {
      regionCounts[r] = (regionCounts[r] || 0) + 1
    })

    totalIncidents7d += actor.incidents_7d || 0
  })

  const topActiveActors = [...actors]
    .sort((a, b) => (b.incidents_7d || 0) - (a.incidents_7d || 0))
    .slice(0, 10)

  const recentlyActiveActors = [...actors]
    .filter((a) => a.last_seen)
    .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Summary Stats Row */}
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
          <div className="text-3xl font-bold text-yellow-400">
            {Object.keys(sectorCounts).length || '—'}
          </div>
          <div className="text-sm text-gray-400">Target Sectors</div>
        </div>
        <div className="cyber-card text-center">
          <div className="text-3xl font-bold text-purple-400">{Object.keys(typeCounts).length}</div>
          <div className="text-sm text-gray-400">Actor Types</div>
        </div>
      </div>
      <div className="text-xs text-gray-600 text-right">
        * Based on loaded sample of {actors.length} actors
      </div>

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
                  onSetTypeFilter(typeFilter === type ? '' : type)
                  setViewMode('table')
                }}
              >
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs capitalize mt-1">{type.replace(/_/g, ' ')}</div>
                <div className="text-xs opacity-60 mt-1">
                  {((count / (actors.length || 1)) * 100).toFixed(1)}%
                </div>
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
                  onSelectActor(actor)
                  setViewMode('table')
                }}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors text-left"
              >
                <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                <span className="flex-1 text-white font-medium">{actor.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${getTypeConfig(actor.actor_type).color}`}
                >
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
                  onSelectActor(actor)
                  setViewMode('table')
                }}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors text-left"
              >
                <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                <span className="flex-1 text-white font-medium">{actor.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${getTypeConfig(actor.actor_type).color}`}
                >
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            Escalating Actors ({trendCounts.ESCALATING.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {trendCounts.ESCALATING.sort((a, b) => (b.incidents_7d || 0) - (a.incidents_7d || 0))
              .slice(0, 20)
              .map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => {
                    onSelectActor(actor)
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
              <span className="px-3 py-1.5 text-gray-500 text-sm">
                +{trendCounts.ESCALATING.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sector and Region Data */}
      {(Object.keys(sectorCounts).length > 0 || Object.keys(regionCounts).length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
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
                        onSetSectorFilter(sector)
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
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p>Target sector and region data is not yet populated for most actors.</p>
          <p className="text-sm mt-1">
            Use the type and activity breakdowns above to explore actors.
          </p>
        </div>
      )}
    </div>
  )
}

export default ActorOverviewView
