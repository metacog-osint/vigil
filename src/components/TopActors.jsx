import { Link } from 'react-router-dom'

export default function TopActors({ actors }) {
  if (!actors || actors.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        No active actors in the last 30 days
      </div>
    )
  }

  // Find max for bar scaling
  const maxCount = Math.max(...actors.map((a) => a.incident_count?.[0]?.count || 0))

  return (
    <div className="space-y-3">
      {actors.map((actor, index) => {
        const count = actor.incident_count?.[0]?.count || 0
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

        return (
          <Link
            key={actor.id}
            to="/actors"
            className="block group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs w-4">{index + 1}.</span>
                <span className="text-sm text-white group-hover:text-cyber-accent transition-colors">
                  {actor.name}
                </span>
              </div>
              <span className="text-sm text-gray-400">{count}</span>
            </div>
            <div className="ml-6 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyber-accent/50 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
