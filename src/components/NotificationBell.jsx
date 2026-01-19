import { useState, useEffect, useRef } from 'react'
import { notifications, alerts, vulnerabilities, threatActors } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

const NOTIFICATION_ICONS = {
  kev_added: '🛡️',
  actor_escalating: '⚠️',
  watchlist_update: '👁️',
  vendor_alert: '🔔',
  sector_incident: '🎯',
  system: 'ℹ️',
  digest_ready: '📊',
  // Legacy types from fallback
  alert: '🔔',
  kev: '🛡️',
  actor: '⚠️',
}

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/20 border-red-500/50',
  high: 'text-orange-400 bg-orange-500/20 border-orange-500/50',
  medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
  low: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
  info: 'text-gray-400 bg-gray-500/20 border-gray-500/50',
}

export default function NotificationBell({ userId = 'anonymous' }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [notificationList, setNotificationList] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [usesFallback, setUsesFallback] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (showDropdown && notificationList.length === 0) {
      loadNotifications()
    }
  }, [showDropdown])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (usesFallback) return // Don't subscribe if using fallback

    const unsubscribe = notifications.subscribeToUser(userId, (payload) => {
      if (payload.new) {
        setNotificationList(prev => [payload.new, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)
      }
    })

    return () => unsubscribe()
  }, [userId, usesFallback])

  // Load initial unread count
  useEffect(() => {
    loadUnreadCount()
  }, [userId])

  async function loadUnreadCount() {
    try {
      const { count } = await notifications.getUnreadCount(userId)
      setUnreadCount(count)
    } catch (error) {
      // Table might not exist yet - use fallback
      setUsesFallback(true)
    }
  }

  async function loadNotifications() {
    setLoading(true)
    try {
      // Try to load from notifications table first
      const { data, error } = await notifications.getForUser(userId, { limit: 15 })

      if (error) {
        console.warn('Notifications table error, using fallback:', error.message)
        await loadFallbackNotifications()
        return
      }

      if (data && data.length > 0) {
        setNotificationList(data.map(n => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          description: n.message,
          date: n.created_at,
          severity: n.severity,
          link: n.link,
          read: !!n.read_at,
          icon: NOTIFICATION_ICONS[n.notification_type] || 'ℹ️',
        })))
        setUsesFallback(false)
      } else {
        // No notifications in table - use fallback
        await loadFallbackNotifications()
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
      await loadFallbackNotifications()
    } finally {
      setLoading(false)
    }
  }

  // Fallback: generate notifications from recent alerts/KEVs/actors
  async function loadFallbackNotifications() {
    setUsesFallback(true)
    const notifs = []

    try {
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
            severity: 'high',
            icon: '🔔',
            link: '/alerts',
            read: false,
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
            severity: vuln.cvss_score >= 9 ? 'critical' : vuln.cvss_score >= 7 ? 'high' : 'medium',
            icon: '🛡️',
            link: '/vulnerabilities',
            read: false,
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
            severity: 'high',
            icon: '⚠️',
            link: '/actors',
            read: false,
          })
        })
      }

      // Sort by date
      notifs.sort((a, b) => new Date(b.date) - new Date(a.date))
      setNotificationList(notifs.slice(0, 10))

      // Set unread count based on items from last 24h
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentCount = notifs.filter(n => new Date(n.date) > dayAgo).length
      setUnreadCount(recentCount)
    } catch (error) {
      console.error('Error loading fallback notifications:', error)
    }
  }

  async function handleMarkAsRead(notificationId) {
    if (usesFallback) return // Can't mark as read in fallback mode

    await notifications.markAsRead(notificationId)
    setNotificationList(prev => prev.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function handleMarkAllAsRead() {
    if (usesFallback) return

    await notifications.markAllAsRead(userId)
    setNotificationList(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  function handleNotificationClick(notification) {
    if (!notification.read && !usesFallback) {
      handleMarkAsRead(notification.id)
    }
    setShowDropdown(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  function isRecent(date) {
    return new Date(date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-cyber-dark border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs text-cyan-400">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && !usesFallback && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-cyan-400 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
              </div>
            ) : notificationList.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  You'll see alerts, KEVs, and actor updates here
                </p>
              </div>
            ) : (
              notificationList.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 ${
                    !notification.read ? 'bg-gray-800/30' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {notification.icon}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </span>
                        {!notification.read && isRecent(notification.date) && (
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                            NEW
                          </span>
                        )}
                      </div>

                      {notification.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {notification.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {notification.severity && notification.severity !== 'info' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[notification.severity]}`}>
                            {notification.severity.toUpperCase()}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600">
                          {notification.date ? formatDistanceToNow(new Date(notification.date), { addSuffix: true }) : ''}
                        </span>
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-cyan-400 rounded-full mt-2"></div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/30">
            <button
              onClick={() => {
                setShowDropdown(false)
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
  )
}
