/**
 * Actor Detail Panel Component
 * Shows detailed information about a selected threat actor
 */
import { TrendBadge, Timeline, CorrelationPanel } from '../../components'

export function ActorDetailPanel({
  actor,
  onClose,
  timelineEvents = [],
  relatedActors = [],
  onSelectActor,
  isMobile = false,
}) {
  if (!actor) return null

  const content = (
    <div className="space-y-4 text-sm">
      {/* Trend Status */}
      <div className="p-3 rounded-lg bg-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-500">Trend Status</span>
          <TrendBadge status={actor.trend_status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Last 7 days:</span>
            <span className="text-white ml-1">{actor.incidents_7d || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Previous 7d:</span>
            <span className="text-gray-400 ml-1">{actor.incidents_prev_7d || 0}</span>
          </div>
        </div>
        {actor.incident_velocity > 0 && (
          <div className="text-xs text-gray-400 mt-1">
            Velocity: {actor.incident_velocity} incidents/day
          </div>
        )}
      </div>

      {/* AI Summary */}
      {actor.ai_summary && (
        <div className="p-3 rounded-lg bg-cyber-accent/10 border border-cyber-accent/30">
          <div className="text-xs text-cyber-accent mb-1 font-medium">AI Summary</div>
          <div className="text-gray-300 text-xs">{actor.ai_summary}</div>
        </div>
      )}

      {actor.aliases?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Aliases</div>
          <div className="text-gray-300">{actor.aliases.join(', ')}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-500 mb-1">First Seen</div>
          <div className="text-gray-300">{actor.first_seen || 'Unknown'}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Last Seen</div>
          <div className="text-gray-300">{actor.last_seen || 'Unknown'}</div>
        </div>
      </div>

      {actor.target_sectors?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">Target Sectors</div>
          <div className="flex flex-wrap gap-1">
            {actor.target_sectors.map((sector) => (
              <span key={sector} className="badge-info">
                {sector}
              </span>
            ))}
          </div>
        </div>
      )}

      {actor.ttps?.length > 0 && (
        <div>
          <div className="text-gray-500 mb-1">TTPs (MITRE)</div>
          <div className="flex flex-wrap gap-1">
            {actor.ttps.map((ttp) => (
              <span key={ttp} className="text-xs font-mono text-cyber-accent">
                {ttp}
              </span>
            ))}
          </div>
        </div>
      )}

      {actor.description && (
        <div>
          <div className="text-gray-500 mb-1">Description</div>
          <div className="text-gray-300 text-xs">{actor.description}</div>
        </div>
      )}

      {/* Activity Timeline */}
      {timelineEvents.length > 0 && (
        <div className="pt-4 border-t border-gray-800">
          <div className="text-gray-500 mb-2">Recent Activity ({timelineEvents.length} incidents)</div>
          <Timeline events={timelineEvents} maxItems={5} className={isMobile ? '' : 'max-h-64 overflow-y-auto'} />
        </div>
      )}

      {/* Correlation Panel - TTPs, CVEs, IOCs */}
      <div className="pt-4 border-t border-gray-800">
        <CorrelationPanel actorId={actor.id} actorName={actor.name} />
      </div>

      {/* Related Actors */}
      {relatedActors.length > 0 && (
        <div className="pt-4 border-t border-gray-800">
          <div className="text-gray-500 mb-2">Similar Actors</div>
          <div className="space-y-2">
            {relatedActors.map(relatedActor => (
              <button
                key={relatedActor.id}
                onClick={() => onSelectActor?.(relatedActor)}
                className="w-full flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 text-left transition-colors"
              >
                <div>
                  <div className="text-sm text-white">{relatedActor.name}</div>
                  <div className="text-xs text-gray-500">
                    {relatedActor.actor_type} • {relatedActor.similarityScore}% match
                  </div>
                </div>
                <TrendBadge status={relatedActor.trend_status} showLabel={false} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-800">
        <div className="text-gray-500 text-xs">
          Source: {actor.source || 'Unknown'}
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="lg:hidden fixed inset-0 z-50 bg-cyber-darker/95 overflow-auto">
        <div className="min-h-screen p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{actor.name}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="cyber-card">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 cyber-card hidden lg:block">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{actor.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {content}
    </div>
  )
}

export default ActorDetailPanel
