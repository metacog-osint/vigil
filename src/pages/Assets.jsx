/**
 * Assets Page - Attack Surface Monitoring
 *
 * Extracted components in ./assets/:
 * - AssetConstants.js: CriticalityBadge, MatchStatusBadge
 * - useAssetData.js: useAssetData, useAssetFilters, useAssetActions
 * - AssetModals.jsx: AddAssetModal, BulkImportModal
 * - AssetPanels.jsx: AssetDetailPanel, MatchDetailPanel
 * - AssetTableView.jsx: Asset table display
 * - MatchTableView.jsx: Match table display
 */
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ASSET_TYPES, CRITICALITY_OPTIONS, MATCH_STATUSES } from '../lib/assets'
import { FeatureGate } from '../components/UpgradePrompt'
import { useAssetData, useAssetFilters, useAssetActions } from './assets/useAssetData'
import { AddAssetModal, BulkImportModal } from './assets/AssetModals'
import { AssetDetailPanel, MatchDetailPanel } from './assets/AssetPanels'
import AssetTableView from './assets/AssetTableView'
import MatchTableView from './assets/MatchTableView'

export default function Assets() {
  const { user } = useAuth()

  // Data loading
  const {
    assetList,
    setAssetList,
    matches,
    setMatches,
    loading,
    error,
    stats,
    matchStats,
    refresh,
  } = useAssetData(user?.uid)

  // Filters
  const {
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
  } = useAssetFilters(assetList, matches)

  // Actions
  const {
    handleDeleteAsset,
    handleToggleMonitoring,
    handleUpdateMatchStatus,
    handleCreateAsset,
    handleBulkImport,
  } = useAssetActions(user?.uid, setAssetList, setMatches, refresh)

  // UI state
  const [activeTab, setActiveTab] = useState('assets')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Please sign in to manage your assets.</p>
      </div>
    )
  }

  return (
    <FeatureGate
      feature="attack_surface"
      fallbackMessage="Attack Surface Monitoring is a Professional feature."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Attack Surface</h1>
            <p className="text-gray-400 text-sm mt-1">
              Monitor your assets against threat intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkModal(true)} className="cyber-button text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import
            </button>
            <button onClick={() => setShowAddModal(true)} className="cyber-button-primary text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Asset
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Assets</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-green-400">{stats.monitored}</div>
            <div className="text-sm text-gray-400">Monitored</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-red-400">{matchStats.byStatus?.new || 0}</div>
            <div className="text-sm text-gray-400">New Matches</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.withMatches}</div>
            <div className="text-sm text-gray-400">Assets w/ Hits</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setActiveTab('assets')}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === 'assets'
                  ? 'border-cyber-accent text-cyber-accent'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Assets ({filteredAssets.length})
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === 'matches'
                  ? 'border-cyber-accent text-cyber-accent'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Matches ({filteredMatches.length})
              {matchStats.byStatus?.new > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                  {matchStats.byStatus.new} new
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="cyber-input text-sm w-64"
          />

          {activeTab === 'assets' && (
            <>
              <select
                value={assetTypeFilter}
                onChange={(e) => setAssetTypeFilter(e.target.value)}
                className="cyber-input text-sm"
              >
                <option value="">All Types</option>
                {Object.entries(ASSET_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
                className="cyber-input text-sm"
              >
                <option value="">All Criticality</option>
                {CRITICALITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          )}

          {activeTab === 'matches' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cyber-input text-sm"
            >
              <option value="">All Status</option>
              {MATCH_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="cyber-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading assets...</p>
          </div>
        ) : activeTab === 'assets' ? (
          <AssetTableView
            assets={filteredAssets}
            onSelectAsset={setSelectedAsset}
            onToggleMonitoring={handleToggleMonitoring}
            onAddAsset={() => setShowAddModal(true)}
          />
        ) : (
          <MatchTableView matches={filteredMatches} onSelectMatch={setSelectedMatch} />
        )}

        {/* Modals */}
        {showAddModal && (
          <AddAssetModal
            onClose={() => setShowAddModal(false)}
            onSave={async (data) => {
              await handleCreateAsset(data)
              setShowAddModal(false)
            }}
          />
        )}

        {showBulkModal && (
          <BulkImportModal
            onClose={() => setShowBulkModal(false)}
            onSave={async (assetsData) => {
              await handleBulkImport(assetsData)
              setShowBulkModal(false)
            }}
          />
        )}

        {/* Detail Panels */}
        {selectedAsset && (
          <AssetDetailPanel
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onDelete={async () => {
              const success = await handleDeleteAsset(selectedAsset.id)
              if (success) setSelectedAsset(null)
            }}
            onToggleMonitoring={(enabled) => handleToggleMonitoring(selectedAsset.id, enabled)}
          />
        )}

        {selectedMatch && (
          <MatchDetailPanel
            match={selectedMatch}
            onClose={() => setSelectedMatch(null)}
            onUpdateStatus={async (status) => {
              await handleUpdateMatchStatus(selectedMatch.id, status)
              setSelectedMatch(null)
            }}
          />
        )}
      </div>
    </FeatureGate>
  )
}
