/**
 * Sentry Error Tracking
 *
 * Provides centralized error tracking and performance monitoring.
 * Sentry captures errors, exceptions, and performance data across
 * the entire application.
 *
 * Configuration:
 * - Set VITE_SENTRY_DSN environment variable with your Sentry DSN
 * - Errors are only sent in production by default
 * - Source maps are uploaded during build for readable stack traces
 */

// Sentry initialization status
let isInitialized = false

/**
 * Initialize Sentry SDK
 * Call this once at app startup
 */
export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  // Skip initialization if no DSN or in development
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.log('[Sentry] No DSN configured, skipping initialization')
    }
    return false
  }

  try {
    // Dynamic import to reduce initial bundle size
    const Sentry = await import('@sentry/react')

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: `vigil@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,

      // Only send errors in production
      enabled: import.meta.env.PROD,

      // Sample rate for performance monitoring (10%)
      tracesSampleRate: 0.1,

      // Sample rate for session replays (1%)
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 1.0,

      // Ignore common non-actionable errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'http://tt.telemarket.ru/',
        'jigsaw is not defined',
        'ComboSearch is not defined',
        'atomicFindClose',

        // Network errors that aren't actionable
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'Load failed',
        'ChunkLoadError',

        // User-caused aborts
        'AbortError',

        // Benign browser errors
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',

        // Safari-specific
        'Unexpected end of script',
      ],

      // Filter out events from browser extensions
      beforeSend(event) {
        // Ignore errors from browser extensions
        if (event.exception?.values?.[0]?.stacktrace?.frames) {
          const frames = event.exception.values[0].stacktrace.frames
          const isExtension = frames.some(
            (frame) =>
              frame.filename?.includes('chrome-extension://') ||
              frame.filename?.includes('moz-extension://') ||
              frame.filename?.includes('safari-extension://')
          )
          if (isExtension) {
            return null
          }
        }

        return event
      },

      // Add user context when available
      initialScope: {
        tags: {
          component: 'vigil-web',
        },
      },
    })

    isInitialized = true
    console.log('[Sentry] Initialized successfully')
    return true
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error)
    return false
  }
}

/**
 * Set user context for Sentry
 * Call after user authentication
 */
export async function setSentryUser(user) {
  if (!isInitialized) return

  try {
    const Sentry = await import('@sentry/react')
    if (user) {
      Sentry.setUser({
        id: user.uid || user.id,
        email: user.email,
      })
    } else {
      Sentry.setUser(null)
    }
  } catch (error) {
    console.error('[Sentry] Failed to set user:', error)
  }
}

/**
 * Capture an exception manually
 */
export async function captureException(error, context = {}) {
  if (!isInitialized) {
    console.error('[Sentry] Not initialized, logging locally:', error)
    return
  }

  try {
    const Sentry = await import('@sentry/react')
    Sentry.captureException(error, {
      extra: context,
    })
  } catch (e) {
    console.error('[Sentry] Failed to capture exception:', e)
  }
}

/**
 * Capture a message/event manually
 */
export async function captureMessage(message, level = 'info', context = {}) {
  if (!isInitialized) {
    console.log(`[Sentry] Not initialized, logging locally [${level}]:`, message)
    return
  }

  try {
    const Sentry = await import('@sentry/react')
    Sentry.captureMessage(message, {
      level,
      extra: context,
    })
  } catch (e) {
    console.error('[Sentry] Failed to capture message:', e)
  }
}

/**
 * Add breadcrumb for debugging
 */
export async function addBreadcrumb(breadcrumb) {
  if (!isInitialized) return

  try {
    const Sentry = await import('@sentry/react')
    Sentry.addBreadcrumb(breadcrumb)
  } catch (e) {
    console.error('[Sentry] Failed to add breadcrumb:', e)
  }
}

/**
 * Set custom tags for filtering
 */
export async function setTag(key, value) {
  if (!isInitialized) return

  try {
    const Sentry = await import('@sentry/react')
    Sentry.setTag(key, value)
  } catch (e) {
    console.error('[Sentry] Failed to set tag:', e)
  }
}

/**
 * Create a Sentry-wrapped error boundary component
 * Usage: <SentryErrorBoundary fallback={...}>{children}</SentryErrorBoundary>
 */
export async function getSentryErrorBoundary() {
  if (!isInitialized) {
    return null
  }

  try {
    const Sentry = await import('@sentry/react')
    return Sentry.ErrorBoundary
  } catch (e) {
    console.error('[Sentry] Failed to get ErrorBoundary:', e)
    return null
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryEnabled() {
  return isInitialized
}
