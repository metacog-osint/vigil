/**
 * Status Page / SLA Dashboard Module
 * API for status monitoring and SLA reporting
 */

import { supabase } from './supabase'

// Status types
export const STATUS_TYPES = {
  operational: { label: 'Operational', color: 'green', icon: 'check-circle' },
  degraded_performance: { label: 'Degraded Performance', color: 'yellow', icon: 'exclamation' },
  partial_outage: { label: 'Partial Outage', color: 'orange', icon: 'exclamation-triangle' },
  major_outage: { label: 'Major Outage', color: 'red', icon: 'x-circle' },
  maintenance: { label: 'Under Maintenance', color: 'blue', icon: 'wrench' },
}

// Impact levels
export const IMPACT_LEVELS = {
  none: { label: 'None', color: 'gray', severity: 0 },
  minor: { label: 'Minor', color: 'yellow', severity: 1 },
  major: { label: 'Major', color: 'orange', severity: 2 },
  critical: { label: 'Critical', color: 'red', severity: 3 },
}

// Incident statuses
export const INCIDENT_STATUSES = {
  investigating: { label: 'Investigating', color: 'red' },
  identified: { label: 'Identified', color: 'orange' },
  monitoring: { label: 'Monitoring', color: 'yellow' },
  resolved: { label: 'Resolved', color: 'green' },
}

export const statusComponents = {
  /**
   * Get all visible components
   */
  async getAll() {
    const { data, error } = await supabase
      .from('status_components')
      .select('*')
      .eq('is_visible', true)
      .order('display_order')
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get component by slug
   */
  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('status_components')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get components grouped by group_name
   */
  async getGrouped() {
    const components = await this.getAll()

    const groups = {}
    for (const comp of components) {
      const group = comp.group_name || 'Other'
      if (!groups[group]) groups[group] = []
      groups[group].push(comp)
    }

    return groups
  },

  /**
   * Update component status
   */
  async updateStatus(componentId, status) {
    const { data, error } = await supabase
      .from('status_components')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', componentId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Record health check result
   */
  async recordHealthCheck(componentId, isHealthy, responseTime) {
    const { error } = await supabase
      .from('status_components')
      .update({
        last_check_at: new Date().toISOString(),
        last_response_time: responseTime,
        status: isHealthy ? 'operational' : 'major_outage',
        updated_at: new Date().toISOString(),
      })
      .eq('id', componentId)

    if (error) throw error
  },
}

export const statusIncidents = {
  /**
   * Get active incidents
   */
  async getActive() {
    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .neq('status', 'resolved')
      .eq('is_public', true)
      .order('started_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get recent incidents (including resolved)
   */
  async getRecent(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .eq('is_public', true)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get incident by ID
   */
  async getById(incidentId) {
    const { data, error } = await supabase
      .from('status_incidents')
      .select(
        `
        *,
        updates:status_incident_updates(*)
      `
      )
      .eq('id', incidentId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create incident
   */
  async create(incidentData, createdBy) {
    const { data, error } = await supabase
      .from('status_incidents')
      .insert({
        title: incidentData.title,
        description: incidentData.description,
        impact: incidentData.impact || 'minor',
        status: 'investigating',
        affected_components: incidentData.affectedComponents || [],
        started_at: incidentData.startedAt || new Date().toISOString(),
        is_public: incidentData.isPublic !== false,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error

    // Add initial update
    if (incidentData.message) {
      await this.addUpdate(data.id, 'investigating', incidentData.message, createdBy)
    }

    return data
  },

  /**
   * Update incident status
   */
  async updateStatus(incidentId, status, message, updatedBy) {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'identified') {
      updateData.identified_at = new Date().toISOString()
    } else if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('status_incidents')
      .update(updateData)
      .eq('id', incidentId)
      .select()
      .single()

    if (error) throw error

    // Add update entry
    if (message) {
      await this.addUpdate(incidentId, status, message, updatedBy)
    }

    return data
  },

  /**
   * Add incident update
   */
  async addUpdate(incidentId, status, message, createdBy) {
    const { data, error } = await supabase
      .from('status_incident_updates')
      .insert({
        incident_id: incidentId,
        status,
        message,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Set root cause
   */
  async setRootCause(incidentId, rootCause, postmortemUrl) {
    const { data, error } = await supabase
      .from('status_incidents')
      .update({
        root_cause: rootCause,
        postmortem_url: postmortemUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incidentId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

export const statusMaintenance = {
  /**
   * Get upcoming maintenance
   */
  async getUpcoming() {
    const { data, error } = await supabase
      .from('status_maintenance')
      .select('*')
      .in('status', ['scheduled', 'in_progress'])
      .gt('scheduled_end', new Date().toISOString())
      .eq('is_public', true)
      .order('scheduled_start')

    if (error) throw error
    return data || []
  },

  /**
   * Get past maintenance
   */
  async getPast(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('status_maintenance')
      .select('*')
      .eq('status', 'completed')
      .gte('scheduled_start', since.toISOString())
      .eq('is_public', true)
      .order('scheduled_start', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Schedule maintenance
   */
  async create(maintenanceData, createdBy) {
    const { data, error } = await supabase
      .from('status_maintenance')
      .insert({
        title: maintenanceData.title,
        description: maintenanceData.description,
        impact: maintenanceData.impact || 'minor',
        scheduled_start: maintenanceData.scheduledStart,
        scheduled_end: maintenanceData.scheduledEnd,
        affected_components: maintenanceData.affectedComponents || [],
        is_public: maintenanceData.isPublic !== false,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Start maintenance
   */
  async start(maintenanceId) {
    const { data, error } = await supabase
      .from('status_maintenance')
      .update({
        status: 'in_progress',
        actual_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', maintenanceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Complete maintenance
   */
  async complete(maintenanceId) {
    const { data, error } = await supabase
      .from('status_maintenance')
      .update({
        status: 'completed',
        actual_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', maintenanceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Cancel maintenance
   */
  async cancel(maintenanceId) {
    const { data, error } = await supabase
      .from('status_maintenance')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', maintenanceId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

export const statusOverview = {
  /**
   * Get overall system status
   */
  async getSystemStatus() {
    const { data, error } = await supabase.rpc('get_system_status')

    if (error) throw error
    return (
      data?.[0] || {
        overall_status: 'operational',
        components_operational: 0,
        components_degraded: 0,
        components_outage: 0,
        active_incidents: 0,
        upcoming_maintenance: 0,
      }
    )
  },

  /**
   * Get full status page data
   */
  async getStatusPageData() {
    const [systemStatus, components, incidents, maintenance] = await Promise.all([
      this.getSystemStatus(),
      statusComponents.getGrouped(),
      statusIncidents.getActive(),
      statusMaintenance.getUpcoming(),
    ])

    return {
      systemStatus,
      components,
      incidents,
      maintenance,
    }
  },

  /**
   * Get uptime history for a component
   */
  async getUptimeHistory(componentId, days = 90) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('status_uptime_records')
      .select('*')
      .eq('component_id', componentId)
      .gte('recorded_date', since.toISOString().split('T')[0])
      .order('recorded_date', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Calculate SLA compliance
   */
  async getSlaCompliance(componentIds = null, days = 30) {
    let query = supabase
      .from('status_uptime_records')
      .select('component_id, uptime_percent')
      .gte(
        'recorded_date',
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )

    if (componentIds && componentIds.length > 0) {
      query = query.in('component_id', componentIds)
    }

    const { data, error } = await query

    if (error) throw error

    if (!data || data.length === 0) {
      return { average: 100, records: 0 }
    }

    const total = data.reduce((sum, r) => sum + parseFloat(r.uptime_percent), 0)
    return {
      average: (total / data.length).toFixed(2),
      records: data.length,
    }
  },
}

// Utility: Format uptime percentage
export function formatUptime(uptime) {
  const num = parseFloat(uptime)
  if (num >= 99.99) return '99.99%'
  if (num >= 100) return '100%'
  return `${num.toFixed(2)}%`
}

// Utility: Get status color class
export function getStatusColor(status) {
  const info = STATUS_TYPES[status]
  if (!info) return 'gray'
  return info.color
}

// Utility: Get impact color class
export function getImpactColor(impact) {
  const info = IMPACT_LEVELS[impact]
  if (!info) return 'gray'
  return info.color
}

// Utility: Calculate time since/until
export function getTimeRelative(date) {
  const now = new Date()
  const target = new Date(date)
  const diff = target - now

  const absDiff = Math.abs(diff)
  const minutes = Math.floor(absDiff / (1000 * 60))
  const hours = Math.floor(absDiff / (1000 * 60 * 60))
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24))

  let text
  if (days > 0) text = `${days} day${days > 1 ? 's' : ''}`
  else if (hours > 0) text = `${hours} hour${hours > 1 ? 's' : ''}`
  else text = `${minutes} minute${minutes > 1 ? 's' : ''}`

  return diff < 0 ? `${text} ago` : `in ${text}`
}

export default {
  statusComponents,
  statusIncidents,
  statusMaintenance,
  statusOverview,
}
