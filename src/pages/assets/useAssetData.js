/**
 * Asset Data Hooks
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { assets, assetMatches } from '../../lib/assets'

/**
 * Main hook for asset data loading
 */
export function useAssetData(userId) {
  const [assetList, setAssetList] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ total: 0, monitored: 0, withMatches: 0, byType: {}, byCriticality: {} })
  const [matchStats, setMatchStats] = useState({ total: 0, byStatus: {}, bySeverity: {} })

  const loadData = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)
    try {
      const [assetData, matchData, assetStats, matchStatsData] = await Promise.all([
        assets.getAll(userId),
        assetMatches.getAll(userId, { limit: 50 }),
        assets.getStats(userId),
        assetMatches.getStats(userId),
      ])
      setAssetList(assetData)
      setMatches(matchData)
      setStats(assetStats)
      setMatchStats(matchStatsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId, loadData])

  return {
    assetList,
    setAssetList,
    matches,
    setMatches,
    loading,
    error,
    stats,
    matchStats,
    refresh: loadData,
  }
}

/**
 * Hook for asset filtering
 */
export function useAssetFilters(assetList, matches) {
  const [assetTypeFilter, setAssetTypeFilter] = useState('')
  const [criticalityFilter, setCriticalityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAssets = useMemo(() => {
    return assetList.filter(asset => {
      if (assetTypeFilter && asset.asset_type !== assetTypeFilter) return false
      if (criticalityFilter && asset.criticality !== criticalityFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!asset.value.includes(q) && !(asset.name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [assetList, assetTypeFilter, criticalityFilter, searchQuery])

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      if (statusFilter && match.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!match.matched_value.includes(q) && !(match.asset_name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [matches, statusFilter, searchQuery])

  return {
    assetTypeFilter,
    setAssetTypeFilter,
    criticalityFilter,
    setCriticalityFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    filteredAssets,
    filteredMatches,
  }
}

/**
 * Hook for asset actions
 */
export function useAssetActions(userId, setAssetList, setMatches, refresh) {
  const handleDeleteAsset = useCallback(async (assetId) => {
    if (!confirm('Delete this asset? This cannot be undone.')) return false
    try {
      await assets.delete(assetId, userId)
      setAssetList(prev => prev.filter(a => a.id !== assetId))
      return true
    } catch (err) {
      alert('Failed to delete asset: ' + err.message)
      return false
    }
  }, [userId, setAssetList])

  const handleToggleMonitoring = useCallback(async (assetId, enabled) => {
    try {
      await assets.toggleMonitoring(assetId, userId, enabled)
      setAssetList(prev => prev.map(a => a.id === assetId ? { ...a, is_monitored: enabled } : a))
      return true
    } catch (err) {
      alert('Failed to update asset: ' + err.message)
      return false
    }
  }, [userId, setAssetList])

  const handleUpdateMatchStatus = useCallback(async (matchId, status) => {
    try {
      await assetMatches.updateStatus(matchId, userId, status)
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m))
      return true
    } catch (err) {
      alert('Failed to update match: ' + err.message)
      return false
    }
  }, [userId, setMatches])

  const handleCreateAsset = useCallback(async (data) => {
    await assets.create(userId, data)
    await refresh()
  }, [userId, refresh])

  const handleBulkImport = useCallback(async (assetsData) => {
    await assets.createBulk(userId, assetsData)
    await refresh()
  }, [userId, refresh])

  return {
    handleDeleteAsset,
    handleToggleMonitoring,
    handleUpdateMatchStatus,
    handleCreateAsset,
    handleBulkImport,
  }
}
