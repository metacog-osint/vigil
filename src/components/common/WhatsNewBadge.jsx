/**
 * WhatsNewBadge Component
 *
 * Shows count of new items since last visit with dropdown breakdown.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLastVisit } from '../../hooks/useLastVisit'
import { getNewItemCounts, getNewItems, categoryMeta } from '../../lib/whatsNew'

// Category icons
const CategoryIcon = ({ category, className = 'w-4 h-4' }) => {
  const icons = {
    incidents: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    actors: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    kevs: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    iocs: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  }
  return icons[category] || null
}

// Route mapping for categories
const categoryRoutes = {
  incidents: '/activity?view=ransomware',
  actors: '/actors',
  kevs: '/vulnerabilities',
  iocs: '/iocs',
}

export function WhatsNewBadge() {
  const { lastVisit, getTimeSinceLastVisit, updateLastVisit } = useLastVisit()
  const [isOpen, setIsOpen] = useState(false)
  const [counts, setCounts] = useState({ total: 0, breakdown: {} })
  const [items, setItems] = useState({ incidents: [], actors: [], kevs: [] })
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef(null)

  // Load counts when lastVisit changes
  useEffect(() => {
    if (!lastVisit) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [countsData, itemsData] = await Promise.all([
          getNewItemCounts(lastVisit),
          getNewItems(lastVisit, 3),
        ])
        setCounts(countsData)
        setItems(itemsData)
      } catch (error) {
        console.error('Error loading what\'s new:', error)
      }
      setIsLoading(false)
    }

    loadData()

    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [lastVisit])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Handle marking as read
  const handleMarkAsRead = () => {
    updateLastVisit()
    setIsOpen(false)
  }

  const timeSince = getTimeSinceLastVisit()

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all
          ${counts.total > 0
            ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30'
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }
        `}
        aria-label={`${counts.total} new items since ${timeSince}`}
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {counts.total > 0 && (
          <span className="font-medium">
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-cyber-dark border border-gray-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">What's New</h3>
              <span className="text-xs text-gray-500">Since {timeSince}</span>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : counts.total === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-gray-400">You're all caught up!</p>
              <p className="text-xs text-gray-500 mt-1">No new items since your last visit</p>
            </div>
          ) : (
            <>
              {/* Breakdown by category */}
              <div className="px-4 py-3 space-y-2">
                {Object.entries(counts.breakdown)
                  .filter(([, count]) => count > 0)
                  .map(([category, count]) => {
                    const meta = categoryMeta[category]
                    return (
                      <Link
                        key={category}
                        to={categoryRoutes[category]}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors group"
                      >
                        <div className={`p-1.5 rounded ${meta.bgColor}`}>
                          <CategoryIcon category={category} className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-300 group-hover:text-white">
                            {count} new {count === 1 ? meta.singularLabel : meta.label.toLowerCase()}
                          </span>
                        </div>
                        <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )
                  })}
              </div>

              {/* Recent items preview */}
              {items.incidents.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-700/50">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Latest Incidents</h4>
                  <div className="space-y-1.5">
                    {items.incidents.slice(0, 2).map((incident) => (
                      <Link
                        key={incident.id}
                        to="/activity?view=ransomware"
                        onClick={() => setIsOpen(false)}
                        className="block p-2 rounded hover:bg-gray-800 transition-colors"
                      >
                        <div className="text-sm text-gray-300 truncate">{incident.victim_name}</div>
                        <div className="text-xs text-gray-500">
                          {incident.threat_actor?.name || 'Unknown actor'}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-700 flex justify-between items-center">
            <button
              onClick={handleMarkAsRead}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Mark all as read
            </button>
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default WhatsNewBadge
