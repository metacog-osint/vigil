/**
 * Threat Hunts Module
 * Actionable detection guides
 */

import { supabase } from './client'

export const threatHunts = {
  // Get all active hunts
  async getAll(options = {}) {
    const { limit = 50, activeOnly = true, search = '', actorId = null } = options

    let query = supabase
      .from('threat_hunts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,actor_name.ilike.%${search}%,tags.cs.{${search}}`)
    }

    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    return query
  },

  // Get hunt by ID
  async getById(huntId) {
    return supabase
      .from('threat_hunts')
      .select('*')
      .eq('id', huntId)
      .single()
  },

  // Get hunts for a specific actor
  async getForActor(actorId) {
    return supabase
      .from('threat_hunts')
      .select('*')
      .eq('actor_id', actorId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
  },

  // Get user's progress on hunts
  async getUserProgress(userId = 'anonymous') {
    return supabase
      .from('user_hunt_progress')
      .select(`
        *,
        hunt:threat_hunts(id, title, actor_name, confidence)
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
  },

  // Start a hunt (record user started)
  async startHunt(userId = 'anonymous', huntId) {
    return supabase.from('user_hunt_progress').upsert({
      user_id: userId,
      hunt_id: huntId,
      status: 'in_progress',
      completed_checks: [],
    }, { onConflict: 'user_id,hunt_id' }).select().single()
  },

  // Update hunt progress
  async updateProgress(userId = 'anonymous', huntId, completedChecks, notes = null) {
    return supabase
      .from('user_hunt_progress')
      .update({
        completed_checks: completedChecks,
        notes,
        status: 'in_progress',
      })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
      .select()
      .single()
  },

  // Complete a hunt
  async completeHunt(userId = 'anonymous', huntId, notes = null) {
    return supabase
      .from('user_hunt_progress')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
      .select()
      .single()
  },

  // Dismiss a hunt
  async dismissHunt(userId = 'anonymous', huntId) {
    return supabase
      .from('user_hunt_progress')
      .update({ status: 'dismissed' })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
  },
}

export default threatHunts
