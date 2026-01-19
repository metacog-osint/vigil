import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSmartDefaults } from '../hooks/useSmartDefaults'

// Icons as reusable components
const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  events: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  actors: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  vulnerabilities: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  advisories: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  techniques: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  hunt: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  trends: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  compare: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  investigations: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  watchlist: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  alerts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  assets: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  help: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  pin: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  collapse: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  ),
}

// Navigation structure with groups
const navigationGroups = [
  {
    id: 'intelligence',
    name: 'Intelligence',
    defaultExpanded: true,
    items: [
      { name: 'Dashboard', href: '/', icon: icons.dashboard, tourId: 'nav-dashboard' },
      { name: 'Activity', href: '/events', icon: icons.events, tourId: 'nav-events' },
      { name: 'Threat Actors', href: '/actors', icon: icons.actors, tourId: 'nav-actors' },
      { name: 'Vulnerabilities', href: '/vulnerabilities', icon: icons.vulnerabilities },
      { name: 'Advisories', href: '/advisories', icon: icons.advisories },
    ],
  },
  {
    id: 'hunting',
    name: 'Hunting',
    defaultExpanded: true,
    items: [
      { name: 'IOC Search', href: '/iocs', icon: icons.search },
      { name: 'ATT&CK Matrix', href: '/techniques', icon: icons.techniques },
      { name: 'Threat Hunts', href: '/threat-hunts', icon: icons.hunt },
    ],
  },
  {
    id: 'analysis',
    name: 'Analysis',
    defaultExpanded: false,
    items: [
      { name: 'Trends', href: '/trends', icon: icons.trends },
      { name: 'Compare', href: '/compare', icon: icons.compare },
      { name: 'Reports', href: '/reports', icon: icons.reports },
      { name: 'Investigations', href: '/investigations', icon: icons.investigations },
    ],
  },
  {
    id: 'workspace',
    name: 'My Workspace',
    defaultExpanded: true,
    items: [
      { name: 'Watchlists', href: '/watchlists', icon: icons.watchlist, tourId: 'nav-watchlists' },
      { name: 'Alerts', href: '/alerts', icon: icons.alerts },
      { name: 'Assets', href: '/assets', icon: icons.assets },
    ],
  },
  {
    id: 'platform',
    name: 'Platform',
    defaultExpanded: false,
    items: [
      { name: 'Settings', href: '/settings', icon: icons.settings, tourId: 'nav-settings' },
      { name: 'Help', href: '/help', icon: icons.help },
    ],
  },
]

// Default pinned items for new users
const DEFAULT_PINNED = ['/', '/actors', '/alerts']

// Storage keys
const STORAGE_KEYS = {
  expanded: 'vigil_sidebar_expanded',
  pinned: 'vigil_sidebar_pinned',
}

// Get all navigation items flat
function getAllNavItems() {
  return navigationGroups.flatMap(group => group.items)
}

// Collapsible navigation group
function NavGroup({ group, isCollapsed, expandedGroups, onToggleGroup, onClose, pinnedItems, onTogglePin }) {
  const isExpanded = expandedGroups[group.id] ?? group.defaultExpanded

  if (isCollapsed) {
    // In collapsed mode, just show icons without grouping
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            onClose={onClose}
            isPinned={pinnedItems.includes(item.href)}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => onToggleGroup(group.id)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-400 uppercase tracking-wider"
      >
        <span>{group.name}</span>
        <span className={clsx('transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')}>
          {icons.chevronDown}
        </span>
      </button>

      <div className={clsx(
        'space-y-0.5 overflow-hidden transition-all duration-200',
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        {group.items.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            onClose={onClose}
            isPinned={pinnedItems.includes(item.href)}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </div>
  )
}

// Single navigation item
function NavItem({ item, isCollapsed, onClose, isPinned, onTogglePin, showPinButton = true }) {
  return (
    <div className="group relative">
      <NavLink
        to={item.href}
        onClick={onClose}
        title={isCollapsed ? item.name : undefined}
        data-tour={item.tourId}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isCollapsed ? 'justify-center px-2' : 'px-3',
            isActive
              ? 'bg-cyber-accent/20 text-cyber-accent'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )
        }
      >
        {item.icon}
        {!isCollapsed && <span className="flex-1">{item.name}</span>}
        {!isCollapsed && isPinned && (
          <span className="text-yellow-500 opacity-60">
            {icons.pin}
          </span>
        )}
      </NavLink>

      {/* Pin button on hover */}
      {!isCollapsed && showPinButton && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onTogglePin(item.href)
          }}
          className={clsx(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            isPinned
              ? 'text-yellow-500 hover:text-yellow-400'
              : 'text-gray-600 hover:text-gray-400'
          )}
          title={isPinned ? 'Unpin from top' : 'Pin to top'}
        >
          {icons.pin}
        </button>
      )}
    </div>
  )
}

// Pinned items section
function PinnedSection({ pinnedItems, isCollapsed, onClose, onTogglePin }) {
  const allItems = getAllNavItems()
  const pinned = pinnedItems
    .map(href => allItems.find(item => item.href === href))
    .filter(Boolean)

  if (pinned.length === 0) return null

  return (
    <div className={clsx('mb-3 pb-3 border-b border-gray-800/50', isCollapsed && 'border-none pb-0')}>
      {!isCollapsed && (
        <div className="px-3 py-1.5 text-xs font-semibold text-yellow-600/80 uppercase tracking-wider flex items-center gap-1">
          {icons.pin}
          <span>Pinned</span>
        </div>
      )}
      <div className="space-y-0.5">
        {pinned.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            onClose={onClose}
            isPinned={true}
            onTogglePin={onTogglePin}
            showPinButton={!isCollapsed}
          />
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const { user } = useAuth()
  const smartDefaults = useSmartDefaults()

  // Track if user has made any customizations
  const [hasCustomizedPins, setHasCustomizedPins] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEYS.pinned)
  })
  const [hasCustomizedGroups, setHasCustomizedGroups] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEYS.expanded)
  })

  // Expanded groups state - use smart defaults if not customized
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.expanded)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Pinned items state - use smart defaults if not customized
  const [pinnedItems, setPinnedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.pinned)
      return saved ? JSON.parse(saved) : DEFAULT_PINNED
    } catch {
      return DEFAULT_PINNED
    }
  })

  // Apply smart defaults when profile loads (only if user hasn't customized)
  useEffect(() => {
    if (!smartDefaults.loading && !hasCustomizedPins && smartDefaults.pinnedItems) {
      setPinnedItems(smartDefaults.pinnedItems)
    }
  }, [smartDefaults.loading, smartDefaults.pinnedItems, hasCustomizedPins])

  useEffect(() => {
    if (!smartDefaults.loading && !hasCustomizedGroups && smartDefaults.expandedGroups) {
      setExpandedGroups(smartDefaults.expandedGroups)
    }
  }, [smartDefaults.loading, smartDefaults.expandedGroups, hasCustomizedGroups])

  // Save expanded state (and mark as customized)
  useEffect(() => {
    if (hasCustomizedGroups) {
      localStorage.setItem(STORAGE_KEYS.expanded, JSON.stringify(expandedGroups))
    }
  }, [expandedGroups, hasCustomizedGroups])

  // Save pinned state (and mark as customized)
  useEffect(() => {
    if (hasCustomizedPins) {
      localStorage.setItem(STORAGE_KEYS.pinned, JSON.stringify(pinnedItems))
    }
  }, [pinnedItems, hasCustomizedPins])

  function toggleGroup(groupId) {
    setHasCustomizedGroups(true)
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? navigationGroups.find(g => g.id === groupId)?.defaultExpanded)
    }))
  }

  function togglePin(href) {
    setHasCustomizedPins(true)
    setPinnedItems(prev => {
      if (prev.includes(href)) {
        return prev.filter(h => h !== href)
      } else if (prev.length < 5) {
        return [...prev, href]
      }
      return prev // Max 5 pinned
    })
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full bg-cyber-dark border-r border-gray-800',
          'transform transition-all duration-300 ease-in-out flex flex-col',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'lg:w-16' : 'w-64'
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-gray-800 flex-shrink-0',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyber-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div>
                <div className="font-semibold text-white text-sm">Vigil</div>
                <div className="text-xs text-gray-500">Threat Intelligence</div>
              </div>
            )}
          </NavLink>
          {!isCollapsed && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded hover:bg-gray-800"
              aria-label="Close navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation - scrollable */}
        <nav className={clsx('flex-1 overflow-y-auto p-3', isCollapsed && 'px-2')} role="navigation" aria-label="Main menu">
          {/* Pinned items */}
          <PinnedSection
            pinnedItems={pinnedItems}
            isCollapsed={isCollapsed}
            onClose={onClose}
            onTogglePin={togglePin}
          />

          {/* Navigation groups */}
          {navigationGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onClose={onClose}
              pinnedItems={pinnedItems}
              onTogglePin={togglePin}
            />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="flex-shrink-0 border-t border-gray-800">
          {/* Collapse toggle button - desktop only */}
          <div className={clsx('hidden lg:block px-3 py-2', isCollapsed && 'px-2')}>
            <button
              onClick={onToggleCollapse}
              className={clsx(
                'w-full flex items-center gap-2 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors',
                isCollapsed ? 'justify-center px-2' : 'px-3'
              )}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
            >
              <span className={clsx('transition-transform', isCollapsed && 'rotate-180')}>
                {icons.collapse}
              </span>
              {!isCollapsed && <span>Collapse</span>}
            </button>
          </div>

          {/* Data Sources Status - compact */}
          {!isCollapsed && (
            <div className="px-4 pb-3 pt-2 border-t border-gray-800/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Data Sources</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full live-indicator" title="Ransomware"></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full live-indicator" title="CISA KEV"></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full live-indicator" title="Abuse.ch"></span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed: Just show green dot */}
          {isCollapsed && (
            <div className="p-3 flex justify-center">
              <span className="w-2 h-2 bg-green-500 rounded-full live-indicator" title="Data sources online"></span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
