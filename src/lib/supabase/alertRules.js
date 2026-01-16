/**
 * Alert Rules Module
 * User-defined alert configurations
 */

import { supabase } from './client'

export const alertRules = {
  // Get all rules for a user
  async getForUser(userId = 'anonymous', enabledOnly = true) {
    let query = supabase
      .from('user_alert_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (enabledOnly) {
      query = query.eq('enabled', true)
    }

    return query
  },

  // Get a single rule by ID
  async getById(ruleId) {
    return supabase
      .from('user_alert_rules')
      .select('*')
      .eq('id', ruleId)
      .single()
  },

  // Create a new rule
  async create(rule) {
    const {
      userId = 'anonymous',
      ruleName,
      ruleType,
      conditions = {},
      notifyEmail = true,
      notifyInApp = true,
    } = rule

    return supabase.from('user_alert_rules').insert({
      user_id: userId,
      rule_name: ruleName,
      rule_type: ruleType,
      conditions,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
      enabled: true,
    }).select().single()
  },

  // Update a rule
  async update(ruleId, updates) {
    return supabase
      .from('user_alert_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()
  },

  // Delete a rule
  async delete(ruleId) {
    return supabase
      .from('user_alert_rules')
      .delete()
      .eq('id', ruleId)
  },

  // Toggle rule enabled status
  async toggle(ruleId, enabled) {
    return supabase
      .from('user_alert_rules')
      .update({ enabled })
      .eq('id', ruleId)
      .select()
      .single()
  },

  // Record a trigger event
  async recordTrigger(ruleId, userId, triggerData, notificationSent = false, emailSent = false) {
    return supabase.from('alert_triggers').insert({
      rule_id: ruleId,
      user_id: userId,
      trigger_data: triggerData,
      notification_sent: notificationSent,
      email_sent: emailSent,
    })
  },
}

export default alertRules
