/**
 * Escalation Policies Module
 *
 * Manages alert escalation policies, on-call schedules, and escalation tracking.
 */

import { supabase } from '../supabaseClient'

// ============================================
// ESCALATION POLICIES
// ============================================

export const escalationPolicies = {
  /**
   * Get all escalation policies for a team
   */
  async getAll(teamId) {
    const { data, error } = await supabase
      .from('escalation_policies')
      .select(`
        *,
        levels:escalation_levels(
          *,
          targets:escalation_targets(*)
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  /**
   * Get a single escalation policy
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('escalation_policies')
      .select(`
        *,
        levels:escalation_levels(
          *,
          targets:escalation_targets(*)
        )
      `)
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Get the default policy for a team
   */
  async getDefault(teamId) {
    const { data, error } = await supabase
      .from('escalation_policies')
      .select(`
        *,
        levels:escalation_levels(
          *,
          targets:escalation_targets(*)
        )
      `)
      .eq('team_id', teamId)
      .eq('is_default', true)
      .eq('enabled', true)
      .single()

    return { data, error }
  },

  /**
   * Create a new escalation policy
   */
  async create(policy) {
    const { data, error } = await supabase
      .from('escalation_policies')
      .insert(policy)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update an escalation policy
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('escalation_policies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete an escalation policy
   */
  async delete(id) {
    const { error } = await supabase
      .from('escalation_policies')
      .delete()
      .eq('id', id)

    return { error }
  },

  /**
   * Set a policy as the default for a team
   */
  async setDefault(teamId, policyId) {
    // First, unset any existing default
    await supabase
      .from('escalation_policies')
      .update({ is_default: false })
      .eq('team_id', teamId)

    // Set the new default
    const { data, error } = await supabase
      .from('escalation_policies')
      .update({ is_default: true })
      .eq('id', policyId)
      .select()
      .single()

    return { data, error }
  },
}

// ============================================
// ESCALATION LEVELS
// ============================================

export const escalationLevels = {
  /**
   * Add a level to a policy
   */
  async create(level) {
    const { data, error } = await supabase
      .from('escalation_levels')
      .insert(level)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update a level
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('escalation_levels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a level
   */
  async delete(id) {
    const { error } = await supabase
      .from('escalation_levels')
      .delete()
      .eq('id', id)

    return { error }
  },

  /**
   * Reorder levels within a policy
   */
  async reorder(policyId, levelOrders) {
    const updates = levelOrders.map(({ id, order }) =>
      supabase
        .from('escalation_levels')
        .update({ level_order: order })
        .eq('id', id)
        .eq('policy_id', policyId)
    )

    const results = await Promise.all(updates)
    const errors = results.filter((r) => r.error)

    return { error: errors.length > 0 ? errors[0].error : null }
  },
}

// ============================================
// ESCALATION TARGETS
// ============================================

export const escalationTargets = {
  /**
   * Add a target to a level
   */
  async create(target) {
    const { data, error } = await supabase
      .from('escalation_targets')
      .insert(target)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a target
   */
  async delete(id) {
    const { error } = await supabase
      .from('escalation_targets')
      .delete()
      .eq('id', id)

    return { error }
  },
}

// ============================================
// ON-CALL SCHEDULES
// ============================================

export const oncallSchedules = {
  /**
   * Get all schedules for a team
   */
  async getAll(teamId) {
    const { data, error } = await supabase
      .from('oncall_schedules')
      .select(`
        *,
        participants:schedule_participants(
          *,
          user:auth.users(id, email, raw_user_meta_data)
        ),
        overrides:schedule_overrides(
          *,
          override_user:auth.users!schedule_overrides_override_user_id_fkey(id, email, raw_user_meta_data)
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  /**
   * Get a single schedule
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('oncall_schedules')
      .select(`
        *,
        participants:schedule_participants(
          *,
          user:auth.users(id, email, raw_user_meta_data)
        ),
        overrides:schedule_overrides(
          *,
          override_user:auth.users!schedule_overrides_override_user_id_fkey(id, email, raw_user_meta_data)
        )
      `)
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Create a new schedule
   */
  async create(schedule) {
    const { data, error } = await supabase
      .from('oncall_schedules')
      .insert(schedule)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update a schedule
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('oncall_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a schedule
   */
  async delete(id) {
    const { error } = await supabase.from('oncall_schedules').delete().eq('id', id)

    return { error }
  },

  /**
   * Get current on-call user for a schedule
   */
  async getCurrentOncall(scheduleId) {
    const { data, error } = await supabase.rpc('get_current_oncall', {
      p_schedule_id: scheduleId,
    })

    return { data, error }
  },

  /**
   * Add a participant to a schedule
   */
  async addParticipant(scheduleId, userId, position) {
    const { data, error } = await supabase
      .from('schedule_participants')
      .insert({ schedule_id: scheduleId, user_id: userId, position })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Remove a participant from a schedule
   */
  async removeParticipant(scheduleId, userId) {
    const { error } = await supabase
      .from('schedule_participants')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('user_id', userId)

    return { error }
  },

  /**
   * Reorder participants in a schedule
   */
  async reorderParticipants(scheduleId, participantOrders) {
    const updates = participantOrders.map(({ userId, position }) =>
      supabase
        .from('schedule_participants')
        .update({ position })
        .eq('schedule_id', scheduleId)
        .eq('user_id', userId)
    )

    const results = await Promise.all(updates)
    const errors = results.filter((r) => r.error)

    return { error: errors.length > 0 ? errors[0].error : null }
  },

  /**
   * Create an override
   */
  async createOverride(override) {
    const { data, error } = await supabase
      .from('schedule_overrides')
      .insert(override)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete an override
   */
  async deleteOverride(id) {
    const { error } = await supabase.from('schedule_overrides').delete().eq('id', id)

    return { error }
  },
}

// ============================================
// ALERT ESCALATIONS
// ============================================

export const alertEscalations = {
  /**
   * Get active escalations for a team
   */
  async getActive(teamId) {
    const { data, error } = await supabase
      .from('alert_escalations')
      .select(`
        *,
        policy:escalation_policies!inner(*),
        alert:alert_queue(*)
      `)
      .eq('policy.team_id', teamId)
      .in('status', ['active', 'acknowledged'])
      .order('created_at', { ascending: false })

    return { data, error }
  },

  /**
   * Get escalation history
   */
  async getHistory(teamId, options = {}) {
    const { limit = 50, offset = 0, status } = options

    let query = supabase
      .from('alert_escalations')
      .select(
        `
        *,
        policy:escalation_policies!inner(*),
        alert:alert_queue(*),
        history:escalation_history(*)
      `,
        { count: 'exact' }
      )
      .eq('policy.team_id', teamId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

    return { data, count, error }
  },

  /**
   * Create a new escalation
   */
  async create(alertQueueId, policyId) {
    const { data, error } = await supabase.rpc('create_escalation', {
      p_alert_queue_id: alertQueueId,
      p_policy_id: policyId,
    })

    return { data, error }
  },

  /**
   * Acknowledge an escalation
   */
  async acknowledge(escalationId, userId) {
    const { data, error } = await supabase.rpc('acknowledge_escalation', {
      p_escalation_id: escalationId,
      p_user_id: userId,
    })

    return { data, error }
  },

  /**
   * Resolve an escalation
   */
  async resolve(escalationId, userId, notes = null) {
    const { data, error } = await supabase.rpc('resolve_escalation', {
      p_escalation_id: escalationId,
      p_user_id: userId,
      p_notes: notes,
    })

    return { data, error }
  },

  /**
   * Process an escalation (move to next level)
   */
  async process(escalationId) {
    const { data, error } = await supabase.rpc('process_escalation', {
      p_escalation_id: escalationId,
    })

    return { data, error }
  },

  /**
   * Get escalation statistics
   */
  async getStats(teamId, days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('alert_escalations')
      .select(
        `
        id,
        status,
        current_level,
        created_at,
        acknowledged_at,
        resolved_at,
        policy:escalation_policies!inner(team_id)
      `
      )
      .eq('policy.team_id', teamId)
      .gte('created_at', startDate.toISOString())

    if (error) return { data: null, error }

    // Calculate statistics
    const stats = {
      total: data.length,
      byStatus: {
        active: data.filter((e) => e.status === 'active').length,
        acknowledged: data.filter((e) => e.status === 'acknowledged').length,
        resolved: data.filter((e) => e.status === 'resolved').length,
        timeout: data.filter((e) => e.status === 'timeout').length,
      },
      avgTimeToAcknowledge: 0,
      avgTimeToResolve: 0,
      escalationRate: 0,
    }

    // Calculate average times
    const acknowledged = data.filter((e) => e.acknowledged_at)
    if (acknowledged.length > 0) {
      const totalAckTime = acknowledged.reduce((sum, e) => {
        return sum + (new Date(e.acknowledged_at) - new Date(e.created_at))
      }, 0)
      stats.avgTimeToAcknowledge = Math.round(totalAckTime / acknowledged.length / 60000) // minutes
    }

    const resolved = data.filter((e) => e.resolved_at)
    if (resolved.length > 0) {
      const totalResolveTime = resolved.reduce((sum, e) => {
        return sum + (new Date(e.resolved_at) - new Date(e.created_at))
      }, 0)
      stats.avgTimeToResolve = Math.round(totalResolveTime / resolved.length / 60000) // minutes
    }

    // Calculate escalation rate (escalations that went beyond level 1)
    const escalated = data.filter((e) => e.current_level > 1)
    stats.escalationRate = data.length > 0 ? Math.round((escalated.length / data.length) * 100) : 0

    return { data: stats, error: null }
  },
}

export default {
  escalationPolicies,
  escalationLevels,
  escalationTargets,
  oncallSchedules,
  alertEscalations,
}
