/**
 * Session Management Module
 *
 * Handles token refresh, logout cleanup, and session security.
 */

import { getAuth, onIdTokenChanged, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { logger } from './logger'

// Storage keys
const SESSION_KEYS = {
  AUTH_TOKEN: 'vigil_auth_token',
  AUTH_USER: 'vigil_auth_user',
  SESSION_ID: 'vigil_session_id',
  PUSH_SUBSCRIPTION: 'vigil_push_subscription',
  LAST_ACTIVITY: 'vigil_last_activity',
}

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// Token refresh callback store
let tokenRefreshCallback = null

/**
 * Initialize session management with token refresh
 * @param {Function} onTokenRefresh - Callback when token is refreshed
 * @returns {Function} - Unsubscribe function
 */
export function initializeSessionManager(onTokenRefresh) {
  const auth = getAuth()
  if (!auth) {
    logger.warn('Firebase auth not available, session management disabled')
    return () => {}
  }

  tokenRefreshCallback = onTokenRefresh

  // Listen for token changes (includes automatic refresh)
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    if (user) {
      try {
        // Get fresh token
        const token = await user.getIdToken(/* forceRefresh */ false)

        // Store for API calls
        sessionStorage.setItem(SESSION_KEYS.AUTH_TOKEN, token)
        localStorage.setItem(
          SESSION_KEYS.AUTH_USER,
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          })
        )

        // Update last activity
        updateLastActivity()

        // Notify callback
        if (tokenRefreshCallback) {
          tokenRefreshCallback(token, user)
        }

        logger.debug('Auth token refreshed')
      } catch (error) {
        logger.error('Failed to refresh auth token:', error)
      }
    } else {
      // User signed out
      clearSession()
    }
  })

  // Set up activity tracking
  setupActivityTracking()

  return unsubscribe
}

/**
 * Get the current auth token
 * @param {boolean} forceRefresh - Force a fresh token
 * @returns {Promise<string|null>}
 */
export async function getAuthToken(forceRefresh = false) {
  const auth = getAuth()
  const user = auth?.currentUser

  if (!user) {
    return null
  }

  try {
    const token = await user.getIdToken(forceRefresh)
    sessionStorage.setItem(SESSION_KEYS.AUTH_TOKEN, token)
    return token
  } catch (error) {
    logger.error('Failed to get auth token:', error)
    return null
  }
}

/**
 * Get cached auth token (synchronous, may be stale)
 * @returns {string|null}
 */
export function getCachedAuthToken() {
  return sessionStorage.getItem(SESSION_KEYS.AUTH_TOKEN)
}

/**
 * Enhanced logout with full cleanup
 * @returns {Promise<void>}
 */
export async function logout() {
  const auth = getAuth()

  try {
    // Unsubscribe from push notifications if subscribed
    await unsubscribeFromPush()

    // Sign out from Firebase
    if (auth) {
      await auth.signOut()
    }
  } catch (error) {
    logger.error('Error during logout:', error)
  } finally {
    // Always clear session data
    clearSession()
  }
}

/**
 * Clear all session data
 */
export function clearSession() {
  // Clear session storage
  Object.values(SESSION_KEYS).forEach((key) => {
    sessionStorage.removeItem(key)
  })

  // Clear local storage auth data
  localStorage.removeItem(SESSION_KEYS.AUTH_USER)
  localStorage.removeItem(SESSION_KEYS.PUSH_SUBSCRIPTION)

  // Clear any other app-specific caches
  try {
    // Clear Supabase session if exists
    localStorage.removeItem('supabase.auth.token')
  } catch {
    // Ignore errors
  }

  logger.debug('Session cleared')
}

/**
 * Unsubscribe from push notifications
 * @returns {Promise<void>}
 */
async function unsubscribeFromPush() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        logger.debug('Unsubscribed from push notifications')
      }
    } catch (error) {
      logger.error('Failed to unsubscribe from push:', error)
    }
  }
}

/**
 * Re-authenticate user for sensitive operations
 * @param {string} password - User's current password
 * @returns {Promise<boolean>} - True if re-authentication succeeded
 */
export async function reauthenticate(password) {
  const auth = getAuth()
  const user = auth?.currentUser

  if (!user || !user.email) {
    return false
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)
    logger.debug('User re-authenticated successfully')
    return true
  } catch (error) {
    logger.error('Re-authentication failed:', error)
    return false
  }
}

/**
 * Check if user should be required to re-authenticate
 * @param {string} operation - The sensitive operation being performed
 * @returns {boolean}
 */
export function requiresReauthentication(operation) {
  const sensitiveOperations = [
    'delete_account',
    'change_email',
    'change_password',
    'regenerate_api_keys',
    'update_sso_config',
    'delete_all_data',
  ]

  return sensitiveOperations.includes(operation)
}

/**
 * Update last activity timestamp
 */
function updateLastActivity() {
  sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString())
}

/**
 * Check if session has timed out due to inactivity
 * @returns {boolean}
 */
export function isSessionTimedOut() {
  const lastActivity = sessionStorage.getItem(SESSION_KEYS.LAST_ACTIVITY)

  if (!lastActivity) {
    return false
  }

  const elapsed = Date.now() - parseInt(lastActivity, 10)
  return elapsed > SESSION_TIMEOUT_MS
}

/**
 * Set up activity tracking for session timeout
 */
function setupActivityTracking() {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart']

  const handleActivity = () => {
    updateLastActivity()
  }

  // Throttle activity updates (max once per minute)
  let lastUpdate = 0
  const throttledHandler = () => {
    const now = Date.now()
    if (now - lastUpdate > 60000) {
      lastUpdate = now
      handleActivity()
    }
  }

  events.forEach((event) => {
    document.addEventListener(event, throttledHandler, { passive: true })
  })
}

/**
 * Get current user info from session
 * @returns {Object|null}
 */
export function getSessionUser() {
  try {
    const stored = localStorage.getItem(SESSION_KEYS.AUTH_USER)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export default {
  initializeSessionManager,
  getAuthToken,
  getCachedAuthToken,
  logout,
  clearSession,
  reauthenticate,
  requiresReauthentication,
  isSessionTimedOut,
  getSessionUser,
}
