/**
 * Watchlists Module
 * Database queries for user watchlist management
 */

import { supabase } from './client'

/**
 * Every read and write here names the signed-in user (user.id from useAuth).
 * The filter on user_id only narrows the query; row-level security (065:
 * user_id = auth.uid()::text, and watchlist_items through the owning list)
 * still decides which rows the session can reach. A call without a user id
 * returns an error and sends no query, so a caller that forgets it fails
 * visibly instead of silently finding nothing.
 */
const NO_USER = { message: 'User ID required' }

export const watchlists = {
  async getAll(userId) {
    if (!userId) return { data: [], error: NO_USER }
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

  /**
   * The ids of this user's watchlists that hold the entity. getAll() returns
   * only a count of each list's items, so it cannot say which lists hold it.
   */
  async containing(entityId, userId) {
    if (!userId) return { data: [], error: NO_USER }
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('watchlist_id, watchlist:watchlists!inner(user_id)')
      .eq('entity_id', entityId)
      .eq('watchlist.user_id', userId)
    if (error) return { data: [], error }
    return { data: [...new Set((data || []).map((row) => row.watchlist_id))], error: null }
  },

  async isWatched(entityId, userId) {
    if (!userId) return false
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
