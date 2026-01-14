import { useState, useEffect } from 'react'
import { dataSources } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

export default function DataSourcesPanel() {
  const [sources, setSources] = useState([])
  const [actorCounts, setActorCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [syncStatus, counts] = await Promise.all([
      dataSources.getSyncStatus(),
      dataSources.getActorTypeCounts(),
    ])

    if (syncStatus.data) setSources(syncStatus.data)
    if (counts.data) setActorCounts(counts.data)
    setLoading(false)
  }

  function getStatusColor(status) {
    switch (status) {
      case 'success': return 'text-green-400'
      case 'partial': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      case 'never': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'success': return '✓'
      case 'partial': return '⚠'
      case 'error': return '✗'
      case 'never': return '○'
      default: return '?'
    }
  }

  function formatLastSync(dateStr) {
    if (!dateStr) return 'Never'
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  async function handleRefresh(sourceId) {
    setRefreshing(sourceId)
    try {
      const result = await dataSources.triggerManualUpdate(sourceId)
      if (result.success) {
        // Reload data to show updated counts
        await loadData()
        alert(`Success: ${result.message}`)
      } else {
        alert(`Info: ${result.message}`)
      }
    } catch (error) {
      console.error('Update failed:', error)
      alert(`Error: ${error.message}`)
    }
    setRefreshing(null)
  }

  const automatedSources = sources.filter(s => s.automated)
  const manualSources = sources.filter(s => !s.automated)

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Actor Type Summary */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Actor Coverage</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(actorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{count}</div>
                <div className="text-xs text-gray-400 capitalize">{type.replace(/_/g, ' ')}</div>
              </div>
            ))}
        </div>
        <div className="mt-3 text-right text-sm text-gray-500">
          Total: {Object.values(actorCounts).reduce((a, b) => a + b, 0)} actors
        </div>
      </div>

      {/* Automated Sources */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Automated Data Sources</h3>
          <span className="text-xs text-gray-500">Updates every 6 hours via GitHub Actions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-700">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Last Sync</th>
                <th className="pb-2 font-medium text-right">Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {automatedSources.map(source => (
                <tr key={source.id} className="text-gray-300">
                  <td className="py-2 font-medium">{source.name}</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs capitalize">
                      {source.type}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`font-mono ${getStatusColor(source.lastStatus)}`}>
                      {getStatusIcon(source.lastStatus)} {source.lastStatus}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400">{formatLastSync(source.lastSync)}</td>
                  <td className="py-2 text-right font-mono">{source.recordsAdded || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Sources */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Manual / Curated Sources</h3>
          <button
            onClick={() => handleRefresh('actor_types_seed')}
            disabled={refreshing === 'actor_types_seed'}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition disabled:opacity-50"
          >
            {refreshing === 'actor_types_seed' ? 'Updating...' : 'Update Curated Actors'}
          </button>
        </div>

        <div className="bg-gray-700/30 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2">
            Curated actor categories that require manual updates:
          </p>
          <ul className="text-sm text-gray-300 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-yellow-400">●</span>
              <span className="font-medium">Hacktivism</span> - No structured feed available
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-400">●</span>
              <span className="font-medium">Initial Access Brokers</span> - Curated from threat reports
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-400">●</span>
              <span className="font-medium">Data Extortion</span> - Subset of ransomware actors
            </li>
          </ul>
        </div>

        <div className="text-sm text-gray-500">
          <p className="mb-2">To update manually curated actors, run:</p>
          <code className="block bg-gray-900 text-cyan-400 p-3 rounded font-mono text-xs">
            npm run seed:actor-types
          </code>
        </div>

        {manualSources.length > 0 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <tbody>
                {manualSources.map(source => (
                  <tr key={source.id} className="text-gray-300 border-t border-gray-700/50">
                    <td className="py-2 font-medium">{source.name}</td>
                    <td className="py-2">
                      <span className={`font-mono ${getStatusColor(source.lastStatus)}`}>
                        {getStatusIcon(source.lastStatus)} {source.lastStatus}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{formatLastSync(source.lastSync)}</td>
                    <td className="py-2 text-right font-mono">{source.recordsAdded || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refresh All Button */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Status
        </button>
      </div>
    </div>
  )
}
