/**
 * Incident Detail Panel Component
 * Shows detailed incident information in sidebar (desktop) and modal (mobile)
 */
import { FullDate } from '../../components/TimeDisplay'
import { getStatusColor } from './IncidentConstants'

export function IncidentDetailPanel({ incident, onClose, onGoToActor }) {
  if (!incident) return null

  return (
    <div className="w-80 cyber-card hidden lg:block">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white truncate">
          {incident.victim_name || 'Unknown'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <IncidentDetails incident={incident} onGoToActor={onGoToActor} />
    </div>
  )
}

export function IncidentDetailModal({ incident, onClose, onGoToActor }) {
  if (!incident) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-cyber-darker/95 overflow-auto">
      <div className="min-h-screen p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white truncate">
            {incident.victim_name || 'Unknown'}
          </h2>
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
          <IncidentDetails incident={incident} onGoToActor={onGoToActor} isMobile />
        </div>
      </div>
    </div>
  )
}

function IncidentDetails({ incident, onGoToActor, isMobile = false }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-gray-500 mb-1">Threat Actor</div>
        <button
          onClick={() => onGoToActor(incident.actor_id)}
          className="text-cyber-accent font-medium hover:text-cyan-300 hover:underline"
        >
          {incident.threat_actor?.name || 'Unknown'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-500 mb-1">Sector</div>
          <div className="text-gray-300 capitalize">
            {incident.victim_sector || 'Unknown'}
          </div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Country</div>
          <div className="text-gray-300">
            {incident.victim_country || 'Unknown'}
          </div>
        </div>
      </div>

      <div>
        <div className="text-gray-500 mb-1">Discovered</div>
        <div className="text-gray-300">
          <FullDate date={incident.discovered_date} />
        </div>
      </div>

      <div>
        <div className="text-gray-500 mb-1">Status</div>
        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(incident.status)}`}>
          {incident.status || 'unknown'}
        </span>
      </div>

      {incident.data_leaked && (
        <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
          <div className="text-red-400 text-xs font-medium">Data Leaked</div>
          {incident.data_size && (
            <div className="text-red-300 text-xs">
              Size: {incident.data_size}
            </div>
          )}
        </div>
      )}

      {incident.victim_website && (
        <div>
          <div className="text-gray-500 mb-1">Website</div>
          <div className={`text-gray-300 text-xs font-mono ${isMobile ? 'break-all' : 'truncate'}`}>
            {incident.victim_website}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-800">
        <div className="text-gray-500 text-xs">
          Source: {incident.source || 'ransomware.live'}
        </div>
      </div>
    </div>
  )
}

export default IncidentDetailPanel
