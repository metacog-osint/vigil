/**
 * Custom IOCs Content - used within the unified IOCs page
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { IOC_TYPES, exportIocsToCsv, exportIocsToStix } from '../../lib/customIocs'
import { FeatureGate } from '../../components/UpgradePrompt'
import { useIocData, useIocFilters, useIocActions } from '../customIocs/useIocData'
import { CreateListModal, AddIocModal, ImportModal, ExportModal } from '../customIocs/IocModals.jsx'
import IocTableView from '../customIocs/IocTableView.jsx'
import IocListSidebar from '../customIocs/IocListSidebar.jsx'

export default function CustomIOCsContent() {
  const { user } = useAuth()

  const {
    lists,
    setLists,
    selectedList,
    setSelectedList,
    iocs,
    loading,
    error,
    setError,
    loadLists,
    loadIocs,
  } = useIocData(user?.uid)

  const {
    iocTypeFilter,
    setIocTypeFilter,
    severityFilter,
    setSeverityFilter,
    searchQuery,
    setSearchQuery,
    filteredIocs,
  } = useIocFilters(iocs)

  const { handleCreateList, handleDeleteList, handleAddIoc, handleImport, handleDeleteIocs } =
    useIocActions(user?.uid, lists, setLists, selectedList, setSelectedList, loadLists, loadIocs)

  const [showCreateListModal, setShowCreateListModal] = useState(false)
  const [showAddIocModal, setShowAddIocModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedIocs, setSelectedIocs] = useState([])

  function handleExport(format) {
    const iocsToExport =
      selectedIocs.length > 0 ? iocs.filter((i) => selectedIocs.includes(i.id)) : iocs

    let content, filename, mimeType

    if (format === 'csv') {
      content = exportIocsToCsv(iocsToExport)
      filename = `${selectedList.name.replace(/\s+/g, '_')}_iocs.csv`
      mimeType = 'text/csv'
    } else if (format === 'stix') {
      content = exportIocsToStix(iocsToExport, selectedList.name)
      filename = `${selectedList.name.replace(/\s+/g, '_')}_iocs.stix.json`
      mimeType = 'application/json'
    } else {
      content = iocsToExport.map((i) => i.value).join('\n')
      filename = `${selectedList.name.replace(/\s+/g, '_')}_iocs.txt`
      mimeType = 'text/plain'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Please sign in to manage custom IOCs.</p>
      </div>
    )
  }

  return (
    <FeatureGate
      feature="custom_ioc_lists"
      fallbackMessage="Custom IOC Lists is a Professional feature."
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateListModal(true)}
            className="cyber-button-primary text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New List
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* List Sidebar */}
          <IocListSidebar
            lists={lists}
            selectedList={selectedList}
            onSelectList={setSelectedList}
            onShowCreateModal={() => setShowCreateListModal(true)}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {!selectedList ? (
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-gray-400 mb-4">Select a list or create a new one</p>
                <button
                  onClick={() => setShowCreateListModal(true)}
                  className="cyber-button-primary text-sm"
                >
                  Create Your First List
                </button>
              </div>
            ) : (
              <>
                {/* List Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedList.name}</h2>
                    {selectedList.description && (
                      <p className="text-sm text-gray-400 mt-1">{selectedList.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="cyber-button text-sm"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Import
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="cyber-button text-sm"
                      disabled={iocs.length === 0}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Export
                    </button>
                    <button
                      onClick={() => setShowAddIocModal(true)}
                      className="cyber-button-primary text-sm"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add IOC
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search IOCs..."
                    className="cyber-input text-sm w-64"
                  />

                  <select
                    value={iocTypeFilter}
                    onChange={(e) => setIocTypeFilter(e.target.value)}
                    className="cyber-input text-sm"
                  >
                    <option value="">All Types</option>
                    {Object.entries(IOC_TYPES).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="cyber-input text-sm"
                  >
                    <option value="">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  {selectedIocs.length > 0 && (
                    <button
                      onClick={async () => {
                        const success = await handleDeleteIocs(selectedIocs)
                        if (success) setSelectedIocs([])
                      }}
                      className="cyber-button text-red-400 hover:bg-red-500/10 text-sm"
                    >
                      Delete {selectedIocs.length} selected
                    </button>
                  )}
                </div>

                {/* IOCs Table */}
                {loading ? (
                  <div className="cyber-card p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading IOCs...</p>
                  </div>
                ) : (
                  <IocTableView
                    iocs={filteredIocs}
                    selectedIocs={selectedIocs}
                    setSelectedIocs={setSelectedIocs}
                    onShowAddModal={() => setShowAddIocModal(true)}
                    onShowImportModal={() => setShowImportModal(true)}
                  />
                )}

                {/* List Actions */}
                <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                  <button
                    onClick={() => handleDeleteList(selectedList.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete this list
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modals */}
        {showCreateListModal && (
          <CreateListModal
            onClose={() => setShowCreateListModal(false)}
            onSave={async (data) => {
              try {
                await handleCreateList(data)
                setShowCreateListModal(false)
              } catch (err) {
                alert('Failed to create list: ' + err.message)
              }
            }}
          />
        )}

        {showAddIocModal && selectedList && (
          <AddIocModal
            onClose={() => setShowAddIocModal(false)}
            onSave={async (data) => {
              try {
                await handleAddIoc(data)
                setShowAddIocModal(false)
              } catch (err) {
                if (err.message.includes('duplicate')) {
                  alert('This IOC already exists in this list')
                } else {
                  alert('Failed to add IOC: ' + err.message)
                }
              }
            }}
          />
        )}

        {showImportModal && selectedList && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onImport={async (data) => {
              try {
                const result = await handleImport(data)
                setShowImportModal(false)
                alert(`Imported ${result.length} IOCs`)
              } catch (err) {
                alert('Import failed: ' + err.message)
              }
            }}
          />
        )}

        {showExportModal && selectedList && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={handleExport}
            count={selectedIocs.length || iocs.length}
          />
        )}
      </div>
    </FeatureGate>
  )
}
