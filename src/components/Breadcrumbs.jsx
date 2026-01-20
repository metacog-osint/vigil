/**
 * Breadcrumbs Component
 *
 * Provides navigation context and hierarchy for the current page.
 * Auto-generates breadcrumbs based on the current route or accepts custom items.
 */

import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

// Route to label mapping
const routeLabels = {
  '': 'Dashboard',
  events: 'Activity',
  actors: 'Threat Actors',
  vulnerabilities: 'Vulnerabilities',
  advisories: 'Advisories',
  iocs: 'IOC Search',
  techniques: 'ATT&CK Matrix',
  'threat-hunts': 'Threat Hunts',
  trends: 'Trends',
  reports: 'Reports',
  investigations: 'Investigations',
  watchlists: 'Watchlists',
  alerts: 'Alerts',
  assets: 'Assets',
  settings: 'Settings',
  help: 'Help',
  pricing: 'Pricing',
  'api-docs': 'API Docs',
  'audit-logs': 'Audit Logs',
  status: 'Status',
  webhooks: 'Webhooks',
  vendors: 'Vendors',
  benchmarks: 'Benchmarks',
  chat: 'Chat Integrations',
  ops: 'Operations',
  'advanced-search': 'Advanced Search',
}

// Icons
const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
)

const ChevronIcon = () => (
  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

/**
 * Breadcrumbs component
 *
 * @param {Object} props
 * @param {Array} props.items - Custom breadcrumb items [{label, href}]
 * @param {boolean} props.showHome - Whether to show home icon (default: true)
 * @param {string} props.className - Additional CSS classes
 */
export default function Breadcrumbs({ items, showHome = true, className }) {
  const location = useLocation()

  // Generate breadcrumbs from route if items not provided
  const breadcrumbItems = items || generateBreadcrumbs(location.pathname)

  // Don't show breadcrumbs on home page
  if (breadcrumbItems.length === 0) {
    return null
  }

  return (
    <nav className={clsx('flex items-center text-sm', className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        {/* Home link */}
        {showHome && (
          <>
            <li>
              <Link
                to="/"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Home"
              >
                <HomeIcon />
              </Link>
            </li>
            {breadcrumbItems.length > 0 && (
              <li className="flex items-center">
                <ChevronIcon />
              </li>
            )}
          </>
        )}

        {/* Breadcrumb items */}
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1

          return (
            <li key={item.href || index} className="flex items-center gap-2">
              {isLast ? (
                <span className="text-gray-300 font-medium" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link
                    to={item.href}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                  <ChevronIcon />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Generate breadcrumbs from pathname
 */
function generateBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return []
  }

  const breadcrumbs = []
  let currentPath = ''

  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = routeLabels[segment] || formatSegment(segment)

    breadcrumbs.push({
      label,
      href: currentPath,
    })
  }

  return breadcrumbs
}

/**
 * Format a URL segment into a readable label
 */
function formatSegment(segment) {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Compact breadcrumbs for mobile/tight spaces
 */
export function BreadcrumbsCompact({ items, className }) {
  const location = useLocation()
  const breadcrumbItems = items || generateBreadcrumbs(location.pathname)

  if (breadcrumbItems.length === 0) {
    return null
  }

  // Only show current page on mobile
  const current = breadcrumbItems[breadcrumbItems.length - 1]
  const parent = breadcrumbItems.length > 1 ? breadcrumbItems[breadcrumbItems.length - 2] : null

  return (
    <nav className={clsx('flex items-center text-sm', className)} aria-label="Breadcrumb">
      {parent && (
        <>
          <Link
            to={parent.href}
            className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">{parent.label}</span>
          </Link>
          <ChevronIcon />
        </>
      )}
      <span className="text-gray-300 font-medium" aria-current="page">
        {current.label}
      </span>
    </nav>
  )
}
