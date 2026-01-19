/**
 * AboveFoldSection Component
 *
 * The critical above-the-fold content that should be visible without scrolling:
 * - Header + last sync timestamp
 * - AI BLUF summary (executive ready)
 * - Escalating actors alert (if any)
 * - Stats row (compact metrics)
 */
import { Link } from 'react-router-dom'
import { StatCard, SmartTime } from '../../components'

export default function AboveFoldSection({
  lastSync,
  aiSummary,
  escalatingActors,
  stats,
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Vigil Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time cyber threat intelligence overview
          </p>
        </div>
        {lastSync && (
          <div className="text-xs text-gray-500">
            Last sync: <SmartTime date={lastSync.completed_at} />
          </div>
        )}
      </div>

      {/* AI BLUF Summary */}
      {aiSummary && (
        <div className="bg-cyber-accent/10 border border-cyber-accent/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-cyber-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="font-medium text-cyber-accent">Intelligence Summary (BLUF)</span>
            <span className="text-xs text-gray-500 ml-auto">AI-Generated</span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Escalating Actors Alert */}
      {escalatingActors && escalatingActors.length > 0 && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium text-red-400">Escalating Threat Actors</span>
            <span className="text-xs text-gray-500">({escalatingActors.length} actors with increasing activity)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {escalatingActors.map((actor) => (
              <Link
                key={actor.id}
                to="/actors"
                className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 rounded text-sm text-red-300 hover:bg-red-900/50 transition-colors"
              >
                <span>{actor.name}</span>
                {actor.incidents_7d > 0 && (
                  <span className="text-xs text-red-400">({actor.incidents_7d} in 7d)</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-tour="dashboard-stats">
        <StatCard
          label="Active Actors"
          value={stats?.totalActors || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          label="Incidents (30d)"
          value={stats?.incidents24h || 0}
          trend={stats?.incidents24h > 5 ? 'up' : 'neutral'}
          trendLabel={stats?.incidents24h > 5 ? 'elevated' : undefined}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Total Incidents"
          value={stats?.incidents7d || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          label="Total KEVs"
          value={stats?.newKEV7d || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
        <StatCard
          label="Total IOCs"
          value={stats?.newIOCs24h || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>
    </div>
  )
}
