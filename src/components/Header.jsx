import { useState, useEffect, useRef } from 'react'
import { signOut, signInWithGoogle } from '../lib/firebase'
import { alerts, vulnerabilities, threatActors } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

export default function Header({ onMenuClick, onSearchClick, user, isOnline }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const notificationRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (showNotifications && notifications.length === 0) {
      loadNotifications()
    }
  }, [showNotifications])

  async function loadNotifications() {
    setLoading(true)
    try {
      const notifs = []

      // Get recent CISA alerts
      const { data: alertData } = await alerts.getRecent({ limit: 3 })
      if (alertData) {
        alertData.forEach(alert => {
          notifs.push({
            id: `alert-${alert.id}`,
            type: 'alert',
            title: alert.title || 'New CISA Alert',
            description: alert.summary?.substring(0, 80) + '...',
            date: alert.published_date,
            icon: '🔔',
            link: '/alerts'
          })
        })
      }

      // Get recent KEVs
      const { data: kevData } = await vulnerabilities.getRecent({ limit: 3, kevOnly: true })
      if (kevData) {
        kevData.forEach(vuln => {
          notifs.push({
            id: `kev-${vuln.cve_id}`,
            type: 'kev',
            title: `New KEV: ${vuln.cve_id}`,
            description: vuln.description?.substring(0, 80) + '...',
            date: vuln.kev_date,
            icon: '🛡️',
            link: '/vulnerabilities'
          })
        })
      }

      // Get escalating actors
      const { data: actorData } = await threatActors.getAll({ trendStatus: 'ESCALATING', limit: 3 })
      if (actorData) {
        actorData.forEach(actor => {
          notifs.push({
            id: `actor-${actor.id}`,
            type: 'actor',
            title: `${actor.name} Escalating`,
            description: `${actor.incidents_7d || 0} incidents in the last 7 days`,
            date: actor.last_seen,
            icon: '⚠️',
            link: '/actors'
          })
        })
      }

      // Sort by date
      notifs.sort((a, b) => new Date(b.date) - new Date(a.date))
      setNotifications(notifs.slice(0, 8))
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setShowUserMenu(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  const handleNotificationClick = (notification) => {
    setShowNotifications(false)
    navigate(notification.link)
  }

  const unreadCount = notifications.filter(n => {
    const date = new Date(n.date)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return date > dayAgo
  }).length

  return (
    <header className="h-16 bg-cyber-dark border-b border-gray-800 flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 live-indicator' : 'bg-yellow-500'}`}></span>
          <span className="text-gray-400">{isOnline ? 'Live' : 'Offline'}</span>
        </div>

        {/* Last updated */}
        <div className="hidden sm:block text-xs text-gray-500">
          Last sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Quick search button */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search...</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Notifications"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Notification badge */}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-cyber-dark border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-cyan-400">{unreadCount} new</span>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Loading...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const isRecent = new Date(notification.date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 ${
                          isRecent ? 'bg-gray-800/30' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <span className="text-lg flex-shrink-0">{notification.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">
                                {notification.title}
                              </span>
                              {isRecent && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {notification.description}
                            </p>
                            <span className="text-[10px] text-gray-600 mt-1 block">
                              {notification.date ? formatDistanceToNow(new Date(notification.date), { addSuffix: true }) : ''}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              <div className="px-4 py-2 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowNotifications(false)
                    navigate('/alerts')
                  }}
                  className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 py-1"
                >
                  View all alerts →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          {user ? (
            <>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-800"
              >
                <div className="w-8 h-8 bg-cyber-accent/20 rounded-full flex items-center justify-center">
                  <span className="text-cyber-accent text-sm font-medium">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </span>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-cyber-dark border border-gray-800 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-800">
                    <div className="text-sm text-white truncate">{user.email}</div>
                    <div className="text-xs text-gray-500">Analyst</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="cyber-button-primary text-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
