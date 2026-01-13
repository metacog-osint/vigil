// Change Summary Card - "What's New" since last period
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

function StatItem({ label, value, icon, link, highlight }) {
  const content = (
    <div className={clsx(
      'flex items-center gap-3 p-3 rounded-lg transition-colors',
      link ? 'hover:bg-gray-700/50 cursor-pointer' : '',
      highlight ? 'bg-cyber-accent/10 border border-cyber-accent/30' : 'bg-gray-800/50'
    )}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <div className={clsx(
          'text-lg font-bold',
          highlight ? 'text-cyber-accent' : 'text-white'
        )}>
          {value}
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      {link && (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )

  if (link) {
    return <Link to={link}>{content}</Link>
  }

  return content
}

export function ChangeSummaryCard({ data, loading }) {
  if (loading) {
    return (
      <div className="cyber-card p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="cyber-card p-6 text-gray-400 text-center">
        No change data available
      </div>
    )
  }

  const { newIncidents, newActors, newKEVs, escalatingActors, sinceDays } = data

  return (
    <div className="cyber-card p-6">
      <h3 className="text-sm text-gray-400 mb-4">
        What's Changed <span className="text-gray-600">(last {sinceDays} days)</span>
      </h3>

      <div className="space-y-2">
        <StatItem
          icon="⚠️"
          label="New Incidents"
          value={newIncidents}
          link="/incidents"
          highlight={newIncidents > 50}
        />

        <StatItem
          icon="👥"
          label="New Actors"
          value={newActors}
          link="/actors"
          highlight={newActors > 0}
        />

        <StatItem
          icon="🛡️"
          label="New KEVs"
          value={newKEVs}
          link="/vulnerabilities"
          highlight={newKEVs > 5}
        />
      </div>

      {/* Escalating Actors */}
      {escalatingActors?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Escalating Actors
          </div>
          <div className="space-y-1">
            {escalatingActors.slice(0, 5).map(actor => (
              <Link
                key={actor.id}
                to="/actors"
                state={{ selectedActorId: actor.id }}
                className="flex items-center justify-between p-2 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
              >
                <span className="text-sm text-white">{actor.name}</span>
                <span className="text-xs text-red-400">
                  {actor.incidents_7d || 0} incidents/7d
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChangeSummaryCard
