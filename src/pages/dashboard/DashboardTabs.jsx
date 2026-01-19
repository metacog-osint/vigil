/**
 * DashboardTabs Component
 *
 * Tab navigation for the dashboard with URL sync support
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export const DASHBOARD_TABS = [
  { id: 'activity', name: 'Activity', icon: 'chart', description: 'Charts, calendar, and trends' },
  { id: 'threats', name: 'Threats', icon: 'actors', description: 'Actors, sectors, and kill chain' },
  { id: 'vulnerabilities', name: 'Vulnerabilities', icon: 'shield', description: 'KEVs, exploitation, and services' },
  { id: 'geography', name: 'Geography', icon: 'globe', description: 'Map and attribution' },
  { id: 'industries', name: 'Industries', icon: 'building', description: 'Threats by industry sector' },
  { id: 'countries', name: 'Countries', icon: 'flag', description: 'Threats by country' },
]

const TabIcon = ({ icon, className = 'w-4 h-4' }) => {
  const icons = {
    chart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    actors: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    shield: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    globe: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    building: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    flag: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  }
  return icons[icon] || null
}

export default function DashboardTabs({ activeTab, onTabChange }) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab !== 'activity') {
      setSearchParams({ tab: activeTab })
    } else {
      setSearchParams({})
    }
  }, [activeTab, setSearchParams])

  // Sync with URL on mount (intentionally only runs once)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && DASHBOARD_TABS.find(t => t.id === tabFromUrl)) {
      onTabChange(tabFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="border-b border-gray-800">
      <nav className="flex gap-1 sm:gap-4" aria-label="Dashboard sections">
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-2 sm:px-3 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
              }
            `}
            title={tab.description}
          >
            <TabIcon icon={tab.icon} className="w-4 h-4 hidden sm:block" />
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
