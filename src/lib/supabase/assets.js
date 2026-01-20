/**
 * Asset Monitoring Module
 * Manages organization assets for attack surface monitoring
 */

import { supabase } from './client'

/**
 * Asset types for monitoring
 */
export const ASSET_TYPES = {
  domain: 'Domain',
  ip: 'IP Address',
  ip_range: 'IP Range (CIDR)',
  email_domain: 'Email Domain',
  keyword: 'Keyword',
  executive: 'Executive Name',
}

/**
 * Asset criticality levels
 */
export const CRITICALITY_LEVELS = ['critical', 'high', 'medium', 'low']

/**
 * Asset categories
 */
export const ASSET_CATEGORIES = ['infrastructure', 'brand', 'personnel', 'vendor', 'other']

/**
 * Match types
 */
export const MATCH_TYPES = {
  ioc: 'IOC Match',
  breach: 'Breach Detection',
  certificate: 'Certificate Issue',
  mention: 'Incident Mention',
}

/**
 * Match statuses
 */
export const MATCH_STATUSES = ['new', 'acknowledged', 'investigating', 'resolved', 'false_positive']

export const assets = {
  /**
   * Get all assets for a user
   */
  async getAll(userId, options = {}) {
    const { assetType, criticality, isMonitored, limit = 100 } = options

    let query = supabase
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (assetType) {
      query = query.eq('asset_type', assetType)
    }

    if (criticality) {
      query = query.eq('criticality', criticality)
    }

    if (typeof isMonitored === 'boolean') {
      query = query.eq('is_monitored', isMonitored)
    }

    return query
  },

  /**
   * Get asset by ID
   */
  async getById(assetId) {
    return supabase.from('assets').select('*').eq('id', assetId).single()
  },

  /**
   * Get asset summary with match counts
   */
  async getSummary(userId) {
    return supabase
      .from('v_asset_summary')
      .select('*')
      .eq('user_id', userId)
      .order('new_matches', { ascending: false })
  },

  /**
   * Create a new asset
   */
  async create(userId, asset) {
    return supabase
      .from('assets')
      .insert({
        user_id: userId,
        asset_type: asset.assetType,
        value: asset.value,
        name: asset.name || null,
        description: asset.description || null,
        tags: asset.tags || [],
        criticality: asset.criticality || 'medium',
        category: asset.category || null,
        is_monitored: asset.isMonitored !== false,
        notify_on_match: asset.notifyOnMatch !== false,
      })
      .select()
      .single()
  },

  /**
   * Update an asset
   */
  async update(assetId, updates) {
    const updateData = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.criticality !== undefined) updateData.criticality = updates.criticality
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.isMonitored !== undefined) updateData.is_monitored = updates.isMonitored
    if (updates.notifyOnMatch !== undefined) updateData.notify_on_match = updates.notifyOnMatch

    return supabase.from('assets').update(updateData).eq('id', assetId).select().single()
  },

  /**
   * Delete an asset
   */
  async delete(assetId) {
    return supabase.from('assets').delete().eq('id', assetId)
  },

  /**
   * Bulk import assets
   */
  async bulkImport(userId, assetList) {
    const records = assetList.map((asset) => ({
      user_id: userId,
      asset_type: asset.assetType,
      value: asset.value,
      name: asset.name || null,
      description: asset.description || null,
      tags: asset.tags || [],
      criticality: asset.criticality || 'medium',
      category: asset.category || null,
      is_monitored: true,
      notify_on_match: true,
    }))

    return supabase.from('assets').upsert(records, {
      onConflict: 'user_id,asset_type,value',
      ignoreDuplicates: false,
    })
  },

  /**
   * Get asset statistics
   */
  async getStats(userId) {
    const { data: allAssets, error } = await this.getAll(userId, { limit: 1000 })

    if (error || !allAssets) {
      return {
        total: 0,
        byType: {},
        byCriticality: {},
        monitored: 0,
        withMatches: 0,
      }
    }

    return {
      total: allAssets.length,
      byType: allAssets.reduce((acc, a) => {
        acc[a.asset_type] = (acc[a.asset_type] || 0) + 1
        return acc
      }, {}),
      byCriticality: allAssets.reduce((acc, a) => {
        acc[a.criticality] = (acc[a.criticality] || 0) + 1
        return acc
      }, {}),
      monitored: allAssets.filter((a) => a.is_monitored).length,
      withMatches: allAssets.filter((a) => a.match_count > 0).length,
    }
  },
}

export const assetMatches = {
  /**
   * Get matches for a user
   */
  async getAll(userId, options = {}) {
    const { status, severity, assetId, matchType, limit = 100 } = options

    let query = supabase.from('v_recent_matches').select('*').eq('user_id', userId).limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (assetId) {
      query = query.eq('asset_id', assetId)
    }

    if (matchType) {
      query = query.eq('match_type', matchType)
    }

    return query
  },

  /**
   * Get new (unacknowledged) matches count
   */
  async getNewCount(userId) {
    const { count, error } = await supabase
      .from('asset_matches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'new')

    return { count: count || 0, error }
  },

  /**
   * Update match status
   */
  async updateStatus(matchId, status, notes = null, resolvedBy = null) {
    const updateData = { status }

    if (status === 'resolved' || status === 'false_positive') {
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = resolvedBy
      updateData.resolution_notes = notes
    }

    return supabase.from('asset_matches').update(updateData).eq('id', matchId).select().single()
  },

  /**
   * Bulk acknowledge matches
   */
  async bulkAcknowledge(matchIds) {
    return supabase.from('asset_matches').update({ status: 'acknowledged' }).in('id', matchIds)
  },

  /**
   * Create a new match (for testing or manual entry)
   */
  async create(match) {
    return supabase
      .from('asset_matches')
      .insert({
        asset_id: match.assetId,
        user_id: match.userId,
        match_type: match.matchType,
        source_table: match.sourceTable,
        source_id: match.sourceId || null,
        matched_value: match.matchedValue,
        context: match.context || {},
        severity: match.severity || 'medium',
        status: 'new',
      })
      .select()
      .single()
  },

  /**
   * Get match statistics
   */
  async getStats(userId) {
    const { data, error } = await supabase
      .from('asset_matches')
      .select('status, severity, match_type')
      .eq('user_id', userId)

    if (error || !data) {
      return {
        total: 0,
        byStatus: {},
        bySeverity: {},
        byType: {},
      }
    }

    return {
      total: data.length,
      byStatus: data.reduce((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1
        return acc
      }, {}),
      bySeverity: data.reduce((acc, m) => {
        acc[m.severity] = (acc[m.severity] || 0) + 1
        return acc
      }, {}),
      byType: data.reduce((acc, m) => {
        acc[m.match_type] = (acc[m.match_type] || 0) + 1
        return acc
      }, {}),
    }
  },
}

export const assetGroups = {
  /**
   * Get all asset groups for a user
   */
  async getAll(userId) {
    return supabase
      .from('asset_groups')
      .select(
        `
        *,
        asset_group_members (
          asset_id
        )
      `
      )
      .eq('user_id', userId)
      .order('name')
  },

  /**
   * Create a new asset group
   */
  async create(userId, group) {
    return supabase
      .from('asset_groups')
      .insert({
        user_id: userId,
        name: group.name,
        description: group.description || null,
        color: group.color || null,
      })
      .select()
      .single()
  },

  /**
   * Update an asset group
   */
  async update(groupId, updates) {
    return supabase.from('asset_groups').update(updates).eq('id', groupId).select().single()
  },

  /**
   * Delete an asset group
   */
  async delete(groupId) {
    return supabase.from('asset_groups').delete().eq('id', groupId)
  },

  /**
   * Add asset to group
   */
  async addAsset(groupId, assetId) {
    return supabase.from('asset_group_members').insert({
      group_id: groupId,
      asset_id: assetId,
    })
  },

  /**
   * Remove asset from group
   */
  async removeAsset(groupId, assetId) {
    return supabase
      .from('asset_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('asset_id', assetId)
  },
}

/**
 * Check assets against IOC feed
 * Returns matching IOCs for user's monitored assets
 */
export async function checkAssetsAgainstIOCs(userId) {
  // Get user's monitored assets
  const { data: userAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id, asset_type, value, criticality')
    .eq('user_id', userId)
    .eq('is_monitored', true)

  if (assetsError || !userAssets?.length) {
    return { matches: [], error: assetsError }
  }

  const matches = []

  // Check domains and IPs against IOCs
  for (const asset of userAssets) {
    let iocQuery = supabase.from('iocs').select('*')

    if (asset.asset_type === 'domain' || asset.asset_type === 'email_domain') {
      // Check if domain appears in IOC value
      iocQuery = iocQuery.or(`value.ilike.%${asset.value}%,value.eq.${asset.value}`)
    } else if (asset.asset_type === 'ip') {
      // Exact IP match
      iocQuery = iocQuery.eq('value', asset.value)
    } else if (asset.asset_type === 'keyword') {
      // Keyword search in IOC values and metadata
      iocQuery = iocQuery.ilike('value', `%${asset.value}%`)
    }

    const { data: iocMatches } = await iocQuery.limit(50)

    if (iocMatches?.length) {
      for (const ioc of iocMatches) {
        matches.push({
          asset,
          ioc,
          matchType: 'ioc',
          severity:
            asset.criticality === 'critical'
              ? 'critical'
              : asset.criticality === 'high'
                ? 'high'
                : 'medium',
        })
      }
    }
  }

  return { matches, error: null }
}

/**
 * Run asset monitoring and create matches
 */
export async function runAssetMonitoring(userId) {
  const { matches, error } = await checkAssetsAgainstIOCs(userId)

  if (error) {
    return { created: 0, error }
  }

  if (!matches.length) {
    return { created: 0, error: null }
  }

  // Create match records for new findings
  let created = 0

  for (const match of matches) {
    // Check if this match already exists
    const { data: existing } = await supabase
      .from('asset_matches')
      .select('id')
      .eq('asset_id', match.asset.id)
      .eq('source_table', 'iocs')
      .eq('source_id', match.ioc.id)
      .single()

    if (!existing) {
      const { error: insertError } = await supabase.from('asset_matches').insert({
        asset_id: match.asset.id,
        user_id: userId,
        match_type: match.matchType,
        source_table: 'iocs',
        source_id: match.ioc.id,
        matched_value: match.ioc.value,
        context: {
          ioc_type: match.ioc.ioc_type,
          threat_type: match.ioc.threat_type,
          confidence: match.ioc.confidence,
          source: match.ioc.source,
        },
        severity: match.severity,
        status: 'new',
      })

      if (!insertError) {
        created++

        // Update asset match count
        await supabase.rpc('increment_asset_match_count', {
          p_asset_id: match.asset.id,
        })
      }
    }
  }

  return { created, total: matches.length, error: null }
}
