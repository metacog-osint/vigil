/**
 * Public Status Page Module
 *
 * Manages system status, uptime monitoring, incidents, and subscriber notifications.
 * Provides both admin management and public-facing status page functionality.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const COMPONENT_STATUS = {
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  PARTIAL_OUTAGE: 'partial_outage',
  MAJOR_OUTAGE: 'major_outage',
  MAINTENANCE: 'maintenance',
}

export const INCIDENT_IMPACT = {
  NONE: 'none',
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
}

export const INCIDENT_STATUS = {
  INVESTIGATING: 'investigating',
  IDENTIFIED: 'identified',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
  SCHEDULED: 'scheduled',
}

export const MONITOR_TYPES = {
  HTTP: 'http',
  HTTPS: 'https',
  TCP: 'tcp',
  PING: 'ping',
  DNS: 'dns',
}

// Status display configuration
export const STATUS_CONFIG = {
  [COMPONENT_STATUS.OPERATIONAL]: {
    label: 'Operational',
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    icon: 'check-circle',
  },
  [COMPONENT_STATUS.DEGRADED]: {
    label: 'Degraded Performance',
    color: '#ffc107',
    bgColor: 'rgba(255, 193, 7, 0.1)',
    icon: 'alert-triangle',
  },
  [COMPONENT_STATUS.PARTIAL_OUTAGE]: {
    label: 'Partial Outage',
    color: '#ff9800',
    bgColor: 'rgba(255, 152, 0, 0.1)',
    icon: 'alert-circle',
  },
  [COMPONENT_STATUS.MAJOR_OUTAGE]: {
    label: 'Major Outage',
    color: '#f44336',
    bgColor: 'rgba(244, 67, 54, 0.1)',
    icon: 'x-circle',
  },
  [COMPONENT_STATUS.MAINTENANCE]: {
    label: 'Under Maintenance',
    color: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.1)',
    icon: 'tool',
  },
}

export const IMPACT_CONFIG = {
  [INCIDENT_IMPACT.NONE]: {
    label: 'None',
    color: '#9e9e9e',
  },
  [INCIDENT_IMPACT.MINOR]: {
    label: 'Minor',
    color: '#ffc107',
  },
  [INCIDENT_IMPACT.MAJOR]: {
    label: 'Major',
    color: '#ff9800',
  },
  [INCIDENT_IMPACT.CRITICAL]: {
    label: 'Critical',
    color: '#f44336',
  },
}

// ============================================
// STATUS PAGE CONFIG
// ============================================

export const statusConfig = {
  /**
   * Get status page configuration
   */
  async get(tenantId) {
    const { data, error } = await supabase
      .from('status_page_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    return { data, error }
  },

  /**
   * Update status page configuration
   */
  async update(tenantId, config) {
    // Check if config exists
    const { data: existing } = await supabase
      .from('status_page_config')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('status_page_config')
        .update({
          page_title: config.pageTitle,
          page_description: config.pageDescription,
          custom_domain: config.customDomain,
          logo_url: config.logoUrl,
          favicon_url: config.faviconUrl,
          primary_color: config.primaryColor,
          background_color: config.backgroundColor,
          show_uptime_history: config.showUptimeHistory,
          show_incident_history: config.showIncidentHistory,
          show_scheduled_maintenance: config.showScheduledMaintenance,
          show_subscribe_button: config.showSubscribeButton,
          uptime_history_days: config.uptimeHistoryDays,
          all_operational_message: config.allOperationalMessage,
          degraded_message: config.degradedMessage,
          outage_message: config.outageMessage,
          maintenance_message: config.maintenanceMessage,
          track_visitors: config.trackVisitors,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .select()
        .single()

      return { data, error }
    } else {
      const { data, error } = await supabase
        .from('status_page_config')
        .insert({
          tenant_id: tenantId,
          page_title: config.pageTitle || 'System Status',
          page_description: config.pageDescription,
          custom_domain: config.customDomain,
          logo_url: config.logoUrl,
          favicon_url: config.faviconUrl,
          primary_color: config.primaryColor,
          background_color: config.backgroundColor,
          show_uptime_history: config.showUptimeHistory ?? true,
          show_incident_history: config.showIncidentHistory ?? true,
          show_scheduled_maintenance: config.showScheduledMaintenance ?? true,
          show_subscribe_button: config.showSubscribeButton ?? true,
          uptime_history_days: config.uptimeHistoryDays || 90,
          all_operational_message: config.allOperationalMessage,
          degraded_message: config.degradedMessage,
          outage_message: config.outageMessage,
          maintenance_message: config.maintenanceMessage,
          track_visitors: config.trackVisitors ?? false,
        })
        .select()
        .single()

      return { data, error }
    }
  },
}

// ============================================
// COMPONENTS
// ============================================

export const components = {
  /**
   * Get all components for a tenant
   */
  async getAll(tenantId, options = {}) {
    const { includeHidden = false } = options

    let query = supabase
      .from('status_components')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_order')

    if (!includeHidden) {
      query = query.eq('is_visible', true)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Get component by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('status_components')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Create a new component
   */
  async create(tenantId, component) {
    const { data, error } = await supabase
      .from('status_components')
      .insert({
        tenant_id: tenantId,
        name: component.name,
        description: component.description,
        group_name: component.groupName,
        display_order: component.displayOrder || 0,
        status: component.status || COMPONENT_STATUS.OPERATIONAL,
        monitor_url: component.monitorUrl,
        monitor_type: component.monitorType,
        monitor_interval_seconds: component.monitorInterval || 60,
        monitor_timeout_seconds: component.monitorTimeout || 30,
        is_visible: component.isVisible ?? true,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update a component
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('status_components')
      .update({
        name: updates.name,
        description: updates.description,
        group_name: updates.groupName,
        display_order: updates.displayOrder,
        status: updates.status,
        status_message: updates.statusMessage,
        monitor_url: updates.monitorUrl,
        monitor_type: updates.monitorType,
        monitor_interval_seconds: updates.monitorInterval,
        monitor_timeout_seconds: updates.monitorTimeout,
        is_visible: updates.isVisible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update component status
   */
  async updateStatus(id, status, message = null) {
    const { data, error } = await supabase
      .from('status_components')
      .update({
        status,
        status_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a component
   */
  async delete(id) {
    const { error } = await supabase.from('status_components').delete().eq('id', id)

    return { error }
  },

  /**
   * Reorder components
   */
  async reorder(componentOrders) {
    const updates = componentOrders.map(({ id, order }) =>
      supabase.from('status_components').update({ display_order: order }).eq('id', id)
    )

    await Promise.all(updates)

    return { error: null }
  },

  /**
   * Get uptime history for a component
   */
  async getUptimeHistory(componentId, days = 90) {
    const { data, error } = await supabase.rpc('get_uptime_history', {
      p_component_id: componentId,
      p_days: days,
    })

    return { data, error }
  },
}

// ============================================
// INCIDENTS
// ============================================

export const incidents = {
  /**
   * Get all incidents for a tenant
   */
  async getAll(tenantId, options = {}) {
    const { status, limit = 50, includeResolved = true } = options

    let query = supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (!includeResolved) {
      query = query.neq('status', INCIDENT_STATUS.RESOLVED)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Get active incidents
   */
  async getActive(tenantId) {
    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .eq('tenant_id', tenantId)
      .neq('status', INCIDENT_STATUS.RESOLVED)
      .order('started_at', { ascending: false })

    return { data, error }
  },

  /**
   * Get incident by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Create a new incident
   */
  async create(tenantId, incident, userId) {
    const { data, error } = await supabase.rpc('create_status_incident', {
      p_tenant_id: tenantId,
      p_title: incident.title,
      p_impact: incident.impact,
      p_message: incident.message,
      p_affected_components: incident.affectedComponents || [],
      p_user_id: userId,
    })

    return { data, error }
  },

  /**
   * Add an update to an incident
   */
  async addUpdate(incidentId, update, userId) {
    const { data, error } = await supabase
      .from('status_incident_updates')
      .insert({
        incident_id: incidentId,
        status: update.status,
        message: update.message,
        created_by: userId,
      })
      .select()
      .single()

    // Update incident status
    if (!error) {
      await supabase
        .from('status_incidents')
        .update({
          status: update.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incidentId)
    }

    return { data, error }
  },

  /**
   * Resolve an incident
   */
  async resolve(incidentId, message, userId) {
    const { data, error } = await supabase.rpc('resolve_status_incident', {
      p_incident_id: incidentId,
      p_message: message,
      p_user_id: userId,
    })

    return { resolved: data === true, error }
  },

  /**
   * Schedule maintenance
   */
  async scheduleMaintenance(tenantId, maintenance, userId) {
    const { data, error } = await supabase
      .from('status_incidents')
      .insert({
        tenant_id: tenantId,
        title: maintenance.title,
        impact: maintenance.impact || INCIDENT_IMPACT.MINOR,
        status: INCIDENT_STATUS.SCHEDULED,
        scheduled_for: maintenance.scheduledFor,
        scheduled_until: maintenance.scheduledUntil,
        affected_component_ids: maintenance.affectedComponents || [],
        created_by: userId,
      })
      .select()
      .single()

    if (!error) {
      await supabase.from('status_incident_updates').insert({
        incident_id: data.id,
        status: INCIDENT_STATUS.SCHEDULED,
        message: maintenance.message || `Scheduled maintenance: ${maintenance.title}`,
        created_by: userId,
      })
    }

    return { data, error }
  },

  /**
   * Get scheduled maintenance
   */
  async getScheduled(tenantId) {
    const { data, error } = await supabase
      .from('status_incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', INCIDENT_STATUS.SCHEDULED)
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for')

    return { data, error }
  },
}

// ============================================
// SUBSCRIBERS
// ============================================

export const subscribers = {
  /**
   * Get all subscribers
   */
  async getAll(tenantId, options = {}) {
    const { verified = true, limit = 100 } = options

    let query = supabase
      .from('status_subscribers')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (verified) {
      query = query.eq('is_verified', true)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Subscribe an email
   */
  async subscribe(tenantId, email, preferences = {}) {
    const { data, error } = await supabase
      .from('status_subscribers')
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        notify_on_incident: preferences.notifyOnIncident ?? true,
        notify_on_maintenance: preferences.notifyOnMaintenance ?? true,
        notify_on_resolution: preferences.notifyOnResolution ?? true,
        subscribed_component_ids: preferences.subscribedComponents,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Verify a subscriber
   */
  async verify(token) {
    const { data, error } = await supabase
      .from('status_subscribers')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('verification_token', token)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Unsubscribe
   */
  async unsubscribe(token) {
    const { data, error } = await supabase
      .from('status_subscribers')
      .update({
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('unsubscribe_token', token)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update preferences
   */
  async updatePreferences(subscriberId, preferences) {
    const { data, error } = await supabase
      .from('status_subscribers')
      .update({
        notify_on_incident: preferences.notifyOnIncident,
        notify_on_maintenance: preferences.notifyOnMaintenance,
        notify_on_resolution: preferences.notifyOnResolution,
        subscribed_component_ids: preferences.subscribedComponents,
      })
      .eq('id', subscriberId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Get subscriber count
   */
  async getCount(tenantId) {
    const { count, error } = await supabase
      .from('status_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_verified', true)
      .is('unsubscribed_at', null)

    return { count, error }
  },
}

// ============================================
// PUBLIC STATUS API
// ============================================

export const publicStatus = {
  /**
   * Get full status summary (for public status page)
   */
  async getSummary(tenantId) {
    const { data, error } = await supabase.rpc('get_status_summary', {
      p_tenant_id: tenantId,
    })

    return { data, error }
  },

  /**
   * Get status by custom domain
   */
  async getByDomain(domain) {
    // First find the tenant by domain
    const { data: config, error: configError } = await supabase
      .from('status_page_config')
      .select('tenant_id')
      .eq('custom_domain', domain)
      .single()

    if (configError || !config) {
      return { data: null, error: configError || { message: 'Status page not found' } }
    }

    return this.getSummary(config.tenant_id)
  },

  /**
   * Get incident history (for public status page)
   */
  async getIncidentHistory(tenantId, days = 30) {
    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        id,
        title,
        impact,
        status,
        started_at,
        resolved_at,
        updates:status_incident_updates(status, message, created_at)
      `
      )
      .eq('tenant_id', tenantId)
      .eq('is_public', true)
      .gte('started_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })

    return { data, error }
  },
}

// ============================================
// UPTIME MONITORING
// ============================================

export const monitoring = {
  /**
   * Record a status check result
   */
  async recordCheck(componentId, success, responseTimeMs = null) {
    const { error } = await supabase.rpc('record_status_check', {
      p_component_id: componentId,
      p_success: success,
      p_response_time_ms: responseTimeMs,
    })

    return { error }
  },

  /**
   * Calculate uptime for a component
   */
  async calculateUptime(componentId, days = 30) {
    const { data, error } = await supabase.rpc('calculate_component_uptime', {
      p_component_id: componentId,
      p_days: days,
    })

    return { uptime: data, error }
  },

  /**
   * Get uptime statistics
   */
  async getStats(tenantId) {
    const { data: components } = await supabase
      .from('status_components')
      .select('id, name, uptime_percentage, status')
      .eq('tenant_id', tenantId)
      .eq('is_visible', true)

    if (!components || components.length === 0) {
      return { data: null, error: null }
    }

    const totalUptime =
      components.reduce((sum, c) => sum + (c.uptime_percentage || 100), 0) / components.length

    const operationalCount = components.filter(
      (c) => c.status === COMPONENT_STATUS.OPERATIONAL
    ).length

    return {
      data: {
        overallUptime: Math.round(totalUptime * 100) / 100,
        componentCount: components.length,
        operationalCount,
        degradedCount: components.length - operationalCount,
        components: components.map((c) => ({
          id: c.id,
          name: c.name,
          uptime: c.uptime_percentage,
          status: c.status,
        })),
      },
      error: null,
    }
  },
}

// ============================================
// HELPERS
// ============================================

/**
 * Get overall status from components
 */
export function calculateOverallStatus(components) {
  if (!components || components.length === 0) {
    return COMPONENT_STATUS.OPERATIONAL
  }

  const statuses = components.map((c) => c.status)

  if (statuses.includes(COMPONENT_STATUS.MAJOR_OUTAGE)) {
    return COMPONENT_STATUS.MAJOR_OUTAGE
  }
  if (statuses.includes(COMPONENT_STATUS.PARTIAL_OUTAGE)) {
    return COMPONENT_STATUS.PARTIAL_OUTAGE
  }
  if (statuses.includes(COMPONENT_STATUS.DEGRADED)) {
    return COMPONENT_STATUS.DEGRADED
  }
  if (statuses.includes(COMPONENT_STATUS.MAINTENANCE)) {
    return COMPONENT_STATUS.MAINTENANCE
  }

  return COMPONENT_STATUS.OPERATIONAL
}

/**
 * Format uptime percentage for display
 */
export function formatUptime(percentage) {
  if (percentage === null || percentage === undefined) {
    return 'N/A'
  }
  return `${percentage.toFixed(2)}%`
}

/**
 * Get uptime bar color based on percentage
 */
export function getUptimeColor(percentage) {
  if (percentage >= 99.9) return '#00ff88'
  if (percentage >= 99) return '#8bc34a'
  if (percentage >= 95) return '#ffc107'
  if (percentage >= 90) return '#ff9800'
  return '#f44336'
}

/**
 * Group components by group name
 */
export function groupComponents(components) {
  const groups = {}
  const ungrouped = []

  components.forEach((component) => {
    if (component.group_name) {
      if (!groups[component.group_name]) {
        groups[component.group_name] = []
      }
      groups[component.group_name].push(component)
    } else {
      ungrouped.push(component)
    }
  })

  return { groups, ungrouped }
}

export default {
  statusConfig,
  components,
  incidents,
  subscribers,
  publicStatus,
  monitoring,
  calculateOverallStatus,
  formatUptime,
  getUptimeColor,
  groupComponents,
  COMPONENT_STATUS,
  INCIDENT_IMPACT,
  INCIDENT_STATUS,
  MONITOR_TYPES,
  STATUS_CONFIG,
  IMPACT_CONFIG,
}
