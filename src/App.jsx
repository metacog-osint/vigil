import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Pages
import Dashboard from './pages/Dashboard'
import ThreatActors from './pages/ThreatActors'
import Incidents from './pages/Incidents'
import Vulnerabilities from './pages/Vulnerabilities'
import IOCSearch from './pages/IOCSearch'

// Components
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const isOnline = useOnlineStatus()

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          isOnline={isOnline}
        />

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/actors" element={<ThreatActors />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/vulnerabilities" element={<Vulnerabilities />} />
            <Route path="/iocs" element={<IOCSearch />} />
          </Routes>
        </main>

        {/* Offline indicator */}
        {!isOnline && (
          <div className="fixed bottom-4 right-4 bg-yellow-900/90 text-yellow-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            Offline - Using cached data
          </div>
        )}
      </div>
    </div>
  )
}

export default App
