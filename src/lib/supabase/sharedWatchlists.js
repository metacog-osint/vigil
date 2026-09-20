/**
 * Team Watchlists Module
 *
 * Reads team_watchlists and team_watchlist_items. It spent its whole life
 * querying shared_watchlists, which has never existed.
 */

import { supabase } from './client'

export const sharedWatchlists = {
  // Get team's watchlists
  async getTeamWatchlists(teamId) {
    return supabase
      .from('team_watchlists')
      .select(
        `
        *,
        items:team_watchlist_items(count)
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
  },

  // Get watchlist by ID
  async getWatchlist(watchlistId) {
    return supabase.from('team_watchlists').select('*').eq('id', watchlistId).single()
  },

  // Create watchlist
  async createWatchlist(teamId, name, description, createdBy) {
    return supabase
      .from('team_watchlists')
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
    return supabase.from('team_watchlists').update(updates).eq('id', watchlistId).select().single()
  },

  // Delete watchlist
  async deleteWatchlist(watchlistId) {
    return supabase.from('team_watchlists').delete().eq('id', watchlistId)
  },

  // Get watchlist items with entity details
  async getWatchlistItems(watchlistId) {
    const { data: items, error } = await supabase
      .from('team_watchlist_items')
      .select('*')
      .eq('watchlist_id', watchlistId)
      // The column is added_at: an item is added to a list, not created by it.
      .order('added_at', { ascending: false })

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
          // vulnerabilities is keyed on cve_id and has no id column, so every
          // vulnerability pinned to a list used to 400 here.
          const keyColumn = table === 'vulnerabilities' ? 'cve_id' : 'id'
          const { data } = await supabase
            .from(table)
            .select('*')
            .eq(keyColumn, item.entity_id)
            .single()
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
      .from('team_watchlist_items')
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
    return supabase.from('team_watchlist_items').delete().eq('id', itemId)
  },

  // Update item notes
  async updateItemNotes(itemId, notes) {
    return supabase
      .from('team_watchlist_items')
      .update({ notes })
      .eq('id', itemId)
      .select()
      .single()
  },
}

export default sharedWatchlists
