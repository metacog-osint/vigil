/**
 * Shared Watchlists Module
 * Team collaborative watchlists
 */

import { supabase } from './client'

export const sharedWatchlists = {
  // Get team's watchlists
  async getTeamWatchlists(teamId) {
    return supabase
      .from('shared_watchlists')
      .select(
        `
        *,
        items:shared_watchlist_items(count)
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
  },

  // Get watchlist by ID
  async getWatchlist(watchlistId) {
    return supabase.from('shared_watchlists').select('*').eq('id', watchlistId).single()
  },

  // Create watchlist
  async createWatchlist(teamId, name, description, createdBy) {
    return supabase
      .from('shared_watchlists')
      .insert({
        team_id: teamId,
        name,
        description,
        created_by: createdBy,
      })
      .select()
      .single()
  },

  // Update watchlist
  async updateWatchlist(watchlistId, updates) {
    return supabase
      .from('shared_watchlists')
      .update(updates)
      .eq('id', watchlistId)
      .select()
      .single()
  },

  // Delete watchlist
  async deleteWatchlist(watchlistId) {
    return supabase.from('shared_watchlists').delete().eq('id', watchlistId)
  },

  // Get watchlist items with entity details
  async getWatchlistItems(watchlistId) {
    const { data: items, error } = await supabase
      .from('shared_watchlist_items')
      .select('*')
      .eq('watchlist_id', watchlistId)
      .order('created_at', { ascending: false })

    if (error || !items) return { data: null, error }

    // Group by entity type and fetch details
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let entity = null
        const table = {
          actor: 'threat_actors',
          incident: 'incidents',
          vulnerability: 'vulnerabilities',
          ioc: 'iocs',
          technique: 'attack_techniques',
        }[item.entity_type]

        if (table) {
          const { data } = await supabase.from(table).select('*').eq('id', item.entity_id).single()
          entity = data
        }

        return { ...item, entity }
      })
    )

    return { data: enrichedItems, error: null }
  },

  // Add item to watchlist
  async addItem(watchlistId, entityType, entityId, addedBy, notes = null) {
    return supabase
      .from('shared_watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        entity_type: entityType,
        entity_id: entityId,
        added_by: addedBy,
        notes,
      })
      .select()
      .single()
  },

  // Remove item from watchlist
  async removeItem(itemId) {
    return supabase.from('shared_watchlist_items').delete().eq('id', itemId)
  },

  // Update item notes
  async updateItemNotes(itemId, notes) {
    return supabase
      .from('shared_watchlist_items')
      .update({ notes })
      .eq('id', itemId)
      .select()
      .single()
  },
}

export default sharedWatchlists
