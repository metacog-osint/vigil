/**
 * Watchlists Module
 * Database queries for user watchlist management
 */

import { supabase } from './client'

export const watchlists = {
  async getAll(userId = 'anonymous') {
    return supabase
      .from('watchlists')
      .select(
        `
        *,
        items:watchlist_items(count)
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  },

  /**
   * Get watchlist by ID with ownership verification
   * @param {string} id - Watchlist ID
   * @param {string} userId - User ID for ownership check
   */
  async getById(id, userId) {
    const query = supabase
      .from('watchlists')
      .select(
        `
        *,
        items:watchlist_items(*)
      `
      )
      .eq('id', id)

    // If userId provided, verify ownership
    if (userId) {
      query.eq('user_id', userId)
    }

    return query.single()
  },

  async create(watchlist) {
    return supabase.from('watchlists').insert(watchlist).select().single()
  },

  /**
   * Update watchlist with ownership verification
   * @param {string} id - Watchlist ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID for ownership check
   */
  async update(id, updates, userId) {
    if (!userId) {
      return { data: null, error: { message: 'User ID required for update' } }
    }

    return supabase
      .from('watchlists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
  },

  /**
   * Delete watchlist with ownership verification
   * @param {string} id - Watchlist ID
   * @param {string} userId - User ID for ownership check
   */
  async delete(id, userId) {
    if (!userId) {
      return { error: { message: 'User ID required for delete' } }
    }

    return supabase.from('watchlists').delete().eq('id', id).eq('user_id', userId)
  },

  /**
   * Add item to watchlist with ownership verification
   * @param {string} watchlistId - Watchlist ID
   * @param {string} entityId - Entity to add
   * @param {string} userId - User ID for ownership check
   * @param {string} notes - Optional notes
   */
  async addItem(watchlistId, entityId, userId, notes = null) {
    if (!userId) {
      return { data: null, error: { message: 'User ID required' } }
    }

    // Verify ownership before adding item
    const { data: watchlist, error: verifyError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', userId)
      .single()

    if (verifyError || !watchlist) {
      return { data: null, error: { message: 'Watchlist not found or access denied' } }
    }

    return supabase
      .from('watchlist_items')
      .insert({ watchlist_id: watchlistId, entity_id: entityId, notes })
      .select()
      .single()
  },

  /**
   * Remove item from watchlist with ownership verification
   * @param {string} watchlistId - Watchlist ID
   * @param {string} entityId - Entity to remove
   * @param {string} userId - User ID for ownership check
   */
  async removeItem(watchlistId, entityId, userId) {
    if (!userId) {
      return { error: { message: 'User ID required' } }
    }

    // Verify ownership before removing item
    const { data: watchlist, error: verifyError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', userId)
      .single()

    if (verifyError || !watchlist) {
      return { error: { message: 'Watchlist not found or access denied' } }
    }

    return supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('entity_id', entityId)
  },

  async isWatched(entityId, userId = 'anonymous') {
    const { data } = await supabase
      .from('watchlist_items')
      .select(
        `
        *,
        watchlist:watchlists!inner(user_id)
      `
      )
      .eq('entity_id', entityId)
      .eq('watchlist.user_id', userId)
    return data && data.length > 0
  },
}

export default watchlists
