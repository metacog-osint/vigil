/**
 * Asset Table View Component
 */
import { ASSET_TYPES } from '../../lib/assets'
import { CriticalityBadge } from './AssetConstants.jsx'

export default function AssetTableView({ assets, onSelectAsset, onToggleMonitoring, onAddAsset }) {
  if (assets.length === 0) {
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
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
        <p className="text-gray-400 mb-4">No assets found</p>
        <button onClick={onAddAsset} className="cyber-button-primary text-sm">
          Add Your First Asset
        </button>
      </div>
    )
  }

  return (
    <div className="cyber-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Asset
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Criticality
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Matches
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {assets.map((asset) => (
            <tr
              key={asset.id}
              className="hover:bg-gray-800/50 cursor-pointer"
              onClick={() => onSelectAsset(asset)}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-white">{asset.value}</div>
                {asset.name && <div className="text-sm text-gray-400">{asset.name}</div>}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-${ASSET_TYPES[asset.asset_type]?.color || 'gray'}-500/20 text-${ASSET_TYPES[asset.asset_type]?.color || 'gray'}-400`}
                >
                  {ASSET_TYPES[asset.asset_type]?.label || asset.asset_type}
                </span>
              </td>
              <td className="px-4 py-3">
                <CriticalityBadge criticality={asset.criticality} />
              </td>
              <td className="px-4 py-3">
                {asset.match_count > 0 ? (
                  <span className="text-red-400 font-medium">{asset.match_count}</span>
                ) : (
                  <span className="text-gray-500">0</span>
                )}
                {asset.new_matches > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                    {asset.new_matches} new
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {asset.is_monitored ? (
                  <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                    <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
                    Paused
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleMonitoring(asset.id, !asset.is_monitored)
                  }}
                  className="text-gray-400 hover:text-white p-1"
                  title={asset.is_monitored ? 'Pause monitoring' : 'Enable monitoring'}
                >
                  {asset.is_monitored ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
