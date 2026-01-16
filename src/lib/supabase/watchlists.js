/**
 * Watchlists Module
 * Database queries for user watchlist management
 */

import { supabase } from './client'

export const watchlists = {
  async getAll(userId = 'anonymous') {
    return supabase
      .from('watchlists')
      .select(`
        *,
        items:watchlist_items(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  },

  async getById(id) {
    return supabase
      .from('watchlists')
      .select(`
        *,
        items:watchlist_items(*)
      `)
      .eq('id', id)
      .single()
  },

  async create(watchlist) {
    return supabase
      .from('watchlists')
      .insert(watchlist)
      .select()
      .single()
  },

  async update(id, updates) {
    return supabase
      .from('watchlists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  },

  async delete(id) {
    return supabase
      .from('watchlists')
      .delete()
      .eq('id', id)
  },

  async addItem(watchlistId, entityId, notes = null) {
    return supabase
      .from('watchlist_items')
      .insert({ watchlist_id: watchlistId, entity_id: entityId, notes })
      .select()
      .single()
  },

  async removeItem(watchlistId, entityId) {
    return supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('entity_id', entityId)
  },

  async isWatched(entityId, userId = 'anonymous') {
    const { data } = await supabase
      .from('watchlist_items')
      .select(`
        *,
        watchlist:watchlists!inner(user_id)
      `)
      .eq('entity_id', entityId)
      .eq('watchlist.user_id', userId)
    return data && data.length > 0
  },
}

export default watchlists
