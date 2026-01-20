/**
 * Session Management
 *
 * Handles idle timeout and absolute session expiration.
 * For a security-focused platform, we use:
 * - 30 minute idle timeout
 * - 8 hour absolute session timeout
 */

import { supabase } from './supabase/client'

// Session configuration
export const SESSION_CONFIG = {
  // Idle timeout in milliseconds (30 minutes)
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,

  // Absolute session timeout in milliseconds (8 hours)
  ABSOLUTE_TIMEOUT_MS: 8 * 60 * 60 * 1000,

  // Warning before timeout (5 minutes before idle timeout)
  WARNING_BEFORE_MS: 5 * 60 * 1000,

  // Activity events to track
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'],

  // Throttle activity updates (don't fire on every event)
  ACTIVITY_THROTTLE_MS: 60 * 1000, // Update at most once per minute
}

// Session state
let lastActivityTime = Date.now()
let sessionStartTime = Date.now()
let idleTimeoutId = null
let warningTimeoutId = null
let absoluteTimeoutId = null
let activityThrottleTimeout = null
let onTimeoutCallback = null
let onWarningCallback = null
let isInitialized = false

/**
 * Initialize session management
 * @param {Object} options
 * @param {Function} options.onTimeout - Called when session times out
 * @param {Function} options.onWarning - Called before timeout (optional)
 */
export function initSessionManager({ onTimeout, onWarning }) {
  if (isInitialized) {
    console.warn('Session manager already initialized')
    return
  }

  onTimeoutCallback = onTimeout
  onWarningCallback = onWarning

  // Reset timers
  resetTimers()

  // Add activity listeners
  SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, handleActivity, { passive: true })
  })

  // Listen for visibility changes (tab focus)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Listen for storage events (cross-tab synchronization)
  window.addEventListener('storage', handleStorageEvent)

  // Store session start time
  sessionStartTime = Date.now()
  localStorage.setItem('vigil_session_start', sessionStartTime.toString())
  localStorage.setItem('vigil_last_activity', lastActivityTime.toString())

  isInitialized = true
}

/**
 * Clean up session manager
 */
export function destroySessionManager() {
  // Clear timeouts
  clearTimeout(idleTimeoutId)
  clearTimeout(warningTimeoutId)
  clearTimeout(absoluteTimeoutId)
  clearTimeout(activityThrottleTimeout)

  // Remove listeners
  SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
    window.removeEventListener(event, handleActivity)
  })
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('storage', handleStorageEvent)

  // Clear storage
  localStorage.removeItem('vigil_session_start')
  localStorage.removeItem('vigil_last_activity')

  isInitialized = false
}

/**
 * Handle user activity
 */
function handleActivity() {
  // Throttle activity updates
  if (activityThrottleTimeout) return

  activityThrottleTimeout = setTimeout(() => {
    activityThrottleTimeout = null
  }, SESSION_CONFIG.ACTIVITY_THROTTLE_MS)

  lastActivityTime = Date.now()
  localStorage.setItem('vigil_last_activity', lastActivityTime.toString())

  // Reset idle timeout
  resetIdleTimeout()
}

/**
 * Handle visibility change (tab focus/blur)
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Check if session expired while tab was hidden
    const now = Date.now()
    const storedLastActivity = parseInt(localStorage.getItem('vigil_last_activity') || '0', 10)
    const storedSessionStart = parseInt(localStorage.getItem('vigil_session_start') || '0', 10)

    // Check idle timeout
    if (now - storedLastActivity > SESSION_CONFIG.IDLE_TIMEOUT_MS) {
      triggerTimeout('idle')
      return
    }

    // Check absolute timeout
    if (now - storedSessionStart > SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS) {
      triggerTimeout('absolute')
      return
    }

    // Update activity and reset timers
    handleActivity()
  }
}

/**
 * Handle storage events (cross-tab sync)
 */
function handleStorageEvent(event) {
  if (event.key === 'vigil_logout') {
    // Another tab triggered logout
    triggerTimeout('cross_tab')
  } else if (event.key === 'vigil_last_activity') {
    // Another tab had activity, sync our state
    lastActivityTime = parseInt(event.newValue || '0', 10)
    resetIdleTimeout()
  }
}

/**
 * Reset all timers
 */
function resetTimers() {
  resetIdleTimeout()
  resetAbsoluteTimeout()
}

/**
 * Reset idle timeout
 */
function resetIdleTimeout() {
  clearTimeout(idleTimeoutId)
  clearTimeout(warningTimeoutId)

  // Set warning timeout
  if (onWarningCallback) {
    warningTimeoutId = setTimeout(() => {
      const remaining = Math.round(SESSION_CONFIG.WARNING_BEFORE_MS / 1000 / 60)
      onWarningCallback({ minutes: remaining, type: 'idle' })
    }, SESSION_CONFIG.IDLE_TIMEOUT_MS - SESSION_CONFIG.WARNING_BEFORE_MS)
  }

  // Set idle timeout
  idleTimeoutId = setTimeout(() => {
    triggerTimeout('idle')
  }, SESSION_CONFIG.IDLE_TIMEOUT_MS)
}

/**
 * Reset absolute session timeout
 */
function resetAbsoluteTimeout() {
  clearTimeout(absoluteTimeoutId)

  absoluteTimeoutId = setTimeout(() => {
    triggerTimeout('absolute')
  }, SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS)
}

/**
 * Trigger session timeout
 */
async function triggerTimeout(reason) {
  // Notify other tabs
  localStorage.setItem('vigil_logout', Date.now().toString())
  localStorage.removeItem('vigil_logout')

  // Sign out from Supabase
  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.error('Error signing out:', error)
  }

  // Clean up
  destroySessionManager()

  // Notify callback
  if (onTimeoutCallback) {
    onTimeoutCallback({ reason })
  }
}

/**
 * Get remaining session time
 */
export function getSessionTimeRemaining() {
  const now = Date.now()
  const idleRemaining = Math.max(0, SESSION_CONFIG.IDLE_TIMEOUT_MS - (now - lastActivityTime))
  const absoluteRemaining = Math.max(
    0,
    SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS - (now - sessionStartTime)
  )

  return {
    idle: idleRemaining,
    absolute: absoluteRemaining,
    idleMinutes: Math.round(idleRemaining / 1000 / 60),
    absoluteMinutes: Math.round(absoluteRemaining / 1000 / 60),
  }
}

/**
 * Extend session (resets idle timeout)
 * Call this when user explicitly wants to stay logged in
 */
export function extendSession() {
  handleActivity()
}

/**
 * Force logout
 */
export async function forceLogout() {
  await triggerTimeout('manual')
}
