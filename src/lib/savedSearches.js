/**
 * Saved Searches & Views Module
 * API for saving and managing search filters and views
 */

import { supabase } from './supabase'

// Available pages for saved searches
export const SEARCHABLE_PAGES = {
  actors: { label: 'Threat Actors', icon: 'user-group' },
  incidents: { label: 'Ransomware', icon: 'lock-closed' },
  ransomware: { label: 'Ransomware', icon: 'lock-closed' },
  vulnerabilities: { label: 'Vulnerabilities', icon: 'shield-exclamation' },
  iocs: { label: 'IOC Search', icon: 'search' },
  events: { label: 'Events', icon: 'clipboard-list' },
  alerts: { label: 'Alerts', icon: 'bell' },
  techniques: { label: 'ATT&CK Matrix', icon: 'view-grid' },
}

// Color options for saved searches
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
]

// Icon options
export const ICON_OPTIONS = [
  { value: 'star', label: 'Star' },
  { value: 'bookmark', label: 'Bookmark' },
  { value: 'flag', label: 'Flag' },
  { value: 'folder', label: 'Folder' },
  { value: 'lightning-bolt', label: 'Lightning' },
  { value: 'fire', label: 'Fire' },
  { value: 'eye', label: 'Eye' },
  { value: 'shield-check', label: 'Shield' },
]

export const savedSearches = {
  /**
   * Get all saved searches for a user
   */
  async getAll(userId, page = null) {
    let query = supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)

    if (page) {
      query = query.eq('page', page)
    }

    const { data, error } = await query
      .order('is_pinned', { ascending: false })
      .order('use_count', { ascending: false })
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get shared searches for a team
   */
  async getShared(teamId) {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_shared', true)
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get default search for a page
   */
  async getDefault(userId, page) {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .eq('page', page)
      .eq('is_default', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get pinned searches
   */
  async getPinned(userId) {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_pinned', true)
      .order('pin_order')

    if (error) throw error
    return data || []
  },

  /**
   * Get a single saved search by ID
   */
  async getById(searchId, userId) {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('id', searchId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new saved search
   */
  async create(userId, searchData) {
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: userId,
        name: searchData.name,
        description: searchData.description,
        icon: searchData.icon,
        color: searchData.color,
        page: searchData.page,
        filters: searchData.filters || {},
        sort_by: searchData.sortBy,
        sort_order: searchData.sortOrder || 'desc',
        view_mode: searchData.viewMode,
        visible_columns: searchData.visibleColumns || [],
        is_default: searchData.isDefault || false,
        is_shared: searchData.isShared || false,
        is_pinned: searchData.isPinned || false,
        team_id: searchData.teamId,
      })
      .select()
      .single()

    if (error) throw error

    // If this is set as default, unset other defaults for this page
    if (searchData.isDefault) {
      await supabase
        .from('saved_searches')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('page', searchData.page)
        .neq('id', data.id)
    }

    return data
  },

  /**
   * Update a saved search
   */
  async update(searchId, userId, updates) {
    const updateData = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.icon !== undefined) updateData.icon = updates.icon
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.filters !== undefined) updateData.filters = updates.filters
    if (updates.sortBy !== undefined) updateData.sort_by = updates.sortBy
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder
    if (updates.viewMode !== undefined) updateData.view_mode = updates.viewMode
    if (updates.visibleColumns !== undefined) updateData.visible_columns = updates.visibleColumns
    if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault
    if (updates.isShared !== undefined) updateData.is_shared = updates.isShared
    if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned
    if (updates.pinOrder !== undefined) updateData.pin_order = updates.pinOrder

    const { data, error } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', searchId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    // Handle default setting
    if (updates.isDefault && data) {
      await supabase
        .from('saved_searches')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('page', data.page)
        .neq('id', data.id)
    }

    return data
  },

  /**
   * Delete a saved search
   */
  async delete(searchId, userId) {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Record search usage
   */
  async recordUse(searchId) {
    await supabase.rpc('use_saved_search', { search_uuid: searchId })
  },

  /**
   * Toggle pin status
   */
  async togglePin(searchId, userId, isPinned) {
    const { data, error } = await supabase
      .from('saved_searches')
      .update({ is_pinned: isPinned })
      .eq('id', searchId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Set as default for page
   */
  async setDefault(searchId, userId, page) {
    // Unset any existing default
    await supabase
      .from('saved_searches')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('page', page)

    // Set new default
    const { data, error } = await supabase
      .from('saved_searches')
      .update({ is_default: true })
      .eq('id', searchId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Clear default for page
   */
  async clearDefault(userId, page) {
    const { error } = await supabase
      .from('saved_searches')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('page', page)

    if (error) throw error
  },
}

export const recentSearches = {
  /**
   * Get recent searches for a user
   */
  async getAll(userId, page = null, limit = 20) {
    let query = supabase
      .from('recent_searches')
      .select('*')
      .eq('user_id', userId)

    if (page) {
      query = query.eq('page', page)
    }

    const { data, error } = await query
      .order('searched_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Record a search
   */
  async record(userId, searchData) {
    const { data, error } = await supabase
      .from('recent_searches')
      .insert({
        user_id: userId,
        page: searchData.page,
        search_type: searchData.searchType || 'filter',
        query: searchData.query,
        filters: searchData.filters || {},
        result_count: searchData.resultCount,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Clear search history
   */
  async clear(userId, page = null) {
    let query = supabase
      .from('recent_searches')
      .delete()
      .eq('user_id', userId)

    if (page) {
      query = query.eq('page', page)
    }

    const { error } = await query
    if (error) throw error
  },
}

export const quickAccess = {
  /**
   * Get quick access items for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('quick_access')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')

    if (error) throw error
    return data || []
  },

  /**
   * Add a quick access item
   */
  async add(userId, itemData) {
    const { data, error } = await supabase
      .from('quick_access')
      .insert({
        user_id: userId,
        item_type: itemData.itemType,
        item_id: itemData.itemId,
        item_name: itemData.itemName,
        item_url: itemData.itemUrl,
        icon: itemData.icon,
        color: itemData.color,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Remove a quick access item
   */
  async remove(itemId, userId) {
    const { error } = await supabase
      .from('quick_access')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Reorder quick access items
   */
  async reorder(userId, orderedIds) {
    const updates = orderedIds.map((id, index) => ({
      id,
      user_id: userId,
      sort_order: index,
    }))

    for (const update of updates) {
      await supabase
        .from('quick_access')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
        .eq('user_id', userId)
    }
  },
}

// Utility function to serialize filters for storage
export function serializeFilters(filters) {
  return JSON.stringify(filters)
}

// Utility function to deserialize filters from storage
export function deserializeFilters(filtersStr) {
  try {
    return JSON.parse(filtersStr)
  } catch {
    return {}
  }
}

// Get filter summary for display
export function getFilterSummary(filters) {
  const parts = []

  if (filters.search) parts.push(`"${filters.search}"`)
  if (filters.status) parts.push(`Status: ${filters.status}`)
  if (filters.severity) parts.push(`Severity: ${filters.severity}`)
  if (filters.sector) parts.push(`Sector: ${filters.sector}`)
  if (filters.dateRange) parts.push(`Last ${filters.dateRange}`)
  if (filters.trendStatus) parts.push(`Trend: ${filters.trendStatus}`)

  return parts.length > 0 ? parts.join(' • ') : 'No filters'
}

export default { savedSearches, recentSearches, quickAccess }
