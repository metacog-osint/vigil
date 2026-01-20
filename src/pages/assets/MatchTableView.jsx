/**
 * Match Table View Component
 */
import { MATCH_TYPES } from '../../lib/assets'
import SeverityBadge from '../../components/SeverityBadge'
import { SmartTime } from '../../components/TimeDisplay'
import { MatchStatusBadge } from './AssetConstants.jsx'

export default function MatchTableView({ matches, onSelectMatch }) {
  if (matches.length === 0) {
    return (
      <div className="cyber-card p-8 text-center">
        <svg
          className="w-12 h-12 text-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-gray-400">No matches found</p>
        <p className="text-gray-500 text-sm mt-2">
          Your assets haven't been detected in threat intelligence yet.
        </p>
      </div>
    )
  }

  return (
    <div className="cyber-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Match
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Asset
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Severity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              When
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {matches.map((match) => (
            <tr
              key={match.id}
              className="hover:bg-gray-800/50 cursor-pointer"
              onClick={() => onSelectMatch(match)}
            >
              <td className="px-4 py-3">
                <div className="font-mono text-sm text-white">{match.matched_value}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-gray-300">{match.asset_name || match.asset_value}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded text-xs bg-${MATCH_TYPES[match.match_type]?.color || 'gray'}-500/20 text-${MATCH_TYPES[match.match_type]?.color || 'gray'}-400`}
                >
                  {MATCH_TYPES[match.match_type]?.label || match.match_type}
                </span>
              </td>
              <td className="px-4 py-3">
                <SeverityBadge severity={match.severity} />
              </td>
              <td className="px-4 py-3">
                <MatchStatusBadge status={match.status} />
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                <SmartTime date={match.matched_at} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
