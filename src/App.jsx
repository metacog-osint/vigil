import { Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'

// Core pages - loaded immediately
import Dashboard from './pages/Dashboard'

// Lazy loaded pages - code split for smaller initial bundle
const Events = lazy(() => import('./pages/Events'))
const ThreatActors = lazy(() => import('./pages/ThreatActors'))
const Incidents = lazy(() => import('./pages/Incidents'))
const Vulnerabilities = lazy(() => import('./pages/Vulnerabilities'))
const IOCSearch = lazy(() => import('./pages/IOCSearch'))
const BulkSearch = lazy(() => import('./pages/BulkSearch'))
const Techniques = lazy(() => import('./pages/Techniques'))
const Watchlists = lazy(() => import('./pages/Watchlists'))
const Settings = lazy(() => import('./pages/Settings'))
const Alerts = lazy(() => import('./pages/Alerts'))
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'))
const TrendAnalysis = lazy(() => import('./pages/TrendAnalysis'))

// Components
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'
import SearchModal from './components/SearchModal'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { SkeletonDashboard } from './components/Skeleton'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// Loading fallback for lazy routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    </div>
  )
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const isOnline = useOnlineStatus()
  const location = useLocation()

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((prev) => !prev),
    onOpenSearch: () => setSearchOpen(true),
    onShowHelp: () => setHelpOpen(true),
  })

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cyber-darker flex items-center justify-center">
        <div className="text-cyber-accent animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cyber-darker flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          user={user}
          isOnline={isOnline}
        />

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<Events />} />
                <Route path="/actors" element={<ThreatActors />} />
                <Route path="/ransomware" element={<Incidents />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/vulnerabilities" element={<Vulnerabilities />} />
                <Route path="/iocs" element={<IOCSearch />} />
                <Route path="/bulk-search" element={<BulkSearch />} />
                <Route path="/advanced-search" element={<AdvancedSearch />} />
                <Route path="/techniques" element={<Techniques />} />
                <Route path="/watchlists" element={<Watchlists />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/trends" element={<TrendAnalysis />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Offline indicator */}
        {!isOnline && (
          <div className="fixed bottom-4 right-4 bg-yellow-900/90 text-yellow-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            Offline - Using cached data
          </div>
        )}
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export default App
