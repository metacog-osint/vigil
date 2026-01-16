/**
 * Investigations Page - Threat Investigation Notebook Management
 *
 * Extracted components in ./investigations/:
 * - InvestigationConstants.jsx: Colors and badge components
 * - useInvestigationData.js: Data loading and action hooks
 * - InvestigationCard.jsx: Investigation list card
 * - EntryCard.jsx: Entry card display
 * - InvestigationDetail.jsx: Detail view with entries
 * - CreateInvestigationModal.jsx: Create modal
 * - InvestigationSidebar.jsx: Sidebar components
 */
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../contexts/SubscriptionContext'
import { UpgradePrompt } from '../components/UpgradePrompt'
import { useInvestigationData, useInvestigationActions } from './investigations/useInvestigationData'
import InvestigationDetail from './investigations/InvestigationDetail.jsx'
import CreateInvestigationModal from './investigations/CreateInvestigationModal.jsx'
import {
  InvestigationStats,
  InvestigationFilters,
  InvestigationList,
  MobileSidebar,
} from './investigations/InvestigationSidebar.jsx'

export default function Investigations() {
  const { user } = useAuth()
  const { canAccess, tier } = useSubscription()
  const userId = user?.uid || 'anonymous'

  const hasAccess = canAccess('investigations') || canAccess('threat_hunts')

  // Filters state
  const [filters, setFilters] = useState({ status: '', category: '', search: '' })

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  // Data loading
  const {
    investigationList,
    setInvestigationList,
    selectedInvestigation,
    setSelectedInvestigation,
    templates,
    stats,
    loading,
    error,
    setError,
    loadData,
    loadInvestigation,
  } = useInvestigationData(userId, hasAccess, filters)

  // Actions
  const {
    handleCreate,
    handleUpdateStatus,
    handleDelete,
  } = useInvestigationActions(
    userId,
    investigationList,
    setInvestigationList,
    selectedInvestigation,
    setSelectedInvestigation,
    loadData,
    loadInvestigation
  )

  // Check access
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Investigations</h1>
          <p className="text-gray-400 text-sm mt-1">
            Document and track your threat investigations
          </p>
        </div>
        <UpgradePrompt feature="investigations" currentTier={tier} />
      </div>
    )
  }

  if (loading && investigationList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 p-4 lg:p-6">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-16 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-30 flex items-center justify-between">
        <button
          onClick={() => setShowMobileSidebar(true)}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm">{investigationList.length} Investigations</span>
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        show={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
        investigations={investigationList}
        selectedId={selectedInvestigation?.id}
        onSelect={loadInvestigation}
        stats={stats}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-80 flex-shrink-0 flex-col">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">Investigations</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <InvestigationStats stats={stats} />
          <InvestigationFilters filters={filters} setFilters={setFilters} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <InvestigationList
            investigations={investigationList}
            selectedId={selectedInvestigation?.id}
            onSelect={loadInvestigation}
            onShowCreate={() => setShowCreateModal(true)}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 mt-14 lg:mt-0">
        {selectedInvestigation ? (
          <InvestigationDetail
            investigation={selectedInvestigation}
            userId={userId}
            onUpdate={() => loadInvestigation(selectedInvestigation.id)}
            onStatusChange={(status) => handleUpdateStatus(selectedInvestigation.id, status)}
            onDelete={() => handleDelete(selectedInvestigation.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800/20 rounded-lg border border-gray-700">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select an investigation to view details</p>
              <p className="text-sm mt-1">or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInvestigationModal
          templates={templates}
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            try {
              await handleCreate(data)
              setShowCreateModal(false)
            } catch (err) {
              setError(err.message)
            }
          }}
        />
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2">&times;</button>
        </div>
      )}
    </div>
  )
}
