/**
 * Asset Detail Panel Components
 */
import { ASSET_TYPES, MATCH_TYPES, MATCH_STATUSES } from '../../lib/assets'
import SeverityBadge from '../../components/SeverityBadge'
import { SmartTime } from '../../components/TimeDisplay'
import { CriticalityBadge } from './AssetConstants.jsx'

export function AssetDetailPanel({ asset, onClose, onDelete, onToggleMonitoring }) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-cyber-dark border-l border-gray-800 shadow-xl z-50 overflow-y-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-cyber-dark">
        <h3 className="text-lg font-semibold text-white">Asset Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Value */}
        <div>
          <div className="text-sm text-gray-400 mb-1">Value</div>
          <div className="font-mono text-lg text-white break-all">{asset.value}</div>
        </div>

        {/* Name */}
        {asset.name && (
          <div>
            <div className="text-sm text-gray-400 mb-1">Name</div>
            <div className="text-white">{asset.name}</div>
          </div>
        )}

        {/* Type & Criticality */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Type</div>
            <span className={`inline-flex px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400`}>
              {ASSET_TYPES[asset.asset_type]?.label || asset.asset_type}
            </span>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Criticality</div>
            <CriticalityBadge criticality={asset.criticality} />
          </div>
        </div>

        {/* Monitoring Status */}
        <div>
          <div className="text-sm text-gray-400 mb-2">Monitoring</div>
          <button
            onClick={() => onToggleMonitoring(!asset.is_monitored)}
            className={`w-full p-3 rounded-lg border ${
              asset.is_monitored
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={asset.is_monitored ? 'text-green-400' : 'text-gray-400'}>
                {asset.is_monitored ? 'Active Monitoring' : 'Monitoring Paused'}
              </span>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${
                asset.is_monitored ? 'bg-green-500' : 'bg-gray-600'
              }`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  asset.is_monitored ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </button>
        </div>

        {/* Match Stats */}
        <div>
          <div className="text-sm text-gray-400 mb-2">Match History</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white">{asset.match_count || 0}</div>
              <div className="text-sm text-gray-400">Total Matches</div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-red-400">{asset.new_matches || 0}</div>
              <div className="text-sm text-gray-400">New Matches</div>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="text-sm text-gray-500 space-y-1">
          <div>Created: <SmartTime date={asset.created_at} /></div>
          {asset.last_match_at && (
            <div>Last match: <SmartTime date={asset.last_match_at} /></div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={onDelete}
            className="w-full cyber-button text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Asset
          </button>
        </div>
      </div>
    </div>
  )
}

export function MatchDetailPanel({ match, onClose, onUpdateStatus }) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-cyber-dark border-l border-gray-800 shadow-xl z-50 overflow-y-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-cyber-dark">
        <h3 className="text-lg font-semibold text-white">Match Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Matched Value */}
        <div>
          <div className="text-sm text-gray-400 mb-1">Matched Value</div>
          <div className="font-mono text-lg text-white break-all">{match.matched_value}</div>
        </div>

        {/* Asset */}
        <div>
          <div className="text-sm text-gray-400 mb-1">Asset</div>
          <div className="text-white">{match.asset_name || match.asset_value}</div>
        </div>

        {/* Type & Severity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Match Type</div>
            <span className={`inline-flex px-2 py-1 rounded text-sm bg-${MATCH_TYPES[match.match_type]?.color || 'gray'}-500/20 text-${MATCH_TYPES[match.match_type]?.color || 'gray'}-400`}>
              {MATCH_TYPES[match.match_type]?.label || match.match_type}
            </span>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Severity</div>
            <SeverityBadge severity={match.severity} />
          </div>
        </div>

        {/* Context */}
        {match.context && Object.keys(match.context).length > 0 && (
          <div>
            <div className="text-sm text-gray-400 mb-2">Context</div>
            <div className="bg-gray-800/50 rounded-lg p-3 font-mono text-xs text-gray-300 overflow-x-auto">
              <pre>{JSON.stringify(match.context, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <div className="text-sm text-gray-400 mb-2">Update Status</div>
          <div className="grid grid-cols-2 gap-2">
            {MATCH_STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onUpdateStatus(value)}
                className={`p-2 rounded-lg text-sm border ${
                  match.status === value
                    ? 'border-cyber-accent bg-cyber-accent/20 text-cyber-accent'
                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Timestamps */}
        <div className="text-sm text-gray-500 space-y-1">
          <div>Detected: <SmartTime date={match.matched_at} /></div>
          {match.resolved_at && (
            <div>Resolved: <SmartTime date={match.resolved_at} /></div>
          )}
        </div>
      </div>
    </div>
  )
}
