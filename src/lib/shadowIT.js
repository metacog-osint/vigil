/**
 * Shadow IT Detection Module
 *
 * Tracks and manages unauthorized/unknown IT assets and services.
 * Helps organizations identify and mitigate shadow IT risks.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const ASSET_TYPES = {
  DOMAIN: 'domain',
  SUBDOMAIN: 'subdomain',
  IP_ADDRESS: 'ip_address',
  CLOUD_SERVICE: 'cloud_service',
  SAAS_APPLICATION: 'saas_application',
  API_ENDPOINT: 'api_endpoint',
  SERVER: 'server',
  DEVICE: 'device',
  OTHER: 'other',
}

export const DISCOVERY_SOURCES = {
  DNS_QUERY: 'dns_query',
  CERTIFICATE_TRANSPARENCY: 'certificate_transparency',
  NETWORK_SCAN: 'network_scan',
  CLOUD_AUDIT: 'cloud_audit',
  TRAFFIC_ANALYSIS: 'traffic_analysis',
  THIRD_PARTY: 'third_party_integration',
  MANUAL: 'manual',
}

export const STATUS = {
  UNREVIEWED: 'unreviewed',
  APPROVED: 'approved',
  SHADOW_IT: 'shadow_it',
  BLOCKED: 'blocked',
  RETIRED: 'retired',
}

export const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
}

export const SERVICE_CATEGORIES = {
  STORAGE: 'storage',
  COMMUNICATION: 'communication',
  PRODUCTIVITY: 'productivity',
  DEVELOPMENT: 'development',
  CLOUD_HOSTING: 'cloud_hosting',
  CLOUD_INFRASTRUCTURE: 'cloud_infrastructure',
  VIDEO_CONFERENCING: 'video_conferencing',
  FILE_TRANSFER: 'file_transfer',
  UTILITY: 'utility',
  TUNNELING: 'tunneling',
  VPN: 'vpn',
}

// ============================================
// DISCOVERED ASSETS
// ============================================

export const discoveredAssets = {
  /**
   * Get all discovered assets for a team
   */
  async getAll(teamId, options = {}) {
    const { status, riskLevel, assetType, limit = 100, offset = 0 } = options

    let query = supabase
      .from('discovered_assets')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId)
      .order('discovered_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }
    if (riskLevel) {
      query = query.eq('risk_level', riskLevel)
    }
    if (assetType) {
      query = query.eq('asset_type', assetType)
    }

    const { data, count, error } = await query

    return { data, count, error }
  },

  /**
   * Get a single discovered asset
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('discovered_assets')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Record a new discovered asset
   */
  async record(teamId, asset) {
    const { data, error } = await supabase.rpc('record_discovered_asset', {
      p_team_id: teamId,
      p_asset_type: asset.assetType,
      p_value: asset.value,
      p_source: asset.source,
      p_metadata: asset.metadata || {},
    })

    return { data, error }
  },

  /**
   * Update asset status
   */
  async updateStatus(id, status, userId, notes = null) {
    const updates = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'approved' || status === 'shadow_it' || status === 'blocked') {
      updates.reviewed_at = new Date().toISOString()
      updates.reviewed_by = userId
      updates.review_notes = notes
    }

    const { data, error } = await supabase
      .from('discovered_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Bulk update asset status
   */
  async bulkUpdateStatus(ids, status, userId, notes = null) {
    const updates = {
      status,
      updated_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      review_notes: notes,
    }

    const { data, error } = await supabase
      .from('discovered_assets')
      .update(updates)
      .in('id', ids)
      .select()

    return { data, error }
  },

  /**
   * Delete a discovered asset
   */
  async delete(id) {
    const { error } = await supabase.from('discovered_assets').delete().eq('id', id)

    return { error }
  },

  /**
   * Get shadow IT summary for a team
   */
  async getSummary(teamId) {
    const { data, error } = await supabase.rpc('get_shadow_it_summary', {
      p_team_id: teamId,
    })

    return { data, error }
  },

  /**
   * Search discovered assets
   */
  async search(teamId, query) {
    const { data, error } = await supabase
      .from('discovered_assets')
      .select('*')
      .eq('team_id', teamId)
      .or(`value.ilike.%${query}%,hostname.ilike.%${query}%,vendor.ilike.%${query}%`)
      .order('last_seen', { ascending: false })
      .limit(50)

    return { data, error }
  },
}

// ============================================
// SHADOW IT RULES
// ============================================

export const shadowITRules = {
  /**
   * Get all rules for a team
   */
  async getAll(teamId) {
    const { data, error } = await supabase
      .from('shadow_it_rules')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  /**
   * Create a new rule
   */
  async create(teamId, rule) {
    const { data, error } = await supabase
      .from('shadow_it_rules')
      .insert({
        team_id: teamId,
        name: rule.name,
        description: rule.description,
        rule_type: rule.ruleType,
        pattern: rule.pattern,
        cloud_services: rule.cloudServices,
        ports: rule.ports,
        action: rule.action || 'alert',
        risk_level: rule.riskLevel || 'medium',
        enabled: rule.enabled ?? true,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update a rule
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('shadow_it_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a rule
   */
  async delete(id) {
    const { error } = await supabase.from('shadow_it_rules').delete().eq('id', id)

    return { error }
  },

  /**
   * Toggle rule enabled status
   */
  async toggle(id, enabled) {
    const { data, error } = await supabase
      .from('shadow_it_rules')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },
}

// ============================================
// SHADOW IT ALERTS
// ============================================

export const shadowITAlerts = {
  /**
   * Get alerts for a team
   */
  async getAll(teamId, options = {}) {
    const { status, limit = 50 } = options

    let query = supabase
      .from('shadow_it_alerts')
      .select(
        `
        *,
        discovered_asset:discovered_assets(*),
        rule:shadow_it_rules(*)
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Update alert status
   */
  async updateStatus(id, status, userId, notes = null) {
    const updates = {
      status,
    }

    if (status === 'resolved' || status === 'false_positive') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = userId
      updates.resolution_notes = notes
    }

    const { data, error } = await supabase
      .from('shadow_it_alerts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Get open alert count
   */
  async getOpenCount(teamId) {
    const { count, error } = await supabase
      .from('shadow_it_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'open')

    return { count, error }
  },
}

// ============================================
// APPROVED SERVICES
// ============================================

export const approvedServices = {
  /**
   * Get all approved services for a team
   */
  async getAll(teamId) {
    const { data, error } = await supabase
      .from('approved_services')
      .select('*')
      .eq('team_id', teamId)
      .order('approved_at', { ascending: false })

    return { data, error }
  },

  /**
   * Add an approved service
   */
  async add(teamId, service, userId) {
    const { data, error } = await supabase
      .from('approved_services')
      .insert({
        team_id: teamId,
        service_name: service.name,
        service_type: service.type,
        domains: service.domains,
        approved_by: userId,
        expiry_date: service.expiryDate,
        business_justification: service.justification,
        data_classification: service.dataClassification,
        compliance_requirements: service.complianceRequirements,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Remove an approved service
   */
  async remove(id) {
    const { error } = await supabase.from('approved_services').delete().eq('id', id)

    return { error }
  },

  /**
   * Check if a service is approved
   */
  async isApproved(teamId, serviceName) {
    const { data, error } = await supabase
      .from('approved_services')
      .select('id')
      .eq('team_id', teamId)
      .ilike('service_name', `%${serviceName}%`)
      .or(`expiry_date.is.null,expiry_date.gt.${new Date().toISOString()}`)
      .limit(1)

    return { isApproved: data && data.length > 0, error }
  },
}

// ============================================
// KNOWN CLOUD SERVICES
// ============================================

export const knownServices = {
  /**
   * Get all known cloud services
   */
  async getAll(options = {}) {
    const { category, isSanctioned } = options

    let query = supabase.from('known_cloud_services').select('*').order('name')

    if (category) {
      query = query.eq('category', category)
    }
    if (isSanctioned !== undefined) {
      query = query.eq('is_sanctioned', isSanctioned)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Search for a service by domain
   */
  async findByDomain(domain) {
    const { data, error } = await supabase
      .from('known_cloud_services')
      .select('*')
      .contains('domains', [domain])

    return { data: data?.[0] || null, error }
  },

  /**
   * Get services by category
   */
  async getByCategory(category) {
    const { data, error } = await supabase
      .from('known_cloud_services')
      .select('*')
      .eq('category', category)
      .order('name')

    return { data, error }
  },

  /**
   * Get high-risk services
   */
  async getHighRisk() {
    const { data, error } = await supabase
      .from('known_cloud_services')
      .select('*')
      .in('risk_level', ['critical', 'high'])
      .order('risk_level')

    return { data, error }
  },
}

// ============================================
// DETECTION HELPERS
// ============================================

/**
 * Analyze a URL/domain for shadow IT
 */
export async function analyzeForShadowIT(teamId, value) {
  // Extract domain from URL if needed
  let domain = value
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    domain = url.hostname
  } catch {
    // Value is likely already a domain
  }

  // Check against known services
  const { data: knownService } = await knownServices.findByDomain(domain)

  // Check if approved
  const { isApproved } = await approvedServices.isApproved(teamId, domain)

  // Run the database check
  const { data: checkResult, error } = await supabase.rpc('check_shadow_it', {
    p_team_id: teamId,
    p_value: domain,
    p_asset_type: 'domain',
  })

  if (error) {
    console.error('Error checking shadow IT:', error)
    return null
  }

  const result = checkResult?.[0] || { is_shadow_it: false, risk_level: 'unknown' }

  return {
    domain,
    isShadowIT: result.is_shadow_it,
    isApproved,
    riskLevel: result.risk_level,
    knownService: knownService
      ? {
          name: knownService.name,
          category: knownService.category,
          vendor: knownService.vendor,
          securityRating: knownService.security_rating,
          compliance: knownService.compliance_certifications,
        }
      : null,
    recommendation: result.is_shadow_it
      ? 'Review and either approve or block this service'
      : isApproved
        ? 'Service is approved for use'
        : 'Consider adding to approved services list',
  }
}

/**
 * Batch analyze multiple values
 */
export async function batchAnalyze(teamId, values) {
  const results = await Promise.all(values.map((v) => analyzeForShadowIT(teamId, v)))

  return results.filter(Boolean)
}

export default {
  discoveredAssets,
  shadowITRules,
  shadowITAlerts,
  approvedServices,
  knownServices,
  analyzeForShadowIT,
  batchAnalyze,
  ASSET_TYPES,
  DISCOVERY_SOURCES,
  STATUS,
  RISK_LEVELS,
  SERVICE_CATEGORIES,
}
