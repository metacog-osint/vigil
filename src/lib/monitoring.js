/**
 * Monitoring & Observability Module
 * Error tracking, performance monitoring, and analytics
 */

// Sentry integration (lazy loaded)
let Sentry = null

/**
 * Initialize Sentry for error tracking
 */
export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.log('Sentry DSN not configured, skipping initialization')
    return
  }

  try {
    Sentry = await import('@sentry/react')

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: `vigil@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

      // Performance monitoring
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

      // Session replay for debugging
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Filter out noisy errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        /Loading chunk \d+ failed/,
      ],

      // Sanitize sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['Authorization']
          delete event.request.headers['Cookie']
        }
        return event
      },

      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
    })

    console.log('Sentry initialized')
  } catch (err) {
    console.error('Failed to initialize Sentry:', err)
  }
}

/**
 * Capture an error with context
 */
export function captureError(error, context = {}) {
  console.error('Error:', error, context)

  if (Sentry) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(error)
    })
  }
}

/**
 * Capture a message/event
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (Sentry) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureMessage(message, level)
    })
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user) {
  if (Sentry && user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    })
  } else if (Sentry) {
    Sentry.setUser(null)
  }
}

/**
 * Performance monitoring utilities
 */
export const performance = {
  /**
   * Start a performance measurement
   */
  start(name) {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`${name}-start`)
    }
    return Date.now()
  },

  /**
   * End a performance measurement and log it
   */
  end(name, startTime) {
    const duration = Date.now() - startTime

    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`${name}-end`)
      try {
        window.performance.measure(name, `${name}-start`, `${name}-end`)
      } catch (e) {
        // Ignore if marks don't exist
      }
    }

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation: ${name} took ${duration}ms`)
      captureMessage(`Slow operation: ${name}`, 'warning', { duration })
    }

    return duration
  },

  /**
   * Measure a function's execution time
   */
  async measure(name, fn) {
    const start = this.start(name)
    try {
      return await fn()
    } finally {
      this.end(name, start)
    }
  },

  /**
   * Get Web Vitals metrics
   */
  async getWebVitals() {
    if (typeof window === 'undefined') return null

    try {
      const { onCLS, onFID, onFCP, onLCP, onTTFB } = await import('web-vitals')

      const vitals = {}

      onCLS((metric) => {
        vitals.CLS = metric.value
      })
      onFID((metric) => {
        vitals.FID = metric.value
      })
      onFCP((metric) => {
        vitals.FCP = metric.value
      })
      onLCP((metric) => {
        vitals.LCP = metric.value
      })
      onTTFB((metric) => {
        vitals.TTFB = metric.value
      })

      return vitals
    } catch (e) {
      return null
    }
  },
}

/**
 * Analytics tracking (privacy-respecting)
 */
export const analytics = {
  /**
   * Track a page view
   */
  pageView(path) {
    if (import.meta.env.MODE === 'development') {
      console.log('Analytics pageView:', path)
      return
    }

    // Could integrate with Plausible, Fathom, or similar privacy-focused analytics
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible('pageview', { props: { path } })
    }
  },

  /**
   * Track an event
   */
  event(name, props = {}) {
    if (import.meta.env.MODE === 'development') {
      console.log('Analytics event:', name, props)
      return
    }

    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible(name, { props })
    }
  },

  /**
   * Track feature usage (for product decisions)
   */
  feature(featureName, action = 'used') {
    this.event('feature', { name: featureName, action })
  },

  /**
   * Track search queries (anonymized)
   */
  search(searchType, resultCount) {
    this.event('search', { type: searchType, results: resultCount > 0 ? 'found' : 'empty' })
  },
}

/**
 * Health check utilities
 */
export const healthCheck = {
  /**
   * Check if Supabase is reachable
   */
  async checkSupabase() {
    try {
      const start = Date.now()
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })
      return {
        status: response.ok ? 'healthy' : 'degraded',
        latency: Date.now() - start,
      }
    } catch (e) {
      return { status: 'unhealthy', error: e.message }
    }
  },

  /**
   * Get overall system health
   */
  async getStatus() {
    const [supabase] = await Promise.all([this.checkSupabase()])

    const overall = supabase.status === 'healthy' ? 'healthy' : 'degraded'

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      services: {
        supabase,
      },
    }
  },
}

/**
 * Debug utilities
 */
export const debug = {
  /**
   * Log with timestamp and context
   */
  log(message, data = {}) {
    if (import.meta.env.MODE === 'development') {
      console.log(`[${new Date().toISOString()}] ${message}`, data)
    }
  },

  /**
   * Conditional debug logging
   */
  verbose(message, data = {}) {
    if (import.meta.env.VITE_DEBUG === 'true') {
      console.debug(`[DEBUG] ${message}`, data)
    }
  },

  /**
   * Log network requests (for debugging)
   */
  request(method, url, duration) {
    if (import.meta.env.MODE === 'development') {
      const color = duration > 500 ? 'color: red' : 'color: green'
      console.log(`%c${method} ${url} (${duration}ms)`, color)
    }
  },
}

export default {
  initSentry,
  captureError,
  captureMessage,
  setUser,
  performance,
  analytics,
  healthCheck,
  debug,
}
