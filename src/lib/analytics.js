/**
 * Usage Analytics Module
 * Tracks user engagement and feature usage
 *
 * NOTE: Analytics is disabled by default to prevent 404 errors if the
 * analytics_events table doesn't exist. Enable by setting:
 * VITE_ENABLE_ANALYTICS=true
 */

import { supabase } from './supabase'

// Check if analytics is enabled (disabled by default to prevent 404s)
const ANALYTICS_ENABLED = import.meta.env.VITE_ENABLE_ANALYTICS === 'true'

// Event types
export const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  SEARCH: 'search',
  EXPORT: 'export',
  WATCHLIST: 'watchlist',
  ALERT: 'alert',
  REPORT: 'report',
  API: 'api',
  FEATURE: 'feature',
}

// Generate session ID (persists for browser session)
function getSessionId() {
  let sessionId = sessionStorage.getItem('vigil_session_id')
  if (!sessionId) {
    // Use cryptographically secure random generation
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)
    const randomHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')
    sessionId = `sess_${Date.now()}_${randomHex}`
    sessionStorage.setItem('vigil_session_id', sessionId)
  }
  return sessionId
}

// Get user ID from auth context
function getUserId() {
  // Try to get from localStorage where auth stores it
  try {
    const authUser = localStorage.getItem('vigil_auth_user')
    if (authUser) {
      const parsed = JSON.parse(authUser)
      return parsed.uid || 'anonymous'
    }
  } catch (e) {
    // Ignore parse errors
  }
  return 'anonymous'
}

/**
 * Track an analytics event
 */
export async function trackEvent(eventType, eventName, eventData = {}) {
  // Skip if analytics is disabled (prevents 404 errors if table doesn't exist)
  if (!ANALYTICS_ENABLED) return

  try {
    const event = {
      user_id: getUserId(),
      session_id: getSessionId(),
      event_type: eventType,
      event_name: eventName,
      event_data: eventData,
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    }

    // Fire and forget - don't block on analytics
    supabase
      .from('analytics_events')
      .insert(event)
      .then(({ error }) => {
        if (error) {
          console.debug('Analytics error:', error.message)
        }
      })
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
    console.debug('Analytics tracking failed:', error)
  }
}

/**
 * Track page view
 */
export function trackPageView(pageName, pageData = {}) {
  trackEvent(EVENT_TYPES.PAGE_VIEW, pageName, pageData)
}

/**
 * Track search action
 */
export function trackSearch(searchType, query, resultCount = 0) {
  trackEvent(EVENT_TYPES.SEARCH, searchType, {
    query: query?.slice(0, 100), // Truncate long queries
    result_count: resultCount,
  })
}

/**
 * Track export action
 */
export function trackExport(exportType, format, itemCount = 0) {
  trackEvent(EVENT_TYPES.EXPORT, exportType, {
    format,
    item_count: itemCount,
  })
}

/**
 * Track watchlist action
 */
export function trackWatchlist(action, entityType, entityId) {
  trackEvent(EVENT_TYPES.WATCHLIST, `watchlist_${action}`, {
    entity_type: entityType,
    entity_id: entityId,
  })
}

/**
 * Track alert rule action
 */
export function trackAlert(action, ruleType) {
  trackEvent(EVENT_TYPES.ALERT, `alert_${action}`, {
    rule_type: ruleType,
  })
}

/**
 * Track report action
 */
export function trackReport(action, reportId, frequency) {
  trackEvent(EVENT_TYPES.REPORT, `report_${action}`, {
    report_id: reportId,
    frequency,
  })
}

/**
 * Track feature usage
 */
export function trackFeature(featureName, featureData = {}) {
  trackEvent(EVENT_TYPES.FEATURE, featureName, featureData)
}

/**
 * Track API usage
 */
export function trackApiUsage(endpoint, method, statusCode) {
  trackEvent(EVENT_TYPES.API, 'api_call', {
    endpoint,
    method,
    status_code: statusCode,
  })
}

// Analytics query functions for admin dashboard
export const analyticsQueries = {
  /**
   * Get engagement summary
   */
  async getEngagementSummary() {
    const { data, error } = await supabase.from('v_engagement_summary').select('*').single()

    if (error) throw error
    return data
  },

  /**
   * Get feature adoption stats
   */
  async getFeatureAdoption() {
    const { data, error } = await supabase.from('v_feature_adoption').select('*').limit(20)

    if (error) throw error
    return data || []
  },

  /**
   * Get daily stats for a date range
   */
  async getDailyStats(days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('analytics_daily')
      .select('date, page_views, searches, exports, api_calls')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) throw error

    // Aggregate by date
    const byDate = {}
    for (const row of data || []) {
      if (!byDate[row.date]) {
        byDate[row.date] = { date: row.date, page_views: 0, searches: 0, exports: 0, api_calls: 0 }
      }
      byDate[row.date].page_views += row.page_views || 0
      byDate[row.date].searches += row.searches || 0
      byDate[row.date].exports += row.exports || 0
      byDate[row.date].api_calls += row.api_calls || 0
    }

    return Object.values(byDate)
  },

  /**
   * Get top users by engagement
   */
  async getTopUsers(limit = 10) {
    const { data, error } = await supabase
      .from('user_engagement')
      .select('user_id, engagement_score, total_page_views, total_sessions, last_seen_at')
      .order('engagement_score', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get at-risk users (for churn prevention)
   */
  async getAtRiskUsers() {
    const { data, error } = await supabase
      .from('user_engagement')
      .select('user_id, last_seen_at, days_since_last_activity, engagement_score')
      .eq('is_at_risk', true)
      .order('days_since_last_activity', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  },

  /**
   * Get event counts by type
   */
  async getEventsByType(days = 7) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    // Count by type
    const counts = {}
    for (const row of data || []) {
      counts[row.event_type] = (counts[row.event_type] || 0) + 1
    }

    return Object.entries(counts).map(([type, count]) => ({ type, count }))
  },
}

export default {
  trackEvent,
  trackPageView,
  trackSearch,
  trackExport,
  trackWatchlist,
  trackAlert,
  trackReport,
  trackFeature,
  trackApiUsage,
  queries: analyticsQueries,
}
