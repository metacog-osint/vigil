/**
 * Unified Activity Page
 *
 * Combines Events (unified timeline) and Incidents (ransomware tracking) into tabs
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

// Import existing pages as content
import EventsContent from './activity/EventsContent'
import IncidentsContent from './activity/IncidentsContent'

const TABS = [
  { id: 'timeline', name: 'Timeline', description: 'All security events in one view' },
  { id: 'ransomware', name: 'Ransomware', description: 'Ransomware incident tracking' },
]

export default function Activity() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('view') || 'timeline')

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab !== 'timeline') {
      setSearchParams({ view: activeTab })
    } else {
      setSearchParams({})
    }
  }, [activeTab, setSearchParams])

  // Sync with URL on mount
  useEffect(() => {
    const viewFromUrl = searchParams.get('view')
    if (viewFromUrl && TABS.find((t) => t.id === viewFromUrl)) {
      setActiveTab(viewFromUrl)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Security Activity</h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitor threats, incidents, and security events
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-4" aria-label="Activity views">
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
        {activeTab === 'timeline' && <EventsContent />}
        {activeTab === 'ransomware' && <IncidentsContent />}
      </div>
    </div>
  )
}
