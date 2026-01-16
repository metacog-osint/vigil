/**
 * Attack Surface Monitoring Module
 * API for managing and monitoring customer assets
 */

import { supabase } from './supabase'

// Asset types
export const ASSET_TYPES = {
  domain: { label: 'Domain', icon: 'globe', color: 'blue', placeholder: 'example.com' },
  ip: { label: 'IP Address', icon: 'server', color: 'purple', placeholder: '192.168.1.1' },
  ip_range: { label: 'IP Range', icon: 'cube', color: 'indigo', placeholder: '192.168.1.0/24' },
  email_domain: { label: 'Email Domain', icon: 'mail', color: 'green', placeholder: 'company.com' },
  keyword: { label: 'Keyword', icon: 'search', color: 'yellow', placeholder: 'Brand Name' },
  executive: { label: 'Executive', icon: 'user', color: 'orange', placeholder: 'John Doe, CEO' },
}

// Asset criticality levels
export const CRITICALITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'red', description: 'Mission-critical assets' },
  { value: 'high', label: 'High', color: 'orange', description: 'Important business assets' },
  { value: 'medium', label: 'Medium', color: 'yellow', description: 'Standard assets' },
  { value: 'low', label: 'Low', color: 'green', description: 'Non-critical assets' },
]

// Asset categories
export const CATEGORY_OPTIONS = [
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'brand', label: 'Brand' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
]

// Match types
export const MATCH_TYPES = {
  ioc: { label: 'IOC Match', color: 'red', description: 'Asset found in IOC feed' },
  breach: { label: 'Breach', color: 'purple', description: 'Asset found in breach data' },
  certificate: { label: 'Certificate', color: 'blue', description: 'Certificate transparency match' },
  mention: { label: 'Mention', color: 'yellow', description: 'Asset mentioned in incident' },
}

// Match status options
export const MATCH_STATUSES = [
  { value: 'new', label: 'New', color: 'red' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'yellow' },
  { value: 'investigating', label: 'Investigating', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
  { value: 'false_positive', label: 'False Positive', color: 'gray' },
]

export const assets = {
  /**
   * Get all assets for a user
   */
  async getAll(userId, filters = {}) {
    let query = supabase
      .from('v_asset_summary')
      .select('*')
      .eq('user_id', userId)

    if (filters.assetType) {
      query = query.eq('asset_type', filters.assetType)
    }

    if (filters.criticality) {
      query = query.eq('criticality', filters.criticality)
    }

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.monitored !== undefined) {
      query = query.eq('is_monitored', filters.monitored)
    }

    if (filters.search) {
      query = query.or(`value.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
      .order('criticality', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error
    return data || []
  },

  /**
   * Get a single asset by ID
   */
  async getById(assetId, userId) {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new asset
   */
  async create(userId, assetData) {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        asset_type: assetData.assetType,
        value: assetData.value.toLowerCase().trim(),
        name: assetData.name,
        description: assetData.description,
        tags: assetData.tags || [],
        criticality: assetData.criticality || 'medium',
        category: assetData.category,
        is_monitored: assetData.isMonitored !== false,
        notify_on_match: assetData.notifyOnMatch !== false,
        team_id: assetData.teamId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create multiple assets at once
   */
  async createBulk(userId, assetsData) {
    const records = assetsData.map(asset => ({
      user_id: userId,
      asset_type: asset.assetType,
      value: asset.value.toLowerCase().trim(),
      name: asset.name,
      description: asset.description,
      tags: asset.tags || [],
      criticality: asset.criticality || 'medium',
      category: asset.category,
      is_monitored: asset.isMonitored !== false,
      notify_on_match: asset.notifyOnMatch !== false,
      team_id: asset.teamId,
    }))

    const { data, error } = await supabase
      .from('assets')
      .upsert(records, {
        onConflict: 'user_id,asset_type,value',
        ignoreDuplicates: false
      })
      .select()

    if (error) throw error
    return data || []
  },

  /**
   * Update an asset
   */
  async update(assetId, userId, updates) {
    const updateData = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.criticality !== undefined) updateData.criticality = updates.criticality
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.isMonitored !== undefined) updateData.is_monitored = updates.isMonitored
    if (updates.notifyOnMatch !== undefined) updateData.notify_on_match = updates.notifyOnMatch

    const { data, error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete an asset
   */
  async delete(assetId, userId) {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Delete multiple assets
   */
  async deleteBulk(assetIds, userId) {
    const { error } = await supabase
      .from('assets')
      .delete()
      .in('id', assetIds)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Toggle monitoring for an asset
   */
  async toggleMonitoring(assetId, userId, enabled) {
    const { data, error } = await supabase
      .from('assets')
      .update({ is_monitored: enabled })
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get asset stats for a user
   */
  async getStats(userId) {
    const { data, error } = await supabase
      .from('assets')
      .select('asset_type, criticality, is_monitored, match_count')
      .eq('user_id', userId)

    if (error) throw error

    const stats = {
      total: 0,
      monitored: 0,
      withMatches: 0,
      byType: {},
      byCriticality: { critical: 0, high: 0, medium: 0, low: 0 },
    }

    for (const asset of data || []) {
      stats.total++
      if (asset.is_monitored) stats.monitored++
      if (asset.match_count > 0) stats.withMatches++
      stats.byType[asset.asset_type] = (stats.byType[asset.asset_type] || 0) + 1
      stats.byCriticality[asset.criticality] = (stats.byCriticality[asset.criticality] || 0) + 1
    }

    return stats
  },
}

export const assetMatches = {
  /**
   * Get all matches for a user
   */
  async getAll(userId, filters = {}) {
    let query = supabase
      .from('v_recent_matches')
      .select('*')
      .eq('user_id', userId)

    if (filters.assetId) {
      query = query.eq('asset_id', filters.assetId)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    if (filters.matchType) {
      query = query.eq('match_type', filters.matchType)
    }

    const { data, error } = await query
      .order('matched_at', { ascending: false })
      .limit(filters.limit || 100)

    if (error) throw error
    return data || []
  },

  /**
   * Get matches for a specific asset
   */
  async getForAsset(assetId, userId) {
    const { data, error } = await supabase
      .from('asset_matches')
      .select('*')
      .eq('asset_id', assetId)
      .eq('user_id', userId)
      .order('matched_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data || []
  },

  /**
   * Record a new match
   */
  async create(userId, matchData) {
    const { data, error } = await supabase
      .from('asset_matches')
      .insert({
        asset_id: matchData.assetId,
        user_id: userId,
        match_type: matchData.matchType,
        source_table: matchData.sourceTable,
        source_id: matchData.sourceId,
        matched_value: matchData.matchedValue,
        context: matchData.context || {},
        severity: matchData.severity || 'medium',
      })
      .select()
      .single()

    if (error) throw error

    // Update asset match count
    await supabase.rpc('increment_asset_match_count', { asset_uuid: matchData.assetId })

    return data
  },

  /**
   * Update match status
   */
  async updateStatus(matchId, userId, status, notes = null) {
    const updateData = {
      status,
      resolution_notes: notes,
    }

    if (status === 'resolved' || status === 'false_positive') {
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = userId
    }

    const { data, error } = await supabase
      .from('asset_matches')
      .update(updateData)
      .eq('id', matchId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get match stats for a user
   */
  async getStats(userId, days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('asset_matches')
      .select('status, severity, match_type, matched_at')
      .eq('user_id', userId)
      .gte('matched_at', since.toISOString())

    if (error) throw error

    const stats = {
      total: 0,
      byStatus: { new: 0, acknowledged: 0, investigating: 0, resolved: 0, false_positive: 0 },
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      byType: {},
    }

    for (const match of data || []) {
      stats.total++
      stats.byStatus[match.status] = (stats.byStatus[match.status] || 0) + 1
      stats.bySeverity[match.severity] = (stats.bySeverity[match.severity] || 0) + 1
      stats.byType[match.match_type] = (stats.byType[match.match_type] || 0) + 1
    }

    return stats
  },
}

export const assetGroups = {
  /**
   * Get all groups for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('asset_groups')
      .select(`
        *,
        asset_group_members (
          asset_id
        )
      `)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error

    return (data || []).map(group => ({
      ...group,
      assetCount: group.asset_group_members?.length || 0,
    }))
  },

  /**
   * Create a new group
   */
  async create(userId, name, description = null, color = null) {
    const { data, error } = await supabase
      .from('asset_groups')
      .insert({
        user_id: userId,
        name,
        description,
        color,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a group
   */
  async delete(groupId, userId) {
    const { error } = await supabase
      .from('asset_groups')
      .delete()
      .eq('id', groupId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Add an asset to a group
   */
  async addAsset(groupId, assetId) {
    const { error } = await supabase
      .from('asset_group_members')
      .insert({ group_id: groupId, asset_id: assetId })

    if (error && !error.message.includes('duplicate')) throw error
  },

  /**
   * Remove an asset from a group
   */
  async removeAsset(groupId, assetId) {
    const { error } = await supabase
      .from('asset_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('asset_id', assetId)

    if (error) throw error
  },
}

// Utility functions
export function validateAssetValue(type, value) {
  const v = value.trim().toLowerCase()

  switch (type) {
    case 'domain':
    case 'email_domain':
      // Basic domain validation
      return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(v)

    case 'ip':
      // IPv4 validation
      return /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v)

    case 'ip_range':
      // CIDR validation
      return /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|[1-2][0-9]|3[0-2])$/.test(v)

    case 'keyword':
    case 'executive':
      // Just check for minimum length
      return v.length >= 2

    default:
      return false
  }
}

export function parseAssetsFromText(text, defaultType = 'domain') {
  const lines = text.split(/[\n,;]/).filter(Boolean)
  const parsed = []

  for (const line of lines) {
    const value = line.trim().toLowerCase()
    if (!value) continue

    // Try to detect type
    let type = defaultType
    if (/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)) {
      type = 'ip'
    } else if (/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/\d+$/.test(value)) {
      type = 'ip_range'
    } else if (/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(value)) {
      type = 'domain'
    }

    if (validateAssetValue(type, value)) {
      parsed.push({ value, type })
    }
  }

  return parsed
}

export default assets
