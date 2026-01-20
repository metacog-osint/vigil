/**
 * Vulnerabilities Module
 * Database queries for CVE and KEV vulnerability management
 */

import { supabase } from './client'

export const vulnerabilities = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', minCvss = null, kevOnly = false } = options

    let query = supabase
      .from('vulnerabilities')
      .select('*', { count: 'exact' })
      .order('cvss_score', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`cve_id.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (minCvss !== null) {
      query = query.gte('cvss_score', minCvss)
    }

    if (kevOnly) {
      query = query.not('kev_date', 'is', null)
    }

    return query
  },

  async getKEV(options = {}) {
    const { limit = 50, offset = 0, exploited = null } = options

    let query = supabase
      .from('vulnerabilities')
      .select('*', { count: 'exact' })
      .not('kev_date', 'is', null)
      .order('kev_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (exploited !== null) {
      query = query.eq('exploited_in_wild', exploited)
    }

    return query
  },

  async getByCVE(cveId) {
    return supabase.from('vulnerabilities').select('*').eq('cve_id', cveId).single()
  },

  async getCritical(minCvss = 9.0) {
    return supabase
      .from('vulnerabilities')
      .select('*')
      .gte('cvss_score', minCvss)
      .order('cvss_score', { ascending: false })
      .limit(50)
  },

  async getRecentKEV(days = 365) {
    let query = supabase
      .from('vulnerabilities')
      .select('*')
      .not('kev_date', 'is', null)
      .order('kev_date', { ascending: false })
      .limit(20)

    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('kev_date', cutoffDate.toISOString().split('T')[0])
    }

    return query
  },

  async search(query, limit = 10) {
    return supabase
      .from('vulnerabilities')
      .select('*')
      .or(`cve_id.ilike.%${query}%,description.ilike.%${query}%`)
      .order('cvss_score', { ascending: false })
      .limit(limit)
  },

  async getBySeverity() {
    const { data, error } = await supabase.from('vulnerabilities').select('cvss_score')

    if (error || !data || data.length === 0) {
      return [
        { name: 'Critical', value: 0, severity: 'critical' },
        { name: 'High', value: 0, severity: 'high' },
        { name: 'Medium', value: 0, severity: 'medium' },
        { name: 'Low', value: 0, severity: 'low' },
      ]
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
    for (const row of data) {
      if (row.cvss_score != null) {
        if (row.cvss_score >= 9.0) counts.critical++
        else if (row.cvss_score >= 7.0) counts.high++
        else if (row.cvss_score >= 4.0) counts.medium++
        else counts.low++
      } else if (row.severity) {
        const sev = row.severity.toLowerCase()
        if (sev === 'critical') counts.critical++
        else if (sev === 'high') counts.high++
        else if (sev === 'medium') counts.medium++
        else if (sev === 'low') counts.low++
        else counts.unknown++
      } else {
        counts.unknown++
      }
    }

    const result = [
      { name: 'Critical', value: counts.critical, severity: 'critical' },
      { name: 'High', value: counts.high, severity: 'high' },
      { name: 'Medium', value: counts.medium, severity: 'medium' },
      { name: 'Low', value: counts.low, severity: 'low' },
    ]

    if (counts.unknown > 0) {
      result.push({ name: 'Unknown', value: counts.unknown, severity: 'none' })
    }

    return result
  },

  async getActivelyExploited(days = 30, limit = 10) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data: kevs, error } = await supabase
      .from('vulnerabilities')
      .select('*')
      .not('kev_date', 'is', null)
      .order('kev_date', { ascending: false })
      .limit(limit * 2)

    if (error || !kevs) return []

    const { data: correlations } = await supabase
      .from('actor_vulnerabilities')
      .select(
        `
        cve_id,
        actor:threat_actors(id, name, actor_type)
      `
      )
      .in(
        'cve_id',
        kevs.map((k) => k.cve_id)
      )

    const actorMap = {}
    for (const corr of correlations || []) {
      if (!actorMap[corr.cve_id]) {
        actorMap[corr.cve_id] = []
      }
      if (corr.actor) {
        actorMap[corr.cve_id].push(corr.actor)
      }
    }

    const enriched = kevs.map((kev) => ({
      ...kev,
      actors: actorMap[kev.cve_id] || [],
      severity:
        kev.cvss_score >= 9
          ? 'critical'
          : kev.cvss_score >= 7
            ? 'high'
            : kev.cvss_score >= 4
              ? 'medium'
              : 'low',
    }))

    enriched.sort((a, b) => {
      if (a.actors.length > 0 && b.actors.length === 0) return -1
      if (b.actors.length > 0 && a.actors.length === 0) return 1
      if (a.ransomware_campaign_use && !b.ransomware_campaign_use) return -1
      if (b.ransomware_campaign_use && !a.ransomware_campaign_use) return 1
      return (b.cvss_score || 0) - (a.cvss_score || 0)
    })

    return enriched.slice(0, limit)
  },

  async getRecentForServices(days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('cve_id, affected_products, affected_vendors, description, cvss_score')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Error fetching vulnerabilities for services:', error)
      return []
    }

    return data || []
  },
}

export default vulnerabilities
