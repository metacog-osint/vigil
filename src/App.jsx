import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'

// Core pages - loaded immediately
import Dashboard from './pages/Dashboard'

// Public pages (for unauthenticated users)
const Landing = lazy(() => import('./pages/Landing'))
const Auth = lazy(() => import('./pages/Auth'))

// Lazy loaded pages - code split for smaller initial bundle
const Activity = lazy(() => import('./pages/Activity'))
const ThreatActors = lazy(() => import('./pages/ThreatActors'))
const Vulnerabilities = lazy(() => import('./pages/Vulnerabilities'))
const Advisories = lazy(() => import('./pages/Advisories'))
const IOCs = lazy(() => import('./pages/IOCs'))
const Techniques = lazy(() => import('./pages/Techniques'))
const Watchlists = lazy(() => import('./pages/Watchlists'))
const SettingsLayout = lazy(() => import('./pages/SettingsLayout'))
const Alerts = lazy(() => import('./pages/Alerts'))
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'))
const TrendAnalysis = lazy(() => import('./pages/TrendAnalysis'))
const ThreatHunts = lazy(() => import('./pages/ThreatHunts'))
const Pricing = lazy(() => import('./pages/Pricing'))
const ApiDocs = lazy(() => import('./pages/ApiDocs'))
const Reports = lazy(() => import('./pages/Reports'))
const Investigations = lazy(() => import('./pages/Investigations'))
const Assets = lazy(() => import('./pages/Assets'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Status = lazy(() => import('./pages/Status'))
const Webhooks = lazy(() => import('./pages/Webhooks'))
const Help = lazy(() => import('./pages/Help'))
const Vendors = lazy(() => import('./pages/Vendors'))
const Benchmarks = lazy(() => import('./pages/Benchmarks'))
const ChatIntegrations = lazy(() => import('./pages/ChatIntegrations'))
const Compare = lazy(() => import('./pages/Compare'))
const Patterns = lazy(() => import('./pages/Patterns'))
const AttackChains = lazy(() => import('./pages/AttackChains'))
const GeographicAnalysis = lazy(() => import('./pages/GeographicAnalysis'))
const OpsDashboard = lazy(() => import('./pages/admin/OpsDashboard'))
const ApiPlayground = lazy(() => import('./components/upgrade/ApiPlayground'))

// Components
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { ErrorBoundary } from './components'
import SearchModal from './components/SearchModal'
import { KeyboardShortcutsModal, SkeletonDashboard, OnboardingTour } from './components'
import PersonalizationWizard, { usePersonalizationWizard } from './components/PersonalizationWizard'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePageTracking } from './hooks/useAnalytics'

// Contexts
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { TenantProvider } from './contexts/TenantContext'
import { ToastProvider } from './contexts/ToastContext'
import { FocusModeProvider } from './hooks/useFocusMode'

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

// Full-page loader for auth checking
function AuthLoader() {
  return (
    <div className="min-h-screen bg-cyber-darker flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-cyber-accent animate-pulse">Loading Vigil...</div>
      </div>
    </div>
  )
}

// Public routes wrapper (no sidebar/header)
function PublicLayout() {
  return (
    <ErrorBoundary name="PublicLayout" title="Application Error">
      <Suspense fallback={<AuthLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Redirect any other route to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

// Protected app with sidebar/header
function ProtectedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showPersonalization, setShowPersonalization] = useState(false)
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const location = useLocation()

  // Track page views
  usePageTracking()
  const { shouldShow: shouldShowPersonalization, loading: personalizationLoading, dismiss: dismissPersonalization } = usePersonalizationWizard()

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

  return (
    <TenantProvider>
    <SubscriptionProvider>
    <ToastProvider>
    <FocusModeProvider>
    <div className="min-h-screen bg-cyber-darker flex">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cyber-accent focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

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

        <main id="main-content" role="main" className="flex-1 p-4 lg:p-6 overflow-auto" tabIndex={-1}>
          <ErrorBoundary name="PageContent" title="Page Error">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<Activity />} />
                <Route path="/actors" element={<ThreatActors />} />
                <Route path="/ransomware" element={<Navigate to="/events?view=ransomware" replace />} />
                <Route path="/incidents" element={<Navigate to="/events?view=ransomware" replace />} />
                <Route path="/vulnerabilities" element={<Vulnerabilities />} />
                <Route path="/advisories" element={<Advisories />} />
                <Route path="/iocs" element={<IOCs />} />
                <Route path="/bulk-search" element={<Navigate to="/iocs?tab=bulk" replace />} />
                <Route path="/custom-iocs" element={<Navigate to="/iocs?tab=custom" replace />} />
                <Route path="/advanced-search" element={<AdvancedSearch />} />
                <Route path="/techniques" element={<Techniques />} />
                <Route path="/watchlists" element={<Watchlists />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/trends" element={<TrendAnalysis />} />
                <Route path="/threat-hunts" element={<ThreatHunts />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/api-playground" element={<ApiPlayground />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/investigations" element={<Investigations />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/status" element={<Status />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/benchmarks" element={<Benchmarks />} />
                <Route path="/chat" element={<ChatIntegrations />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/help" element={<Help />} />
                <Route path="/settings" element={<SettingsLayout />} />
                <Route path="/ops" element={<OpsDashboard />} />
                <Route path="/patterns" element={<Patterns />} />
                <Route path="/attack-chains" element={<AttackChains />} />
                <Route path="/geographic-analysis" element={<GeographicAnalysis />} />
                {/* Redirect auth pages to dashboard if already logged in */}
                <Route path="/auth" element={<Navigate to="/" replace />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
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

      {/* Personalization Wizard - shows for first-time users, takes priority over tour */}
      {(shouldShowPersonalization || showPersonalization) && (
        <PersonalizationWizard
          onComplete={() => {
            setShowPersonalization(false)
            dismissPersonalization()
          }}
          onSkip={() => {
            setShowPersonalization(false)
            dismissPersonalization()
          }}
        />
      )}

      {/* Onboarding Tour - only shows after personalization check completes and wizard is not needed */}
      {!personalizationLoading && !shouldShowPersonalization && !showPersonalization && (
        <OnboardingTour />
      )}
    </div>
    </FocusModeProvider>
    </ToastProvider>
    </SubscriptionProvider>
    </TenantProvider>
  )
}

function App() {
  const { user, loading: authLoading } = useAuth()

  // Show loading state while checking auth
  if (authLoading) {
    return <AuthLoader />
  }

  // Auth gate: show public layout if not authenticated
  if (!user) {
    return <PublicLayout />
  }

  // Show protected app for authenticated users
  return (
    <ErrorBoundary name="AppRoot" title="Application Error">
      <ProtectedApp />
    </ErrorBoundary>
  )
}

export default App
