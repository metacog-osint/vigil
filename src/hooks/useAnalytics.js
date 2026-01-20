/**
 * useAnalytics Hook
 * Easy-to-use analytics tracking for React components
 */

import { useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  trackPageView,
  trackSearch,
  trackExport,
  trackWatchlist,
  trackAlert,
  trackReport,
  trackFeature,
} from '../lib/analytics'

/**
 * Hook for automatic page view tracking
 */
export function usePageTracking() {
  const location = useLocation()

  useEffect(() => {
    // Extract page name from path
    const pageName =
      location.pathname === '/' ? 'dashboard' : location.pathname.slice(1).replace(/\//g, '_')

    trackPageView(pageName, {
      path: location.pathname,
      search: location.search,
    })
  }, [location.pathname])
}

/**
 * Hook for tracking user interactions
 */
export function useAnalytics() {
  const trackSearchAction = useCallback((searchType, query, resultCount) => {
    trackSearch(searchType, query, resultCount)
  }, [])

  const trackExportAction = useCallback((exportType, format, itemCount) => {
    trackExport(exportType, format, itemCount)
  }, [])

  const trackWatchlistAction = useCallback((action, entityType, entityId) => {
    trackWatchlist(action, entityType, entityId)
  }, [])

  const trackAlertAction = useCallback((action, ruleType) => {
    trackAlert(action, ruleType)
  }, [])

  const trackReportAction = useCallback((action, reportId, frequency) => {
    trackReport(action, reportId, frequency)
  }, [])

  const trackFeatureAction = useCallback((featureName, data) => {
    trackFeature(featureName, data)
  }, [])

  return {
    trackSearch: trackSearchAction,
    trackExport: trackExportAction,
    trackWatchlist: trackWatchlistAction,
    trackAlert: trackAlertAction,
    trackReport: trackReportAction,
    trackFeature: trackFeatureAction,
  }
}

export default useAnalytics
