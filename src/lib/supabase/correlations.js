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
  }
}

export default correlations
