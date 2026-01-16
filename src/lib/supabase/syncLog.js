/**
 * Sync Log Module
 * Database queries for data synchronization logging and ops monitoring
 */

import { supabase } from './client'

export const syncLog = {
  /**
   * Get recent sync logs
   */
  async getRecent(limit = 20) {
    return supabase
      .from('sync_log')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(limit)
  },

  /**
   * Get sync logs by source
   */
  async getBySource(source) {
    return supabase
      .from('sync_log')
      .select('*')
      .eq('source', source)
      .order('completed_at', { ascending: false })
      .limit(10)
  },

  /**
   * Get latest sync for each source
   */
  async getLatestBySource() {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('completed_at', { ascending: false })

    if (error) return { data: null, error }

    // Group by source and get latest for each
    const latestBySource = {}
    for (const log of data || []) {
      if (!latestBySource[log.source]) {
        latestBySource[log.source] = log
      }
    }

    return { data: Object.values(latestBySource), error: null }
  },

  /**
   * Get sync status summary for ops dashboard
   */
  async getStatusSummary(hours = 24) {
    const since = new Date()
    since.setHours(since.getHours() - hours)

    const { data, error } = await supabase
      .from('sync_log')
      .select('source, status, completed_at, records_processed, records_added, error_message')
      .gte('completed_at', since.toISOString())
      .order('completed_at', { ascending: false })

    if (error) return { data: null, error }

    // Calculate summary stats
    const summary = {
      total: data?.length || 0,
      success: 0,
      failed: 0,
      partial: 0,
      running: 0,
      bySource: {},
      recentErrors: [],
      recordsProcessed: 0,
      recordsAdded: 0,
    }

    for (const log of data || []) {
      // Count by status
      if (log.status === 'success') summary.success++
      else if (log.status === 'error') summary.failed++
      else if (log.status === 'partial') summary.partial++
      else if (log.status === 'running') summary.running++

      // Track totals
      summary.recordsProcessed += log.records_processed || 0
      summary.recordsAdded += log.records_added || 0

      // Track by source
      if (!summary.bySource[log.source]) {
        summary.bySource[log.source] = {
          source: log.source,
          total: 0,
          success: 0,
          failed: 0,
          lastRun: null,
          lastStatus: null,
        }
      }
      const src = summary.bySource[log.source]
      src.total++
      if (log.status === 'success') src.success++
      if (log.status === 'error') src.failed++
      if (!src.lastRun || new Date(log.completed_at) > new Date(src.lastRun)) {
        src.lastRun = log.completed_at
        src.lastStatus = log.status
      }

      // Collect recent errors
      if (log.status === 'error' && log.error_message) {
        summary.recentErrors.push({
          source: log.source,
          error: log.error_message,
          timestamp: log.completed_at,
        })
      }
    }

    // Limit recent errors
    summary.recentErrors = summary.recentErrors.slice(0, 10)

    return { data: summary, error: null }
  },

  /**
   * Get sync history for a specific source over time
   */
  async getSourceHistory(source, days = 7) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    return supabase
      .from('sync_log')
      .select('*')
      .eq('source', source)
      .gte('completed_at', since.toISOString())
      .order('completed_at', { ascending: true })
  },

  /**
   * Get error rate by source
   */
  async getErrorRates(days = 7) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('sync_log')
      .select('source, status')
      .gte('completed_at', since.toISOString())

    if (error) return { data: null, error }

    const rates = {}
    for (const log of data || []) {
      if (!rates[log.source]) {
        rates[log.source] = { total: 0, errors: 0 }
      }
      rates[log.source].total++
      if (log.status === 'error') {
        rates[log.source].errors++
      }
    }

    // Calculate percentages
    const result = Object.entries(rates).map(([source, stats]) => ({
      source,
      total: stats.total,
      errors: stats.errors,
      errorRate: stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : 0,
    }))

    return { data: result, error: null }
  },

  /**
   * Get data freshness - time since last successful sync per source
   */
  async getDataFreshness() {
    const { data, error } = await supabase
      .from('sync_log')
      .select('source, completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })

    if (error) return { data: null, error }

    const freshness = {}
    const now = new Date()

    for (const log of data || []) {
      if (!freshness[log.source]) {
        const lastSync = new Date(log.completed_at)
        const hoursAgo = Math.round((now - lastSync) / (1000 * 60 * 60))
        freshness[log.source] = {
          source: log.source,
          lastSync: log.completed_at,
          hoursAgo,
          isStale: hoursAgo > 24, // Consider stale if > 24 hours
        }
      }
    }

    return { data: Object.values(freshness), error: null }
  },
}

export default syncLog
