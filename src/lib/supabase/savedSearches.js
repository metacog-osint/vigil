/**
 * Saved Searches Module
 * Database queries for user saved search management
 */

import { supabase } from './client'

export const savedSearches = {
  async getAll(userId = 'anonymous', searchType = null) {
    let query = supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .order('use_count', { ascending: false })

    if (searchType) {
      query = query.eq('search_type', searchType)
    }

    return query
  },

  async create(search) {
    return supabase
      .from('saved_searches')
      .insert(search)
      .select()
      .single()
  },

  async update(id, updates) {
    return supabase
      .from('saved_searches')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  },

  async delete(id) {
    return supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
  },

  async incrementUseCount(id) {
    return supabase
      .rpc('increment_search_use_count', { search_id: id })
  },

  // Alert management
  async enableAlert(id, options = {}) {
    const {
      frequency = 'daily',
      channels = ['email'],
    } = options

    return supabase
      .from('saved_searches')
      .update({
        alert_enabled: true,
        alert_frequency: frequency,
        alert_channels: channels,
      })
      .eq('id', id)
      .select()
      .single()
  },

  async disableAlert(id) {
    return supabase
      .from('saved_searches')
      .update({
        alert_enabled: false,
      })
      .eq('id', id)
      .select()
      .single()
  },

  async updateAlertSettings(id, settings) {
    return supabase
      .from('saved_searches')
      .update({
        alert_frequency: settings.frequency,
        alert_channels: settings.channels,
      })
      .eq('id', id)
      .select()
      .single()
  },

  async getAlertHistory(searchId, limit = 10) {
    return supabase
      .from('search_alert_history')
      .select('*')
      .eq('saved_search_id', searchId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  async getWithAlerts(userId) {
    return supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .eq('alert_enabled', true)
      .order('last_alert_at', { ascending: false, nullsFirst: false })
  },
}

export default savedSearches
