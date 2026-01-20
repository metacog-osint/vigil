/**
 * Audit Logs Module
 * Comprehensive activity logging for compliance
 */

import { supabase } from './supabase'

// Event categories
export const EVENT_CATEGORIES = {
  auth: { label: 'Authentication', icon: 'key', color: 'blue' },
  data: { label: 'Data Access', icon: 'database', color: 'green' },
  export: { label: 'Export', icon: 'download', color: 'purple' },
  settings: { label: 'Settings', icon: 'cog', color: 'gray' },
  admin: { label: 'Administration', icon: 'users', color: 'orange' },
  api: { label: 'API', icon: 'code', color: 'cyan' },
}

// Event types
export const EVENT_TYPES = {
  // Auth events
  'user.login': { category: 'auth', label: 'User Login', severity: 'info' },
  'user.logout': { category: 'auth', label: 'User Logout', severity: 'info' },
  'user.login_failed': { category: 'auth', label: 'Failed Login', severity: 'warning' },
  'user.mfa_enrolled': { category: 'auth', label: 'MFA Enrolled', severity: 'info' },
  'user.mfa_verified': { category: 'auth', label: 'MFA Verified', severity: 'info' },
  'user.password_changed': { category: 'auth', label: 'Password Changed', severity: 'info' },
  'user.session_expired': { category: 'auth', label: 'Session Expired', severity: 'info' },

  // Data events
  'search.executed': { category: 'data', label: 'Search Executed', severity: 'info' },
  'entity.viewed': { category: 'data', label: 'Entity Viewed', severity: 'info' },
  'entity.created': { category: 'data', label: 'Entity Created', severity: 'info' },
  'entity.updated': { category: 'data', label: 'Entity Updated', severity: 'info' },
  'entity.deleted': { category: 'data', label: 'Entity Deleted', severity: 'warning' },
  'watchlist.added': { category: 'data', label: 'Added to Watchlist', severity: 'info' },
  'watchlist.removed': { category: 'data', label: 'Removed from Watchlist', severity: 'info' },

  // Export events
  'export.csv': { category: 'export', label: 'CSV Export', severity: 'info' },
  'export.stix': { category: 'export', label: 'STIX Export', severity: 'info' },
  'export.pdf': { category: 'export', label: 'PDF Export', severity: 'info' },
  'report.generated': { category: 'export', label: 'Report Generated', severity: 'info' },
  'report.downloaded': { category: 'export', label: 'Report Downloaded', severity: 'info' },

  // Settings events
  'settings.updated': { category: 'settings', label: 'Settings Updated', severity: 'info' },
  'profile.updated': { category: 'settings', label: 'Profile Updated', severity: 'info' },
  'api_key.created': { category: 'settings', label: 'API Key Created', severity: 'warning' },
  'api_key.revoked': { category: 'settings', label: 'API Key Revoked', severity: 'warning' },
  'alert_rule.created': { category: 'settings', label: 'Alert Rule Created', severity: 'info' },
  'alert_rule.updated': { category: 'settings', label: 'Alert Rule Updated', severity: 'info' },
  'alert_rule.deleted': { category: 'settings', label: 'Alert Rule Deleted', severity: 'info' },

  // Admin events
  'team.member_invited': { category: 'admin', label: 'Member Invited', severity: 'info' },
  'team.member_removed': { category: 'admin', label: 'Member Removed', severity: 'warning' },
  'team.role_changed': { category: 'admin', label: 'Role Changed', severity: 'warning' },
  'team.settings_updated': { category: 'admin', label: 'Team Settings Updated', severity: 'info' },

  // API events
  'api.request': { category: 'api', label: 'API Request', severity: 'info' },
  'api.rate_limited': { category: 'api', label: 'Rate Limited', severity: 'warning' },
  'api.key_used': { category: 'api', label: 'API Key Used', severity: 'info' },
  'api.unauthorized': { category: 'api', label: 'Unauthorized Access', severity: 'error' },
}

// Actions
export const ACTIONS = {
  create: 'create',
  read: 'read',
  update: 'update',
  delete: 'delete',
  export: 'export',
  import: 'import',
  login: 'login',
  logout: 'logout',
  search: 'search',
  invite: 'invite',
  revoke: 'revoke',
}

export const auditLogs = {
  /**
   * Log an audit event
   */
  async log(eventData) {
    const eventInfo = EVENT_TYPES[eventData.eventType] || {}

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: eventData.userId,
        user_email: eventData.userEmail,
        user_name: eventData.userName,
        team_id: eventData.teamId,
        event_type: eventData.eventType,
        event_category: eventInfo.category || eventData.category || 'data',
        action: eventData.action || 'read',
        resource_type: eventData.resourceType,
        resource_id: eventData.resourceId,
        resource_name: eventData.resourceName,
        description: eventData.description,
        metadata: eventData.metadata || {},
        ip_address: eventData.ipAddress,
        user_agent: eventData.userAgent,
        status: eventData.status || 'success',
        error_message: eventData.errorMessage,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to log audit event:', error)
      return null
    }
    return data
  },

  /**
   * Get audit logs with filtering
   */
  async getAll(filters = {}) {
    let query = supabase.from('audit_logs').select('*')

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.teamId) {
      query = query.eq('team_id', filters.teamId)
    }

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType)
    }

    if (filters.eventCategory) {
      query = query.eq('event_category', filters.eventCategory)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    if (filters.search) {
      query = query.or(
        `description.ilike.%${filters.search}%,resource_name.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 500)

    if (error) throw error
    return data || []
  },

  /**
   * Get logs for a specific user
   */
  async getByUser(userId, days = 30, limit = 100) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get logs for a team
   */
  async getByTeam(teamId, days = 30, limit = 500) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get audit summary statistics
   */
  async getSummary(userId, teamId = null, days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    let query = supabase
      .from('audit_logs')
      .select('event_category, action, status, created_at')
      .gte('created_at', since.toISOString())

    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) throw error

    // Aggregate stats
    const summary = {
      total: data?.length || 0,
      byCategory: {},
      byAction: {},
      byStatus: { success: 0, failure: 0, partial: 0 },
      byDay: {},
    }

    for (const log of data || []) {
      summary.byCategory[log.event_category] = (summary.byCategory[log.event_category] || 0) + 1
      summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1
      summary.byStatus[log.status] = (summary.byStatus[log.status] || 0) + 1

      const day = log.created_at.split('T')[0]
      summary.byDay[day] = (summary.byDay[day] || 0) + 1
    }

    return summary
  },

  /**
   * Export logs to CSV
   */
  async exportToCsv(filters = {}) {
    const logs = await this.getAll({ ...filters, limit: 10000 })

    const headers = [
      'timestamp',
      'user_email',
      'event_type',
      'category',
      'action',
      'resource_type',
      'resource_name',
      'description',
      'status',
      'ip_address',
    ]

    const rows = [headers.join(',')]

    for (const log of logs) {
      const row = [
        log.created_at,
        `"${log.user_email || ''}"`,
        log.event_type,
        log.event_category,
        log.action,
        log.resource_type || '',
        `"${(log.resource_name || '').replace(/"/g, '""')}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`,
        log.status,
        log.ip_address || '',
      ]
      rows.push(row.join(','))
    }

    return rows.join('\n')
  },

  /**
   * Export logs to JSON
   */
  async exportToJson(filters = {}) {
    const logs = await this.getAll({ ...filters, limit: 10000 })
    return JSON.stringify(logs, null, 2)
  },
}

export const auditLogSettings = {
  /**
   * Get settings for a team
   */
  async get(teamId) {
    const { data, error } = await supabase
      .from('audit_log_settings')
      .select('*')
      .eq('team_id', teamId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Update settings
   */
  async update(teamId, settings) {
    const { data, error } = await supabase
      .from('audit_log_settings')
      .upsert({
        team_id: teamId,
        retention_days: settings.retentionDays,
        log_auth_events: settings.logAuthEvents,
        log_data_events: settings.logDataEvents,
        log_export_events: settings.logExportEvents,
        log_settings_events: settings.logSettingsEvents,
        log_admin_events: settings.logAdminEvents,
        log_api_events: settings.logApiEvents,
        auto_export_enabled: settings.autoExportEnabled,
        auto_export_format: settings.autoExportFormat,
        auto_export_frequency: settings.autoExportFrequency,
        auto_export_destination: settings.autoExportDestination,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },
}

// Utility: Create audit log helper for components
export function createAuditLogger(userId, userEmail, teamId = null) {
  return {
    log: (eventType, options = {}) => {
      return auditLogs.log({
        userId,
        userEmail,
        teamId,
        eventType,
        ...options,
      })
    },

    logSearch: (query, resultCount) => {
      return auditLogs.log({
        userId,
        userEmail,
        teamId,
        eventType: 'search.executed',
        action: 'search',
        description: `Searched for "${query}"`,
        metadata: { query, result_count: resultCount },
      })
    },

    logExport: (format, resourceType, count) => {
      return auditLogs.log({
        userId,
        userEmail,
        teamId,
        eventType: `export.${format}`,
        action: 'export',
        resourceType,
        description: `Exported ${count} ${resourceType} records to ${format.toUpperCase()}`,
        metadata: { format, count },
      })
    },

    logEntityView: (resourceType, resourceId, resourceName) => {
      return auditLogs.log({
        userId,
        userEmail,
        teamId,
        eventType: 'entity.viewed',
        action: 'read',
        resourceType,
        resourceId,
        resourceName,
        description: `Viewed ${resourceType}: ${resourceName}`,
      })
    },
  }
}

export default { auditLogs, auditLogSettings }
