import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: 'Threat Actors',
    href: '/actors',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: 'Incidents',
    href: '/incidents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    name: 'Vulnerabilities',
    href: '/vulnerabilities',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: 'IOC Search',
    href: '/iocs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    name: 'Bulk Search',
    href: '/bulk-search',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
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
          'transform transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'lg:w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-gray-800',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyber-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div>
                <div className="font-semibold text-white text-sm">Vigil</div>
                <div className="text-xs text-gray-500">theintelligence.company</div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={clsx('p-4 space-y-1', isCollapsed && 'px-2')}>
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onClose}
              title={isCollapsed ? item.name : undefined}
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
              {!isCollapsed && item.name}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle button - desktop only */}
        <div className="hidden lg:block absolute bottom-20 left-0 right-0 px-4">
          <button
            onClick={onToggleCollapse}
            className={clsx(
              'w-full flex items-center gap-2 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors',
              isCollapsed ? 'justify-center px-2' : 'px-3'
            )}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={clsx('w-5 h-5 transition-transform', isCollapsed && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Data Sources Status */}
        <div className={clsx(
          'absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800',
          isCollapsed && 'hidden'
        )}>
          <div className="text-xs text-gray-500 mb-2">Data Sources</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Ransomwatch</span>
              <span className="w-2 h-2 bg-green-500 rounded-full live-indicator"></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">CISA KEV</span>
              <span className="w-2 h-2 bg-green-500 rounded-full live-indicator"></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Abuse.ch</span>
              <span className="w-2 h-2 bg-green-500 rounded-full live-indicator"></span>
            </div>
          </div>
        </div>

        {/* Collapsed: Just show green dot */}
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 flex justify-center">
            <span className="w-2 h-2 bg-green-500 rounded-full live-indicator" title="Data sources online"></span>
          </div>
        )}
      </aside>
    </>
  )
}
