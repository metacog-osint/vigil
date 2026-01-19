/**
 * OAuth Security Module
 *
 * Provides secure state generation and validation for OAuth flows
 * to prevent CSRF and open redirect attacks.
 */

const OAUTH_STATE_KEY = 'vigil_oauth_state'
const OAUTH_STATE_EXPIRY_KEY = 'vigil_oauth_state_expiry'
const STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Allowed redirect paths after OAuth callback
 * Prevents open redirect attacks
 */
const ALLOWED_REDIRECT_PATHS = [
  '/settings',
  '/integrations',
  '/chat-integrations',
  '/dashboard',
]

/**
 * Generate a cryptographically secure OAuth state parameter
 *
 * @param {Object} metadata - Additional metadata to include in state
 * @returns {string} Secure state string
 */
export function generateOAuthState(metadata = {}) {
  // Generate 32 random bytes for the state token
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const stateToken = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')

  // Create state object with token and metadata
  const stateData = {
    token: stateToken,
    timestamp: Date.now(),
    ...metadata,
  }

  // Encode the state
  const encodedState = btoa(JSON.stringify(stateData))

  // Store state and expiry in sessionStorage
  sessionStorage.setItem(OAUTH_STATE_KEY, stateToken)
  sessionStorage.setItem(OAUTH_STATE_EXPIRY_KEY, String(Date.now() + STATE_EXPIRY_MS))

  return encodedState
}

/**
 * Validate OAuth state parameter from callback
 *
 * @param {string} returnedState - State parameter from OAuth callback
 * @returns {{ valid: boolean, metadata?: Object, error?: string }}
 */
export function validateOAuthState(returnedState) {
  try {
    if (!returnedState) {
      return { valid: false, error: 'Missing state parameter' }
    }

    // Decode the returned state
    let stateData
    try {
      stateData = JSON.parse(atob(returnedState))
    } catch {
      return { valid: false, error: 'Invalid state format' }
    }

    // Get stored state
    const storedToken = sessionStorage.getItem(OAUTH_STATE_KEY)
    const storedExpiry = sessionStorage.getItem(OAUTH_STATE_EXPIRY_KEY)

    // Clear stored state immediately (one-time use)
    sessionStorage.removeItem(OAUTH_STATE_KEY)
    sessionStorage.removeItem(OAUTH_STATE_EXPIRY_KEY)

    // Check if state exists
    if (!storedToken) {
      return { valid: false, error: 'No pending OAuth state found' }
    }

    // Check if state has expired
    if (storedExpiry && Date.now() > parseInt(storedExpiry, 10)) {
      return { valid: false, error: 'OAuth state has expired' }
    }

    // Validate token matches (constant-time comparison not needed here as attacker can't observe timing)
    if (stateData.token !== storedToken) {
      return { valid: false, error: 'Invalid OAuth state - possible CSRF attack' }
    }

    // Extract metadata (everything except token and timestamp)
    const { token, timestamp, ...metadata } = stateData

    return { valid: true, metadata }
  } catch (err) {
    console.error('OAuth state validation error:', err)
    return { valid: false, error: 'State validation failed' }
  }
}

/**
 * Validate redirect URL to prevent open redirect attacks
 *
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is safe to redirect to
 */
export function validateRedirectUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin)

    // Must be same origin
    if (parsed.origin !== window.location.origin) {
      console.warn('Rejected redirect to different origin:', parsed.origin)
      return false
    }

    // Must be an allowed path
    const isAllowed = ALLOWED_REDIRECT_PATHS.some(
      (path) => parsed.pathname === path || parsed.pathname.startsWith(path + '/')
    )

    if (!isAllowed) {
      console.warn('Rejected redirect to non-allowed path:', parsed.pathname)
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Get safe redirect URL, falling back to default if invalid
 *
 * @param {string} url - Requested redirect URL
 * @param {string} defaultPath - Default path if URL is invalid
 * @returns {string} Safe redirect URL
 */
export function getSafeRedirectUrl(url, defaultPath = '/dashboard') {
  if (url && validateRedirectUrl(url)) {
    return url
  }
  return defaultPath
}

/**
 * Clear any pending OAuth state
 * Call this when user cancels OAuth flow
 */
export function clearOAuthState() {
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_EXPIRY_KEY)
}

export default {
  generateOAuthState,
  validateOAuthState,
  validateRedirectUrl,
  getSafeRedirectUrl,
  clearOAuthState,
}
