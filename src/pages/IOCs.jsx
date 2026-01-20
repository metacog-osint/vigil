/**
 * Unified IOCs Page
 *
 * Combines IOC Search, Bulk Search, and Custom IOCs into a tabbed interface
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

// Import existing page content as components
import IOCSearchContent from './iocs/IOCSearchContent'
import BulkSearchContent from './iocs/BulkSearchContent'
import CustomIOCsContent from './iocs/CustomIOCsContent'

const TABS = [
  { id: 'search', name: 'Search', description: 'Look up IOCs in threat intel' },
  { id: 'bulk', name: 'Bulk Search', description: 'Search multiple IOCs at once' },
  { id: 'custom', name: 'My IOCs', description: 'Manage your custom IOC lists' },
]

export default function IOCs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'search')

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab !== 'search') {
      setSearchParams({ tab: activeTab })
    } else {
      setSearchParams({})
    }
  }, [activeTab, setSearchParams])

  // Sync with URL on mount
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && TABS.find((t) => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">IOC Intelligence</h1>
        <p className="text-gray-400 text-sm mt-1">Search and manage indicators of compromise</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-4" aria-label="IOC sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-1 py-3 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                }
              `}
              title={tab.description}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'search' && <IOCSearchContent />}
        {activeTab === 'bulk' && <BulkSearchContent />}
        {activeTab === 'custom' && <CustomIOCsContent />}
      </div>
    </div>
  )
}
