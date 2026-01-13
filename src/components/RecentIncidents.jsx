import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'

export default function RecentIncidents({ incidents }) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        No recent incidents
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {incidents.map((incident) => (
        <Link
          key={incident.id}
          to="/incidents"
          className="block p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">
                {incident.victim_name || 'Unknown Victim'}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-cyber-accent">
                  {incident.threat_actor?.name || 'Unknown'}
                </span>
                {incident.victim_sector && <span>• {incident.victim_sector}</span>}
              </div>
            </div>
            <div className="text-xs text-gray-500 ml-2">
              {incident.discovered_date
                ? formatDistanceToNow(new Date(incident.discovered_date), {
                    addSuffix: true,
                  })
                : ''}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
