/**
 * Correlations Module
 * Linking actors, vulnerabilities, TTPs, and IOCs
 */

import { supabase } from './client'

export const correlations = {
  async getActorCorrelations(actorId) {
    const [techniques, vulnerabilities, iocData] = await Promise.all([
      // Get TTPs
      supabase
        .from('actor_techniques')
        .select(`
          *,
          technique:techniques(id, name, tactics, description)
        `)
        .eq('actor_id', actorId),

      // Get exploited vulnerabilities
      supabase
        .from('actor_vulnerabilities')
        .select(`
          *,
          vulnerability:vulnerabilities(cve_id, cvss_score, description, affected_products)
        `)
        .eq('actor_id', actorId),

      // Get IOCs
      supabase
        .from('iocs')
        .select('id, type, value, malware_family, confidence')
        .eq('actor_id', actorId)
        .limit(50)
    ])

    return {
      techniques: techniques.data || [],
      vulnerabilities: vulnerabilities.data || [],
      iocs: iocData.data || []
    }
  },

  async getAttackPath(actorId) {
    const correlationData = await this.getActorCorrelations(actorId)

    // Build graph structure for visualization
    const nodes = [
      { id: 'actor', type: 'actor', label: 'Actor' }
    ]
    const edges = []

    // Add technique nodes
    for (const t of correlationData.techniques) {
      const nodeId = `ttp-${t.technique_id}`
      nodes.push({
        id: nodeId,
        type: 'technique',
        label: t.technique?.name || t.technique_id,
        data: t.technique
      })
      edges.push({ from: 'actor', to: nodeId, label: 'uses' })
    }

    // Add vulnerability nodes
    for (const v of correlationData.vulnerabilities) {
      const nodeId = `cve-${v.cve_id}`
      nodes.push({
        id: nodeId,
        type: 'vulnerability',
        label: v.cve_id,
        data: v.vulnerability
      })
      edges.push({ from: 'actor', to: nodeId, label: 'exploits' })
    }

    // Add sample IOC nodes (limit to 10)
    for (const i of correlationData.iocs.slice(0, 10)) {
      const nodeId = `ioc-${i.id}`
      nodes.push({
        id: nodeId,
        type: 'ioc',
        label: i.value?.substring(0, 20) + (i.value?.length > 20 ? '...' : ''),
        data: i
      })
      edges.push({ from: 'actor', to: nodeId, label: 'associated' })
    }

    return { nodes, edges }
  },

  async getVulnActors(cveId) {
    return supabase
      .from('actor_vulnerabilities')
      .select(`
        *,
        actor:threat_actors(id, name, trend_status, target_sectors)
      `)
      .eq('cve_id', cveId)
  },

  async getTechniqueActors(techniqueId) {
    return supabase
      .from('actor_techniques')
      .select(`
        *,
        actor:threat_actors(id, name, trend_status)
      `)
      .eq('technique_id', techniqueId)
  },

  async linkActorVulnerability(actorId, cveId, confidence = 'medium', source = 'manual') {
    return supabase
      .from('actor_vulnerabilities')
      .upsert({
        actor_id: actorId,
        cve_id: cveId,
        confidence,
        source,
        first_seen: new Date().toISOString().split('T')[0]
      }, { onConflict: 'actor_id,cve_id' })
  },

  // ========================================
  // INDUSTRY THREAT LANDSCAPE
  // ========================================

  /**
   * Get threat landscape for a specific industry
   */
  async getIndustryThreats(industry) {
    return supabase
      .from('industry_threat_landscape')
      .select('*')
      .ilike('industry', `%${industry}%`)
      .order('event_count', { ascending: false })
  },

  /**
   * Get all industry threat summaries
   */
  async getAllIndustryThreats(limit = 50) {
    return supabase
      .from('industry_threat_landscape')
      .select('*')
      .order('event_count', { ascending: false })
      .limit(limit)
  },

  // ========================================
  // COUNTRY THREAT PROFILE
  // ========================================

  /**
   * Get threat profile for a specific country
   */
  async getCountryThreats(country) {
    return supabase
      .from('country_threat_profile')
      .select('*')
      .ilike('country', `%${country}%`)
  },

  /**
   * Get all country threat profiles
   */
  async getAllCountryThreats(limit = 50) {
    return supabase
      .from('country_threat_profile')
      .select('*')
      .order('total_events', { ascending: false })
      .limit(limit)
  },

  // ========================================
  // WEEKLY ACTIVITY TRENDS
  // ========================================

  /**
   * Get weekly activity trends for all data types
   */
  async getWeeklyTrends(weeks = 12) {
    const { data, error } = await supabase
      .from('weekly_activity_trends')
      .select('*')
      .order('week', { ascending: false })
      .limit(weeks * 3) // 3 data types per week

    if (error) return { data: null, error }

    // Group by data type
    const grouped = {
      iocs: [],
      incidents: [],
      cyber_events: []
    }

    for (const row of (data || [])) {
      if (grouped[row.data_type]) {
        grouped[row.data_type].push({
          week: row.week,
          count: row.count,
          prev_week: row.prev_week,
          change: row.prev_week ? ((row.count - row.prev_week) / row.prev_week * 100).toFixed(1) : null
        })
      }
    }

    return { data: grouped, error: null }
  },

  // ========================================
  // ACTOR ACTIVITY SUMMARY
  // ========================================

  /**
   * Get actor activity summary from cyber events
   */
  async getActorActivitySummary(limit = 50) {
    return supabase
      .from('actor_activity_summary')
      .select('*')
      .order('event_count', { ascending: false })
      .limit(limit)
  },

  /**
   * Get specific actor's activity summary
   */
  async getActorActivity(actorName) {
    return supabase
      .from('actor_activity_summary')
      .select('*')
      .ilike('actor_name', actorName)
  },

  // ========================================
  // ATTACK CHAINS
  // ========================================

  /**
   * Get attack chain for an actor
   */
  async getActorAttackChain(actorId) {
    return supabase
      .from('attack_chains')
      .select('*')
      .eq('actor_id', actorId)
      .single()
  },

  /**
   * Get all attack chains with filters
   */
  async getAttackChains({ sector, confidence, limit = 50 } = {}) {
    let query = supabase
      .from('attack_chains')
      .select('*')
      .order('created_at', { ascending: false })

    if (sector) {
      query = query.contains('target_sectors', [sector])
    }

    if (confidence) {
      query = query.eq('confidence', confidence)
    }

    return query.limit(limit)
  },

  /**
   * Search attack chains by CVE
   */
  async getAttackChainsByCVE(cveId) {
    return supabase
      .from('attack_chains')
      .select('*')
      .contains('vulnerabilities', [cveId])
  },

  /**
   * Search attack chains by technique
   */
  async getAttackChainsByTechnique(mitreId) {
    return supabase
      .from('attack_chains')
      .select('*')
      .contains('techniques', [mitreId])
  },

  // ========================================
  // ACTOR-IOC ATTRIBUTION
  // ========================================

  /**
   * Get IOCs attributed to an actor
   */
  async getActorIOCs(actorName, { type, limit = 100 } = {}) {
    let query = supabase
      .from('actor_iocs')
      .select('*')
      .ilike('actor_name', actorName)
      .order('last_seen', { ascending: false })

    if (type) {
      query = query.eq('ioc_type', type)
    }

    return query.limit(limit)
  },

  /**
   * Get actors associated with an IOC
   */
  async getIOCActors(iocValue) {
    return supabase
      .from('actor_iocs')
      .select('*')
      .eq('ioc_value', iocValue)
  },

  // ========================================
  // CROSS-REFERENCE QUERIES
  // ========================================

  /**
   * Get comprehensive actor dossier with all correlations
   */
  async getActorDossier(actorId) {
    const [
      actorData,
      techniques,
      vulnerabilities,
      iocs,
      attackChain,
      activitySummary
    ] = await Promise.all([
      supabase.from('threat_actors').select('*').eq('id', actorId).single(),
      supabase.from('actor_techniques').select('*, technique:techniques(*)').eq('actor_id', actorId),
      supabase.from('actor_vulnerabilities').select('*, vulnerability:vulnerabilities(*)').eq('actor_id', actorId),
      supabase.from('actor_iocs').select('*').eq('actor_id', actorId).limit(50),
      supabase.from('attack_chains').select('*').eq('actor_id', actorId).single(),
      supabase.from('actor_activity_summary').select('*').eq('actor_name', actorData?.data?.name)
    ])

    return {
      actor: actorData.data,
      techniques: techniques.data || [],
      vulnerabilities: vulnerabilities.data || [],
      iocs: iocs.data || [],
      attackChain: attackChain.data,
      activitySummary: activitySummary.data?.[0] || null,
      error: actorData.error
    }
  },

  /**
   * Refresh all correlation materialized views
   */
  async refreshViews() {
    return supabase.rpc('refresh_correlation_views')
  }
}

export default correlations
