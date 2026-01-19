/**
 * Supabase Query Functions
 *
 * IMPORTANT: This file imports the Supabase client from ./supabase/client.js
 * DO NOT create a new client here - that causes "Multiple GoTrueClient instances" warnings.
 * All Supabase client creation should happen in ONE place: src/lib/supabase/client.js
 */

import { supabase, subscribeToTable } from './supabase/client'
import { logger } from './logger'

// Re-export the centralized client and subscription helper
export { supabase, subscribeToTable }

// Threat Actors queries
export const threatActors = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', sector = '', trendStatus = '', actorType = '', status = '' } = options

    let query = supabase
      .from('threat_actors')
      .select('*', { count: 'exact' })
      .order('incident_velocity', { ascending: false, nullsFirst: true })
      .order('last_seen', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,aliases.cs.{${search}}`)
    }

    if (sector) {
      query = query.contains('target_sectors', [sector])
    }

    if (trendStatus) {
      query = query.eq('trend_status', trendStatus)
    }

    if (actorType) {
      // Case-insensitive filter for actor type
      query = query.ilike('actor_type', actorType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    return query
  },

  async getById(id) {
    return supabase
      .from('threat_actors')
      .select(`
        *,
        incidents:incidents(count),
        iocs:iocs(count)
      `)
      .eq('id', id)
      .single()
  },

  async getTopActive(days = 30, limit = 10) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get incident counts per actor for the time period
    const { data: incidentCounts, error: countError } = await supabase
      .from('incidents')
      .select('actor_id')
      .gte('discovered_date', cutoffDate.toISOString().split('T')[0])

    if (countError || !incidentCounts) {
      // Fallback to old query
      return supabase
        .from('threat_actors')
        .select('*')
        .gte('last_seen', cutoffDate.toISOString())
        .limit(limit)
    }

    // Count incidents per actor
    const actorCounts = {}
    for (const inc of incidentCounts) {
      if (inc.actor_id) {
        actorCounts[inc.actor_id] = (actorCounts[inc.actor_id] || 0) + 1
      }
    }

    // Sort by count and get top actor IDs
    const topActorIds = Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    if (topActorIds.length === 0) {
      return { data: [], error: null }
    }

    // Fetch actor details
    const { data: actors, error } = await supabase
      .from('threat_actors')
      .select('*')
      .in('id', topActorIds)

    if (error || !actors) {
      return { data: [], error }
    }

    // Add incident counts and sort
    const actorsWithCounts = actors.map(actor => ({
      ...actor,
      incident_count: [{ count: actorCounts[actor.id] || 0 }],
    })).sort((a, b) => (b.incident_count[0]?.count || 0) - (a.incident_count[0]?.count || 0))

    return { data: actorsWithCounts, error: null }
  },

  async getEscalating(limit = 10) {
    return supabase
      .from('threat_actors')
      .select('*')
      .eq('trend_status', 'ESCALATING')
      .order('incident_velocity', { ascending: false })
      .limit(limit)
  },

  async getTrendSummary() {
    const [escalating, stable, declining] = await Promise.all([
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'ESCALATING'),
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'STABLE'),
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'DECLINING'),
    ])

    return {
      escalating: escalating.count || 0,
      stable: stable.count || 0,
      declining: declining.count || 0,
    }
  },
}

// Incidents queries
export const incidents = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', sector = '', status = '', actor_id = '', days = 0 } = options

    let query = supabase
      .from('incidents')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `, { count: 'exact' })
      .order('discovered_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Date filter (0 = all time)
    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('discovered_date', cutoffDate.toISOString())
    }

    if (search) {
      // Search victim name or actor name via joined table
      query = query.or(`victim_name.ilike.%${search}%,victim_sector.ilike.%${search}%`)
    }

    if (sector) {
      query = query.eq('victim_sector', sector)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (actor_id) {
      query = query.eq('actor_id', actor_id)
    }

    return query
  },

  async getRecent(options = {}) {
    const { limit = 50, offset = 0, actor_id = '', sector = '', days = 30 } = options

    let query = supabase
      .from('incidents')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `, { count: 'exact' })
      .order('discovered_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Only apply date filter if days > 0 (0 means all time)
    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('discovered_date', cutoffDate.toISOString())
    }

    if (actor_id) {
      query = query.eq('actor_id', actor_id)
    }

    if (sector) {
      query = query.eq('victim_sector', sector)
    }

    return query
  },

  async getStats(days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return supabase
      .from('incidents')
      .select('victim_sector, discovered_date')
      .gte('discovered_date', cutoffDate.toISOString())
  },

  async getBySector(days = 365) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Fetch incidents and aggregate by sector
    const { data, error } = await supabase
      .from('incidents')
      .select('victim_sector')
      .gte('discovered_date', cutoffDate.toISOString())

    if (error || !data) return []

    // Count by sector
    const counts = {}
    for (const row of data) {
      const sector = row.victim_sector || 'Unknown'
      counts[sector] = (counts[sector] || 0) + 1
    }

    // Convert to array format for charts
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  },

  async search(query, limit = 10) {
    return supabase
      .from('incidents')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `)
      .or(`victim_name.ilike.%${query}%,victim_sector.ilike.%${query}%`)
      .order('discovered_date', { ascending: false })
      .limit(limit)
  },

  async getDailyCounts(days = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error } = await supabase
      .from('incidents')
      .select('discovered_date')
      .gte('discovered_date', cutoffDate.toISOString().split('T')[0])

    if (error || !data) return []

    // Count by date
    const counts = {}
    for (const row of data) {
      const date = row.discovered_date?.split('T')[0]
      if (date) {
        counts[date] = (counts[date] || 0) + 1
      }
    }

    // Convert to array format for calendar
    return Object.entries(counts).map(([date, count]) => ({ date, count }))
  },

  // Get detailed sector data with top actors and recent incidents (for SectorDrilldown)
  async getSectorDetails(days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const prevCutoff = new Date()
    prevCutoff.setDate(prevCutoff.getDate() - (days * 2))

    // Get current period incidents with actor info
    const { data: currentData, error } = await supabase
      .from('incidents')
      .select(`
        id,
        victim_name,
        victim_sector,
        discovered_date,
        threat_actor:threat_actors(id, name)
      `)
      .gte('discovered_date', cutoffDate.toISOString())
      .order('discovered_date', { ascending: false })

    if (error || !currentData) return []

    // Get previous period for trend calculation
    const { data: prevData } = await supabase
      .from('incidents')
      .select('victim_sector')
      .gte('discovered_date', prevCutoff.toISOString())
      .lt('discovered_date', cutoffDate.toISOString())

    const prevCounts = {}
    for (const row of prevData || []) {
      const sector = row.victim_sector || 'Unknown'
      prevCounts[sector] = (prevCounts[sector] || 0) + 1
    }

    // Aggregate by sector
    const sectorMap = {}
    for (const incident of currentData) {
      const sector = incident.victim_sector || 'Unknown'
      if (!sectorMap[sector]) {
        sectorMap[sector] = {
          name: sector,
          count: 0,
          actorCounts: {},
          recentIncidents: []
        }
      }
      sectorMap[sector].count++

      // Track actor activity
      const actorName = incident.threat_actor?.name || 'Unknown'
      sectorMap[sector].actorCounts[actorName] = (sectorMap[sector].actorCounts[actorName] || 0) + 1

      // Keep recent incidents
      if (sectorMap[sector].recentIncidents.length < 5) {
        sectorMap[sector].recentIncidents.push(incident)
      }
    }

    // Convert to array with top actors and trend
    return Object.values(sectorMap)
      .map(sector => ({
        name: sector.name,
        count: sector.count,
        recentIncidents: sector.recentIncidents,
        topActors: Object.entries(sector.actorCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        trend: prevCounts[sector.name]
          ? Math.round(((sector.count - prevCounts[sector.name]) / prevCounts[sector.name]) * 100)
          : null
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  },
}

// IOCs queries
export const iocs = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, type = '', search = '', confidence = '' } = options

    let query = supabase
      .from('iocs')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `, { count: 'exact' })
      .order('last_seen', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    if (search) {
      query = query.ilike('value', `%${search}%`)
    }

    if (confidence) {
      query = query.eq('confidence', confidence)
    }

    return query
  },

  async search(value, type = null) {
    let query = supabase
      .from('iocs')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `)
      .ilike('value', `%${value}%`)
      .order('last_seen', { ascending: false })
      .limit(100)

    if (type) {
      query = query.eq('type', type)
    }

    return query
  },

  async getByActor(actorId, limit = 50) {
    return supabase
      .from('iocs')
      .select('*')
      .eq('actor_id', actorId)
      .order('last_seen', { ascending: false })
      .limit(limit)
  },

  async getRecent(limit = 100) {
    return supabase
      .from('iocs')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  // Quick lookup for IOC enrichment
  async quickLookup(value) {
    const type = detectIOCType(value)

    const promises = [
      // Search IOCs
      supabase
        .from('iocs')
        .select(`
          *,
          threat_actor:threat_actors(id, name, trend_status)
        `)
        .or(`value.eq.${value},value.ilike.%${value}%`)
        .order('last_seen', { ascending: false })
        .limit(10),

      // Search malware samples
      supabase
        .from('malware_samples')
        .select('*')
        .or(`sha256.eq.${value},md5.eq.${value},sha1.eq.${value}`)
        .limit(5)
    ]

    // If looks like CVE, also search vulnerabilities
    if (/^CVE-\d{4}-\d+$/i.test(value)) {
      promises.push(
        supabase
          .from('vulnerabilities')
          .select('*')
          .ilike('cve_id', value)
          .limit(1)
      )
    }

    const results = await Promise.all(promises)

    return {
      iocs: results[0].data || [],
      malware: results[1].data || [],
      vulnerabilities: results[2]?.data || [],
      type,
      found: (results[0].data?.length > 0) || (results[1].data?.length > 0) || (results[2]?.data?.length > 0)
    }
  },

  // Get external enrichment links for an IOC
  getEnrichmentLinks(value, type) {
    const links = []

    switch (type) {
      case 'ip':
        links.push(
          { name: 'VirusTotal', url: `https://www.virustotal.com/gui/ip-address/${value}`, icon: 'virustotal' },
          { name: 'Shodan', url: `https://www.shodan.io/host/${value}`, icon: 'shodan' },
          { name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${value}`, icon: 'abuseipdb' },
          { name: 'Censys', url: `https://search.censys.io/hosts/${value}`, icon: 'censys' }
        )
        break
      case 'hash_sha256':
      case 'hash_md5':
      case 'hash_sha1':
      case 'hash':
        links.push(
          { name: 'VirusTotal', url: `https://www.virustotal.com/gui/file/${value}`, icon: 'virustotal' },
          { name: 'MalwareBazaar', url: `https://bazaar.abuse.ch/browse.php?search=${value}`, icon: 'malwarebazaar' },
          { name: 'Hybrid Analysis', url: `https://www.hybrid-analysis.com/search?query=${value}`, icon: 'hybrid' }
        )
        break
      case 'domain':
        links.push(
          { name: 'VirusTotal', url: `https://www.virustotal.com/gui/domain/${value}`, icon: 'virustotal' },
          { name: 'URLhaus', url: `https://urlhaus.abuse.ch/browse.php?search=${value}`, icon: 'urlhaus' },
          { name: 'Shodan', url: `https://www.shodan.io/search?query=hostname%3A${value}`, icon: 'shodan' }
        )
        break
      case 'url':
        const encoded = encodeURIComponent(value)
        links.push(
          { name: 'VirusTotal', url: `https://www.virustotal.com/gui/url/${encoded}`, icon: 'virustotal' },
          { name: 'URLhaus', url: `https://urlhaus.abuse.ch/browse.php?search=${encoded}`, icon: 'urlhaus' }
        )
        break
      case 'cve':
        links.push(
          { name: 'NVD', url: `https://nvd.nist.gov/vuln/detail/${value}`, icon: 'nvd' },
          { name: 'CISA KEV', url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`, icon: 'cisa' },
          { name: 'CVE.org', url: `https://www.cve.org/CVERecord?id=${value}`, icon: 'cve' },
          { name: 'Exploit-DB', url: `https://www.exploit-db.com/search?cve=${value}`, icon: 'exploitdb' }
        )
        break
      default:
        // Generic search
        links.push(
          { name: 'VirusTotal', url: `https://www.virustotal.com/gui/search/${encodeURIComponent(value)}`, icon: 'virustotal' }
        )
    }

    return links
  },
}

// Helper to detect IOC type
function detectIOCType(value) {
  if (!value) return 'unknown'

  // CVE pattern
  if (/^CVE-\d{4}-\d+$/i.test(value)) return 'cve'

  // IPv4
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return 'ip'

  // IPv6
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value)) return 'ip'

  // SHA256
  if (/^[a-fA-F0-9]{64}$/.test(value)) return 'hash_sha256'

  // SHA1
  if (/^[a-fA-F0-9]{40}$/.test(value)) return 'hash_sha1'

  // MD5
  if (/^[a-fA-F0-9]{32}$/.test(value)) return 'hash_md5'

  // URL
  if (/^https?:\/\//i.test(value)) return 'url'

  // Domain (simple check)
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(value)) return 'domain'

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'

  return 'unknown'
}

// Vulnerabilities queries
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
    return supabase
      .from('vulnerabilities')
      .select('*')
      .eq('cve_id', cveId)
      .single()
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
    // Get KEVs - if days is 0, get all; otherwise filter by date
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
    // Fetch all vulnerabilities with CVSS scores
    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('cvss_score')

    if (error || !data || data.length === 0) {
      // Return placeholder data if no vulnerabilities
      return [
        { name: 'Critical', value: 0, severity: 'critical' },
        { name: 'High', value: 0, severity: 'high' },
        { name: 'Medium', value: 0, severity: 'medium' },
        { name: 'Low', value: 0, severity: 'low' },
      ]
    }

    // Count by severity - use cvss_score if available, else severity field, else unknown
    const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
    for (const row of data) {
      if (row.cvss_score != null) {
        // Use CVSS score
        if (row.cvss_score >= 9.0) counts.critical++
        else if (row.cvss_score >= 7.0) counts.high++
        else if (row.cvss_score >= 4.0) counts.medium++
        else counts.low++
      } else if (row.severity) {
        // Use severity field
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

    // Return format for treemap
    const result = [
      { name: 'Critical', value: counts.critical, severity: 'critical' },
      { name: 'High', value: counts.high, severity: 'high' },
      { name: 'Medium', value: counts.medium, severity: 'medium' },
      { name: 'Low', value: counts.low, severity: 'low' },
    ]

    // Add unknown if there are any
    if (counts.unknown > 0) {
      result.push({ name: 'Unknown', value: counts.unknown, severity: 'none' })
    }

    return result
  },

  // Get actively exploited CVEs with actor attribution (for ActiveExploitationWidget)
  async getActivelyExploited(days = 30, limit = 10) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get KEV vulnerabilities
    const { data: kevs, error } = await supabase
      .from('vulnerabilities')
      .select('*')
      .not('kev_date', 'is', null)
      .order('kev_date', { ascending: false })
      .limit(limit * 2) // Get more to filter

    if (error || !kevs) return []

    // Get actor-CVE correlations
    const { data: correlations } = await supabase
      .from('actor_vulnerabilities')
      .select(`
        cve_id,
        actor:threat_actors(id, name, actor_type)
      `)
      .in('cve_id', kevs.map(k => k.cve_id))

    // Build actor map
    const actorMap = {}
    for (const corr of correlations || []) {
      if (!actorMap[corr.cve_id]) {
        actorMap[corr.cve_id] = []
      }
      if (corr.actor) {
        actorMap[corr.cve_id].push(corr.actor)
      }
    }

    // Enrich KEVs with actor data and sort by relevance
    const enriched = kevs.map(kev => ({
      ...kev,
      actors: actorMap[kev.cve_id] || [],
      severity: kev.cvss_score >= 9 ? 'critical' :
                kev.cvss_score >= 7 ? 'high' :
                kev.cvss_score >= 4 ? 'medium' : 'low'
    }))

    // Sort by: has actors > ransomware use > CVSS score > recency
    enriched.sort((a, b) => {
      // Prioritize CVEs with known actor usage
      if (a.actors.length > 0 && b.actors.length === 0) return -1
      if (b.actors.length > 0 && a.actors.length === 0) return 1
      // Then ransomware usage
      if (a.ransomware_campaign_use && !b.ransomware_campaign_use) return -1
      if (b.ransomware_campaign_use && !a.ransomware_campaign_use) return 1
      // Then CVSS score
      return (b.cvss_score || 0) - (a.cvss_score || 0)
    })

    return enriched.slice(0, limit)
  },

  // Get recent CVEs for service category analysis (for TargetedServicesWidget)
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

// MITRE ATT&CK Techniques queries
export const techniques = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, tactic = '', search = '' } = options

    let query = supabase
      .from('techniques')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (tactic) {
      query = query.contains('tactics', [tactic])
    }

    if (search) {
      query = query.or(`id.ilike.%${search}%,name.ilike.%${search}%`)
    }

    return query
  },

  async getById(techniqueId) {
    return supabase
      .from('techniques')
      .select('*')
      .eq('id', techniqueId)
      .single()
  },

  async getByTactic(tactic, limit = 50) {
    return supabase
      .from('techniques')
      .select('*')
      .contains('tactics', [tactic])
      .order('id', { ascending: true })
      .limit(limit)
  },

  async getForActor(actorId) {
    return supabase
      .from('actor_techniques')
      .select(`
        *,
        technique:techniques(*)
      `)
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
  },

  async getTacticSummary() {
    const { data } = await supabase
      .from('techniques')
      .select('tactics')

    const counts = {}
    for (const row of (data || [])) {
      for (const tactic of row.tactics || []) {
        counts[tactic] = (counts[tactic] || 0) + 1
      }
    }
    return counts
  },
}

// Watchlists queries
export const watchlists = {
  async getAll(userId = 'anonymous') {
    return supabase
      .from('watchlists')
      .select(`
        *,
        items:watchlist_items(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  },

  async getById(id) {
    return supabase
      .from('watchlists')
      .select(`
        *,
        items:watchlist_items(*)
      `)
      .eq('id', id)
      .single()
  },

  async create(watchlist) {
    return supabase
      .from('watchlists')
      .insert(watchlist)
      .select()
      .single()
  },

  async update(id, updates) {
    return supabase
      .from('watchlists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  },

  async delete(id) {
    return supabase
      .from('watchlists')
      .delete()
      .eq('id', id)
  },

  async addItem(watchlistId, entityId, notes = null) {
    return supabase
      .from('watchlist_items')
      .insert({ watchlist_id: watchlistId, entity_id: entityId, notes })
      .select()
      .single()
  },

  async removeItem(watchlistId, entityId) {
    return supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('entity_id', entityId)
  },

  async isWatched(entityId, userId = 'anonymous') {
    const { data } = await supabase
      .from('watchlist_items')
      .select(`
        *,
        watchlist:watchlists!inner(user_id)
      `)
      .eq('entity_id', entityId)
      .eq('watchlist.user_id', userId)
    return data && data.length > 0
  },
}

// Saved Searches queries
export const savedSearches = {
  async getAll(userId = 'anonymous', searchType = null) {
    let query = supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .order('use_count', { ascending: false })

    if (searchType) {
      query = query.eq('search_type', searchType)
    }

    return query
  },

  async create(search) {
    return supabase
      .from('saved_searches')
      .insert(search)
      .select()
      .single()
  },

  async update(id, updates) {
    return supabase
      .from('saved_searches')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  },

  async delete(id) {
    return supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
  },

  async incrementUseCount(id) {
    return supabase
      .rpc('increment_search_use_count', { search_id: id })
  },
}

// User Preferences queries
export const userPreferences = {
  async get(userId = 'anonymous') {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // maybeSingle() returns null data (no error) when no row exists
    if (!data) {
      return {
        data: {
          user_id: userId,
          preferences: {
            defaultTimeRange: '30d',
            defaultSeverity: 'all',
            itemsPerPage: 25,
            darkMode: true,
            compactView: false,
            showNewIndicators: true,
            sidebarCollapsed: false,
            dashboardLayout: 'default',
          },
          last_visit: null,
        },
      }
    }

    return { data, error }
  },

  async update(userId = 'anonymous', preferences) {
    return supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
  },

  async updateLastVisit(userId = 'anonymous') {
    return supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        last_visit: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
  },
}

// Tags queries
export const tags = {
  async getAll(userId = 'anonymous') {
    return supabase
      .from('tags')
      .select(`
        *,
        entity_tags(count)
      `)
      .eq('user_id', userId)
      .order('name', { ascending: true })
  },

  async create(tag) {
    return supabase
      .from('tags')
      .insert(tag)
      .select()
      .single()
  },

  async update(id, updates) {
    return supabase
      .from('tags')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  },

  async delete(id) {
    return supabase
      .from('tags')
      .delete()
      .eq('id', id)
  },

  async addToEntity(tagId, entityType, entityId) {
    return supabase
      .from('entity_tags')
      .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
      .select()
      .single()
  },

  async removeFromEntity(tagId, entityType, entityId) {
    return supabase
      .from('entity_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
  },

  async getForEntity(entityType, entityId) {
    return supabase
      .from('entity_tags')
      .select(`
        *,
        tag:tags(*)
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
  },

  async getEntitiesByTag(tagId) {
    return supabase
      .from('entity_tags')
      .select('*')
      .eq('tag_id', tagId)
  },
}

// Alerts queries
export const alerts = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', category = '', severity = '' } = options

    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .order('published_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    return query
  },

  async getRecent(options = {}) {
    const { limit = 50, offset = 0, category = '', severity = '', days = 30 } = options

    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .order('published_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('published_date', cutoffDate.toISOString())
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    return query
  },

  async getById(id) {
    return supabase
      .from('alerts')
      .select('*')
      .eq('id', id)
      .single()
  },

  async getByCVE(cveId) {
    return supabase
      .from('alerts')
      .select('*')
      .contains('cve_ids', [cveId])
      .order('published_date', { ascending: false })
  },
}

// Malware samples queries
export const malwareSamples = {
  async getRecent(options = {}) {
    const { limit = 50, offset = 0, signature = '', days = 30 } = options

    let query = supabase
      .from('malware_samples')
      .select('*', { count: 'exact' })
      .order('first_seen', { ascending: false })
      .range(offset, offset + limit - 1)

    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('first_seen', cutoffDate.toISOString())
    }

    if (signature) {
      query = query.eq('signature', signature)
    }

    return query
  },

  async searchHash(hash) {
    return supabase
      .from('malware_samples')
      .select('*')
      .or(`sha256.eq.${hash},sha1.eq.${hash},md5.eq.${hash}`)
      .single()
  },

  async getBySignature(signature, limit = 50) {
    return supabase
      .from('malware_samples')
      .select('*')
      .eq('signature', signature)
      .order('first_seen', { ascending: false })
      .limit(limit)
  },

  async getSignatureSummary() {
    const { data } = await supabase
      .from('malware_samples')
      .select('signature')
      .not('signature', 'is', null)

    const counts = {}
    for (const row of (data || [])) {
      if (row.signature) {
        counts[row.signature] = (counts[row.signature] || 0) + 1
      }
    }
    return counts
  },
}

// Sync log queries
export const syncLog = {
  async getRecent(limit = 20) {
    return supabase
      .from('sync_log')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(limit)
  },

  async getBySource(source) {
    return supabase
      .from('sync_log')
      .select('*')
      .eq('source', source)
      .order('completed_at', { ascending: false })
      .limit(10)
  },
}

// Dashboard stats
export const dashboard = {
  async getOverview() {
    const now = new Date()
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const last90d = new Date(now - 90 * 24 * 60 * 60 * 1000)
    const last365d = new Date(now - 365 * 24 * 60 * 60 * 1000)

    // Run queries in parallel
    const [
      actorCount,
      incidentCount30d,
      incidentCountTotal,
      kevCount,
      iocCount,
    ] = await Promise.all([
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }),
      supabase.from('incidents').select('*', { count: 'exact', head: true })
        .gte('discovered_date', last30d.toISOString()),
      supabase.from('incidents').select('*', { count: 'exact', head: true }),
      supabase.from('vulnerabilities').select('*', { count: 'exact', head: true })
        .not('kev_date', 'is', null),
      supabase.from('iocs').select('*', { count: 'exact', head: true }),
    ])

    return {
      totalActors: actorCount.count || 0,
      incidents24h: incidentCount30d.count || 0, // Renamed to show 30d instead
      incidents7d: incidentCountTotal.count || 0, // Total incidents
      newKEV7d: kevCount.count || 0,
      newIOCs24h: iocCount.count || 0,
    }
  },
}

// AI Summaries - historical record of generated intelligence
export const aiSummaries = {
  async save(summary, context = {}) {
    const { type = 'dashboard_bluf', model, incidents30d, actors, sectors } = context

    return supabase.from('ai_summaries').insert({
      summary_type: type,
      content: summary,
      context_data: context.rawData || null,
      model_used: model,
      incidents_30d: incidents30d,
      actors_mentioned: actors || [],
      sectors_mentioned: sectors || [],
    })
  },

  async getRecent(limit = 30) {
    return supabase
      .from('ai_summaries')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit)
  },

  async getByDateRange(startDate, endDate) {
    return supabase
      .from('ai_summaries')
      .select('*')
      .gte('generated_at', startDate.toISOString())
      .lte('generated_at', endDate.toISOString())
      .order('generated_at', { ascending: false })
  },

  async getLatest() {
    return supabase
      .from('ai_summaries')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
  },
}

// Organization Profile - for personalized threat relevance
export const orgProfile = {
  async get(userId = 'anonymous') {
    const { data: prefs } = await userPreferences.get(userId)
    return prefs?.preferences?.org_profile || null
  },

  async update(userId = 'anonymous', profile) {
    const { data: current } = await userPreferences.get(userId)
    const preferences = {
      ...(current?.preferences || {}),
      org_profile: profile
    }
    return userPreferences.update(userId, preferences)
  },

  async hasProfile(userId = 'anonymous') {
    const profile = await this.get(userId)
    return profile && (profile.sector || profile.tech_stack?.length > 0)
  }
}

// Relevance scoring for personalized intelligence
export const relevance = {
  async getRelevantActors(profile, limit = 20) {
    if (!profile?.sector) return { data: [], error: null }

    // Get actors that target the user's sector
    let query = supabase
      .from('threat_actors')
      .select('*')
      .contains('target_sectors', [profile.sector])
      .order('incident_velocity', { ascending: false, nullsFirst: false })
      .limit(limit)

    return query
  },

  async getRelevantVulnerabilities(profile, limit = 50) {
    if (!profile?.tech_vendors?.length) return { data: [], error: null }

    // Get vulnerabilities affecting user's tech stack
    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('*')
      .order('cvss_score', { ascending: false })

    if (error || !data) return { data: [], error }

    // Filter and score by vendor/product match
    const scored = data
      .map(vuln => ({
        ...vuln,
        relevance_score: this.calculateVulnScore(vuln, profile)
      }))
      .filter(v => v.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit)

    return { data: scored, error: null }
  },

  // Calculate actor relevance score (0-100)
  calculateActorScore(actor, profile) {
    if (!profile) return 0
    let score = 0

    // Sector match (50 points)
    if (profile.sector && actor.target_sectors?.includes(profile.sector)) {
      score += 50
    } else if (profile.secondary_sectors?.some(s => actor.target_sectors?.includes(s))) {
      score += 25
    }

    // Country/region match (30 points)
    if (profile.country && actor.target_countries?.includes(profile.country)) {
      score += 30
    }

    // Escalating status bonus (20 points)
    if (actor.trend_status === 'ESCALATING') score += 20
    else if (actor.trend_status === 'STABLE') score += 10

    return Math.min(score, 100)
  },

  // Calculate vulnerability relevance score (0-100)
  calculateVulnScore(vuln, profile) {
    if (!profile) return 0
    let score = 0

    const vendors = (profile.tech_vendors || []).map(v => v.toLowerCase())
    const stack = (profile.tech_stack || []).map(s => s.toLowerCase())

    // Vendor match (40 points)
    if (vuln.affected_vendors?.some(v => vendors.includes(v.toLowerCase()))) {
      score += 40
    }

    // Product match (40 points)
    if (vuln.affected_products?.some(p => stack.some(s => p.toLowerCase().includes(s)))) {
      score += 40
    }

    // KEV status (10 points)
    if (vuln.kev_date) score += 10

    // Ransomware use (10 points)
    if (vuln.ransomware_campaign_use) score += 10

    return Math.min(score, 100)
  },

  // Get relevance label from score
  getRelevanceLabel(score) {
    if (score >= 80) return { label: 'Critical', color: 'red' }
    if (score >= 60) return { label: 'High', color: 'orange' }
    if (score >= 40) return { label: 'Medium', color: 'yellow' }
    if (score >= 20) return { label: 'Low', color: 'blue' }
    return { label: 'Info', color: 'gray' }
  }
}

// Correlations - linking actors, vulnerabilities, TTPs, and IOCs
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

  // Link an actor to a CVE (for seeding or manual correlation)
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

// Trend Analysis - temporal intelligence
export const trendAnalysis = {
  async getWeeklyComparison(weeksBack = 8) {
    return supabase
      .from('weekly_summaries')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(weeksBack)
  },

  async getWeekOverWeekChange() {
    const { data: summaries } = await this.getWeeklyComparison(2)

    if (!summaries || summaries.length < 2) {
      // Calculate on the fly if no summaries table
      return this.calculateWeekOverWeek()
    }

    const [current, previous] = summaries
    return {
      currentWeek: current,
      previousWeek: previous,
      incidentChange: current.incident_change_pct,
      sectorChanges: this.calculateSectorChanges(
        current.incidents_by_sector,
        previous.incidents_by_sector
      )
    }
  },

  async calculateWeekOverWeek() {
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay())
    thisWeekStart.setHours(0, 0, 0, 0)

    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    const [thisWeek, lastWeek] = await Promise.all([
      supabase
        .from('incidents')
        .select('victim_sector', { count: 'exact' })
        .gte('discovered_date', thisWeekStart.toISOString().split('T')[0]),
      supabase
        .from('incidents')
        .select('victim_sector', { count: 'exact' })
        .gte('discovered_date', lastWeekStart.toISOString().split('T')[0])
        .lt('discovered_date', thisWeekStart.toISOString().split('T')[0])
    ])

    const currentCount = thisWeek.count || 0
    const previousCount = lastWeek.count || 0
    const changePercent = previousCount > 0
      ? Math.round(((currentCount - previousCount) / previousCount) * 100)
      : 0

    return {
      currentWeek: { incidents_total: currentCount },
      previousWeek: { incidents_total: previousCount },
      incidentChange: changePercent
    }
  },

  calculateSectorChanges(current, previous) {
    const changes = []
    const allSectors = new Set([
      ...Object.keys(current || {}),
      ...Object.keys(previous || {})
    ])

    for (const sector of allSectors) {
      const curr = current?.[sector] || 0
      const prev = previous?.[sector] || 0
      const change = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0)

      changes.push({
        sector,
        current: curr,
        previous: prev,
        change
      })
    }

    return changes.sort((a, b) => b.change - a.change)
  },

  async getSectorTrends(days = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data } = await supabase
      .from('incidents')
      .select('victim_sector, discovered_date')
      .gte('discovered_date', cutoffDate.toISOString().split('T')[0])

    // Group by week and sector
    const weeklyBySector = {}

    for (const incident of (data || [])) {
      const date = new Date(incident.discovered_date)
      const weekStart = this.getWeekStart(date)
      const sector = incident.victim_sector || 'Unknown'
      const key = `${weekStart}|${sector}`

      weeklyBySector[key] = (weeklyBySector[key] || 0) + 1
    }

    // Transform into chart-friendly format
    const weeks = [...new Set(Object.keys(weeklyBySector).map(k => k.split('|')[0]))].sort()
    const sectors = [...new Set(Object.keys(weeklyBySector).map(k => k.split('|')[1]))]

    return {
      weeks,
      sectors,
      data: weeklyBySector
    }
  },

  getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split('T')[0]
  },

  async getChangeSummary(sinceDays = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays)
    const cutoff = cutoffDate.toISOString().split('T')[0]

    const [newIncidents, newActors, newKEVs, escalatingActors] = await Promise.all([
      supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .gte('discovered_date', cutoff),

      supabase
        .from('threat_actors')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoffDate.toISOString()),

      supabase
        .from('vulnerabilities')
        .select('*', { count: 'exact', head: true })
        .gte('kev_date', cutoff),

      supabase
        .from('threat_actors')
        .select('id, name, incidents_7d, trend_status')
        .eq('trend_status', 'ESCALATING')
        .order('incidents_7d', { ascending: false })
        .limit(10)
    ])

    return {
      newIncidents: newIncidents.count || 0,
      newActors: newActors.count || 0,
      newKEVs: newKEVs.count || 0,
      escalatingActors: escalatingActors.data || [],
      sinceDays
    }
  },

  async getActorTrajectories(actorIds, days = 90) {
    return supabase
      .from('actor_trend_history')
      .select('*')
      .in('actor_id', actorIds)
      .gte('recorded_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('recorded_date', { ascending: true })
  }
}

// Data Sources management
export const dataSources = {
  // Data source definitions
  sources: [
    { id: 'ransomlook', name: 'RansomLook', type: 'ransomware', automated: true, frequency: '6 hours' },
    { id: 'ransomware_live', name: 'Ransomware.live', type: 'ransomware', automated: true, frequency: '6 hours' },
    { id: 'mitre_attack', name: 'MITRE ATT&CK', type: 'apt', automated: true, frequency: '6 hours' },
    { id: 'malpedia', name: 'Malpedia', type: 'malware', automated: true, frequency: '6 hours' },
    { id: 'misp_galaxy', name: 'MISP Galaxy', type: 'actors', automated: true, frequency: '6 hours' },
    { id: 'cisa_kev', name: 'CISA KEV', type: 'vulnerabilities', automated: true, frequency: '6 hours' },
    { id: 'nvd', name: 'NVD', type: 'vulnerabilities', automated: true, frequency: '6 hours' },
    { id: 'threatfox', name: 'ThreatFox', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'urlhaus', name: 'URLhaus', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'feodo', name: 'Feodo Tracker', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'cisa_alerts', name: 'CISA Alerts', type: 'alerts', automated: true, frequency: '6 hours' },
    { id: 'actor_types_seed', name: 'Curated Actors', type: 'actors', automated: false, frequency: 'manual' },
    { id: 'actor_snapshot', name: 'Trend Snapshots', type: 'analytics', automated: true, frequency: '6 hours' },
  ],

  async getSyncStatus() {
    // Get latest sync for each source
    const { data, error } = await supabase
      .from('sync_log')
      .select('source, status, completed_at, records_added, error_message')
      .order('completed_at', { ascending: false })

    if (error) return { data: [], error }

    // Deduplicate to get latest per source
    const latest = new Map()
    for (const row of data || []) {
      if (!latest.has(row.source)) {
        latest.set(row.source, row)
      }
    }

    // Merge with source definitions
    const result = this.sources.map(source => ({
      ...source,
      lastSync: latest.get(source.id)?.completed_at || null,
      lastStatus: latest.get(source.id)?.status || 'never',
      recordsAdded: latest.get(source.id)?.records_added || 0,
      error: latest.get(source.id)?.error_message || null,
    }))

    return { data: result, error: null }
  },

  async getActorTypeCounts() {
    const { data, error } = await supabase
      .from('threat_actors')
      .select('actor_type')

    if (error) return { data: {}, error }

    const counts = {}
    for (const row of data || []) {
      const type = row.actor_type || 'unknown'
      counts[type] = (counts[type] || 0) + 1
    }

    return { data: counts, error: null }
  },

  async triggerManualUpdate(sourceId) {
    const source = this.sources.find(s => s.id === sourceId)
    if (!source) {
      return { success: false, message: 'Unknown data source' }
    }

    if (source.automated) {
      return {
        success: false,
        message: `${source.name} is automated. It updates every ${source.frequency} via GitHub Actions.`
      }
    }

    // For actor_types_seed, actually run the seed
    if (sourceId === 'actor_types_seed') {
      return await this.seedCuratedActors()
    }

    return { success: false, message: 'No handler for this source' }
  },

  // Curated actor data embedded in the app
  curatedActors: {
    cybercrime: [
      { name: 'FIN6', aliases: ['ITG08', 'Skeleton Spider', 'Magecart Group 6'], description: 'Financially motivated cybercrime group known for targeting POS systems and e-commerce platforms.', target_sectors: ['retail', 'hospitality', 'entertainment'], first_seen: '2015-01-01', ttps: ['T1059', 'T1055', 'T1003', 'T1486'] },
      { name: 'FIN7', aliases: ['Carbanak', 'Carbon Spider', 'Sangria Tempest'], description: 'Prolific financially motivated group targeting retail, restaurant, and hospitality sectors.', target_sectors: ['retail', 'hospitality', 'finance'], first_seen: '2013-01-01', ttps: ['T1566', 'T1059', 'T1055', 'T1003'] },
      { name: 'FIN8', aliases: ['Syssphinx'], description: 'Financially motivated group targeting POS environments in hospitality and retail.', target_sectors: ['retail', 'hospitality', 'finance'], first_seen: '2016-01-01', ttps: ['T1059', 'T1053', 'T1003', 'T1055'] },
      { name: 'FIN11', aliases: ['TA505', 'Lace Tempest'], description: 'High-volume financially motivated group known for Clop ransomware and Dridex banking trojan.', target_sectors: ['finance', 'retail', 'healthcare'], first_seen: '2016-01-01', ttps: ['T1566', 'T1059', 'T1486', 'T1190'] },
      { name: 'Scattered Spider', aliases: ['UNC3944', 'Roasted 0ktapus', 'Octo Tempest'], description: 'Young English-speaking cybercrime group known for SIM swapping and social engineering.', target_sectors: ['technology', 'telecommunications', 'gaming'], first_seen: '2022-01-01', ttps: ['T1566', 'T1078', 'T1621', 'T1486'] },
      { name: 'Magecart', aliases: ['Magecart Group', 'Web Skimmers'], description: 'Umbrella term for groups injecting payment card skimmers into e-commerce websites.', target_sectors: ['retail', 'e-commerce'], first_seen: '2015-01-01', ttps: ['T1059', 'T1505', 'T1189'] },
      { name: 'Cobalt Group', aliases: ['Cobalt Gang', 'Cobalt Spider'], description: 'Eastern European cybercrime syndicate targeting banks via ATM attacks and SWIFT.', target_sectors: ['finance'], first_seen: '2016-01-01', ttps: ['T1566', 'T1059', 'T1021', 'T1055'] },
    ],
    hacktivism: [
      { name: 'Anonymous', aliases: ['Anon', 'Anonymous Collective'], description: 'Decentralized international hacktivist collective known for DDoS attacks and data leaks.', target_sectors: ['government', 'finance', 'media'], first_seen: '2003-01-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'Anonymous Sudan', aliases: ['Storm-1359'], description: 'Pro-Russian hacktivist group conducting DDoS attacks against Western targets.', target_sectors: ['government', 'technology', 'healthcare'], first_seen: '2023-01-01', ttps: ['T1498', 'T1499'] },
      { name: 'Killnet', aliases: ['Killnet Collective'], description: 'Pro-Russian hacktivist group conducting DDoS attacks against NATO countries.', target_sectors: ['government', 'transportation', 'finance'], first_seen: '2022-01-01', ttps: ['T1498', 'T1499'] },
      { name: 'NoName057(16)', aliases: ['NoName', 'NN057'], description: 'Pro-Russian hacktivist group using DDoSia tool for crowdsourced DDoS attacks.', target_sectors: ['government', 'finance', 'transportation'], first_seen: '2022-03-01', ttps: ['T1498', 'T1499'] },
      { name: 'IT Army of Ukraine', aliases: ['IT Army UA'], description: 'Pro-Ukrainian hacktivist collective coordinating cyber attacks against Russian infrastructure.', target_sectors: ['government', 'finance', 'energy'], first_seen: '2022-02-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'GhostSec', aliases: ['Ghost Security'], description: 'Hacktivist group originally focused on anti-ISIS operations.', target_sectors: ['government', 'energy', 'technology'], first_seen: '2015-01-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'SiegedSec', aliases: ['Sieged Security'], description: 'Hacktivist group known for breaching organizations over political/social issues.', target_sectors: ['government', 'education'], first_seen: '2022-01-01', ttps: ['T1530', 'T1491', 'T1190'] },
      { name: 'Lapsus$', aliases: ['LAPSUS$', 'DEV-0537'], description: 'Data extortion group targeting large tech companies through social engineering.', target_sectors: ['technology', 'gaming', 'telecommunications'], first_seen: '2021-12-01', ttps: ['T1078', 'T1566', 'T1530', 'T1657'] },
    ],
    initial_access_broker: [
      { name: 'Exotic Lily', aliases: ['TA580', 'Projector Libra'], description: 'Initial access broker using callback phishing and fake business personas.', target_sectors: ['technology', 'healthcare', 'manufacturing'], first_seen: '2021-01-01', ttps: ['T1566', 'T1204', 'T1078'] },
      { name: 'Prophet Spider', aliases: ['UNC961'], description: 'Initial access broker exploiting public-facing applications.', target_sectors: ['technology', 'healthcare', 'education'], first_seen: '2020-01-01', ttps: ['T1190', 'T1505', 'T1078'] },
      { name: 'Qakbot Operators', aliases: ['QBot', 'Quakbot'], description: 'Operators of Qakbot banking trojan, pivoted to initial access brokering.', target_sectors: ['finance', 'manufacturing', 'technology'], first_seen: '2007-01-01', ttps: ['T1566', 'T1055', 'T1059', 'T1021'] },
      { name: 'Emotet Operators', aliases: ['TA542', 'Mummy Spider'], description: 'Operators of Emotet malware-as-a-service, major initial access provider.', target_sectors: ['manufacturing', 'healthcare', 'government'], first_seen: '2014-01-01', ttps: ['T1566', 'T1059', 'T1055', 'T1021'] },
      { name: 'TrickBot Gang', aliases: ['Wizard Spider', 'ITG23'], description: 'Operators of TrickBot and BazarLoader, major initial access provider.', target_sectors: ['healthcare', 'finance', 'manufacturing'], first_seen: '2016-01-01', ttps: ['T1566', 'T1055', 'T1021', 'T1486'] },
    ],
    data_extortion: [
      { name: 'Karakurt', aliases: ['Karakurt Team', 'Karakurt Lair'], description: 'Data extortion group that steals data without deploying ransomware.', target_sectors: ['healthcare', 'technology', 'manufacturing'], first_seen: '2021-06-01', ttps: ['T1530', 'T1567', 'T1657'] },
      { name: 'RansomHouse', aliases: ['Ransom House'], description: 'Data extortion group claiming to be "penetration testers" exposing poor security.', target_sectors: ['healthcare', 'technology', 'retail'], first_seen: '2021-12-01', ttps: ['T1530', 'T1567', 'T1657'] },
      { name: 'Donut Leaks', aliases: ['D0nut', 'Donut'], description: 'Data extortion group known for creative victim shaming.', target_sectors: ['technology', 'manufacturing'], first_seen: '2022-01-01', ttps: ['T1530', 'T1567', 'T1657'] },
    ]
  },

  async seedCuratedActors() {
    logger.info('Seeding curated actors...')
    let totalAdded = 0
    let totalErrors = 0

    for (const [actorType, actors] of Object.entries(this.curatedActors)) {
      for (const actor of actors) {
        const record = {
          name: actor.name,
          aliases: actor.aliases || [],
          actor_type: actorType,
          description: actor.description,
          target_sectors: actor.target_sectors || [],
          first_seen: actor.first_seen,
          ttps: actor.ttps || [],
          source: 'manual_curation',
          status: 'active',
        }

        const { error } = await supabase
          .from('threat_actors')
          .upsert(record, { onConflict: 'name', ignoreDuplicates: false })

        if (error) {
          console.error(`Error upserting ${actor.name}:`, error.message)
          totalErrors++
        } else {
          totalAdded++
        }
      }
    }

    // Log sync
    await supabase.from('sync_log').insert({
      source: 'actor_types_seed',
      status: totalErrors === 0 ? 'success' : 'partial',
      records_processed: Object.values(this.curatedActors).flat().length,
      records_added: totalAdded,
      error_message: totalErrors > 0 ? `${totalErrors} errors` : null,
      completed_at: new Date().toISOString(),
    })

    return {
      success: true,
      message: `Seeded ${totalAdded} curated actors (${totalErrors} errors)`,
      added: totalAdded,
      errors: totalErrors
    }
  }
}

// Unified Events - aggregates all security events into a single timeline
export const unifiedEvents = {
  // Event type configuration
  eventTypes: {
    ransomware: {
      label: 'Ransomware',
      color: 'red',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400',
      borderClass: 'border-red-500/50'
    },
    alert: {
      label: 'Alert',
      color: 'yellow',
      bgClass: 'bg-yellow-500/20',
      textClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/50'
    },
    vulnerability: {
      label: 'KEV',
      color: 'orange',
      bgClass: 'bg-orange-500/20',
      textClass: 'text-orange-400',
      borderClass: 'border-orange-500/50'
    },
    ioc: {
      label: 'IOC',
      color: 'blue',
      bgClass: 'bg-blue-500/20',
      textClass: 'text-blue-400',
      borderClass: 'border-blue-500/50'
    },
    malware: {
      label: 'Malware',
      color: 'cyan',
      bgClass: 'bg-cyan-500/20',
      textClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/50'
    },
    breach: {
      label: 'Breach',
      color: 'purple',
      bgClass: 'bg-purple-500/20',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/50'
    },
  },

  // Normalize incident to unified event
  normalizeIncident(incident) {
    const severityMap = {
      leaked: 'critical',
      confirmed: 'high',
      claimed: 'medium',
      paid: 'medium',
      removed: 'low'
    }

    return {
      id: `incident-${incident.id}`,
      source_id: incident.id,
      event_type: 'ransomware',
      timestamp: incident.discovered_date,
      severity: severityMap[incident.status] || 'medium',
      title: incident.victim_name,
      subtitle: incident.threat_actor?.name || 'Unknown Actor',
      actor_id: incident.actor_id,
      actor_name: incident.threat_actor?.name,
      sector: incident.victim_sector,
      country: incident.victim_country,
      status: incident.status,
      source_url: incident.source_url,
      raw: incident
    }
  },

  // Normalize alert to unified event
  normalizeAlert(alert) {
    return {
      id: `alert-${alert.id}`,
      source_id: alert.id,
      event_type: 'alert',
      timestamp: alert.published_date,
      severity: alert.severity || 'medium',
      title: alert.title,
      subtitle: alert.source || 'CISA',
      actor_id: null,
      actor_name: null,
      sector: null,
      country: null,
      status: null,
      source_url: alert.url,
      raw: alert
    }
  },

  // Normalize vulnerability to unified event
  normalizeVulnerability(vuln) {
    let severity = 'medium'
    if (vuln.cvss_score >= 9.0) severity = 'critical'
    else if (vuln.cvss_score >= 7.0) severity = 'high'
    else if (vuln.cvss_score >= 4.0) severity = 'medium'
    else severity = 'low'

    return {
      id: `vuln-${vuln.cve_id}`,
      source_id: vuln.cve_id,
      event_type: 'vulnerability',
      timestamp: vuln.kev_date || vuln.created_at,
      severity,
      title: vuln.cve_id,
      subtitle: vuln.description?.substring(0, 60) + (vuln.description?.length > 60 ? '...' : ''),
      actor_id: null,
      actor_name: null,
      sector: null,
      country: null,
      status: vuln.kev_date ? 'KEV' : null,
      source_url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
      cvss_score: vuln.cvss_score,
      raw: vuln
    }
  },

  // Normalize IOC to unified event
  normalizeIOC(ioc) {
    const severityMap = {
      high: 'high',
      medium: 'medium',
      low: 'low'
    }

    return {
      id: `ioc-${ioc.id}`,
      source_id: ioc.id,
      event_type: 'ioc',
      timestamp: ioc.created_at || ioc.first_seen,
      severity: severityMap[ioc.confidence] || 'medium',
      title: ioc.value?.length > 40 ? ioc.value.substring(0, 40) + '...' : ioc.value,
      subtitle: `${ioc.type}${ioc.malware_family ? ` • ${ioc.malware_family}` : ''}`,
      actor_id: ioc.actor_id,
      actor_name: ioc.threat_actor?.name,
      sector: null,
      country: null,
      status: ioc.type,
      source_url: null,
      raw: ioc
    }
  },

  // Normalize malware sample to unified event
  normalizeMalware(sample) {
    return {
      id: `malware-${sample.id}`,
      source_id: sample.id,
      event_type: 'malware',
      timestamp: sample.first_seen,
      severity: 'high',
      title: sample.signature || sample.sha256?.substring(0, 16) + '...',
      subtitle: sample.file_type || 'Unknown type',
      actor_id: sample.actor_id,
      actor_name: null,
      sector: null,
      country: null,
      status: sample.signature,
      source_url: `https://bazaar.abuse.ch/sample/${sample.sha256}`,
      raw: sample
    }
  },

  // Normalize breach to unified event
  normalizeBreach(breach) {
    let severity = 'medium'
    if (breach.pwn_count >= 1000000) severity = 'critical'
    else if (breach.pwn_count >= 100000) severity = 'high'
    else if (breach.pwn_count >= 10000) severity = 'medium'
    else severity = 'low'

    return {
      id: `breach-${breach.id}`,
      source_id: breach.id,
      event_type: 'breach',
      timestamp: breach.breach_date || breach.added_date,
      severity,
      title: breach.name,
      subtitle: `${(breach.pwn_count || 0).toLocaleString()} accounts`,
      actor_id: null,
      actor_name: null,
      sector: null,
      country: null,
      status: breach.is_verified ? 'Verified' : 'Unverified',
      source_url: null,
      pwn_count: breach.pwn_count,
      raw: breach
    }
  },

  // Get unified timeline with all event types
  async getTimeline(options = {}) {
    const {
      days = 30,
      types = [],
      severity = '',
      search = '',
      limit = 100,
      offset = 0
    } = options

    const cutoffDate = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null
    const activeTypes = types.length > 0 ? types : ['ransomware', 'alert', 'vulnerability', 'ioc', 'malware', 'breach']

    const queries = []

    // Incidents (ransomware)
    if (activeTypes.includes('ransomware')) {
      let q = supabase
        .from('incidents')
        .select('*, threat_actor:threat_actors(id, name)')
        .order('discovered_date', { ascending: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('discovered_date', cutoffDate.split('T')[0])
      if (search) q = q.or(`victim_name.ilike.%${search}%,victim_sector.ilike.%${search}%`)
      queries.push(q.then(r => ({ type: 'ransomware', data: r.data || [], error: r.error })))
    }

    // Alerts
    if (activeTypes.includes('alert')) {
      let q = supabase
        .from('alerts')
        .select('*')
        .order('published_date', { ascending: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('published_date', cutoffDate)
      if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      queries.push(q.then(r => ({ type: 'alert', data: r.data || [], error: r.error })))
    }

    // Vulnerabilities (KEV only for timeline relevance)
    if (activeTypes.includes('vulnerability')) {
      let q = supabase
        .from('vulnerabilities')
        .select('*')
        .not('kev_date', 'is', null)
        .order('kev_date', { ascending: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('kev_date', cutoffDate.split('T')[0])
      if (search) q = q.or(`cve_id.ilike.%${search}%,description.ilike.%${search}%`)
      queries.push(q.then(r => ({ type: 'vulnerability', data: r.data || [], error: r.error })))
    }

    // IOCs
    if (activeTypes.includes('ioc')) {
      let q = supabase
        .from('iocs')
        .select('*, threat_actor:threat_actors(id, name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('created_at', cutoffDate)
      if (search) q = q.ilike('value', `%${search}%`)
      queries.push(q.then(r => ({ type: 'ioc', data: r.data || [], error: r.error })))
    }

    // Malware samples
    if (activeTypes.includes('malware')) {
      let q = supabase
        .from('malware_samples')
        .select('*')
        .order('first_seen', { ascending: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('first_seen', cutoffDate)
      if (search) q = q.or(`signature.ilike.%${search}%,sha256.ilike.%${search}%`)
      queries.push(q.then(r => ({ type: 'malware', data: r.data || [], error: r.error })))
    }

    // Breaches
    if (activeTypes.includes('breach')) {
      let q = supabase
        .from('breaches')
        .select('*')
        .order('breach_date', { ascending: false, nullsFirst: false })
        .limit(limit)
      if (cutoffDate) q = q.gte('breach_date', cutoffDate.split('T')[0])
      if (search) q = q.or(`name.ilike.%${search}%,domain.ilike.%${search}%`)
      queries.push(q.then(r => ({ type: 'breach', data: r.data || [], error: r.error })))
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries)

    // Normalize and merge all events
    let allEvents = []
    for (const result of results) {
      if (result.error) {
        console.error(`Error fetching ${result.type}:`, result.error)
        continue
      }

      const normalizer = {
        ransomware: this.normalizeIncident,
        alert: this.normalizeAlert,
        vulnerability: this.normalizeVulnerability,
        ioc: this.normalizeIOC,
        malware: this.normalizeMalware,
        breach: this.normalizeBreach
      }[result.type]

      if (normalizer) {
        allEvents = allEvents.concat(result.data.map(item => normalizer.call(this, item)))
      }
    }

    // Filter by severity if specified
    if (severity) {
      allEvents = allEvents.filter(e => e.severity === severity)
    }

    // Sort by timestamp descending
    allEvents.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0)
      const dateB = new Date(b.timestamp || 0)
      return dateB - dateA
    })

    // Apply pagination
    const paginated = allEvents.slice(offset, offset + limit)

    return {
      data: paginated,
      total: allEvents.length,
      error: null
    }
  },

  // Get statistics for all event types
  async getStats(days = 30) {
    const cutoffDate = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null

    const queries = [
      // Incidents count
      supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .gte('discovered_date', cutoffDate ? cutoffDate.split('T')[0] : '1970-01-01'),

      // Alerts count
      supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .gte('published_date', cutoffDate || '1970-01-01T00:00:00Z'),

      // KEV count
      supabase
        .from('vulnerabilities')
        .select('*', { count: 'exact', head: true })
        .not('kev_date', 'is', null)
        .gte('kev_date', cutoffDate ? cutoffDate.split('T')[0] : '1970-01-01'),

      // IOC count
      supabase
        .from('iocs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoffDate || '1970-01-01T00:00:00Z'),

      // Malware count
      supabase
        .from('malware_samples')
        .select('*', { count: 'exact', head: true })
        .gte('first_seen', cutoffDate || '1970-01-01T00:00:00Z'),

      // Breach count
      supabase
        .from('breaches')
        .select('*', { count: 'exact', head: true })
        .gte('breach_date', cutoffDate ? cutoffDate.split('T')[0] : '1970-01-01'),
    ]

    const [incidents, alerts, vulns, iocs, malware, breaches] = await Promise.all(queries)

    return {
      ransomware: incidents.count || 0,
      alert: alerts.count || 0,
      vulnerability: vulns.count || 0,
      ioc: iocs.count || 0,
      malware: malware.count || 0,
      breach: breaches.count || 0,
      total: (incidents.count || 0) + (alerts.count || 0) + (vulns.count || 0) +
             (iocs.count || 0) + (malware.count || 0) + (breaches.count || 0)
    }
  },

  // Get daily counts for timeline chart
  async getDailyCounts(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const cutoff = cutoffDate.toISOString().split('T')[0]

    const [incidentsData, alertsData, vulnsData] = await Promise.all([
      supabase.from('incidents').select('discovered_date').gte('discovered_date', cutoff),
      supabase.from('alerts').select('published_date').gte('published_date', cutoffDate.toISOString()),
      supabase.from('vulnerabilities').select('kev_date').not('kev_date', 'is', null).gte('kev_date', cutoff),
    ])

    // Build daily counts
    const dailyCounts = {}

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateKey = d.toISOString().split('T')[0]
      dailyCounts[dateKey] = { date: dateKey, ransomware: 0, alert: 0, vulnerability: 0, total: 0 }
    }

    // Count incidents
    for (const row of incidentsData.data || []) {
      const date = row.discovered_date?.split('T')[0]
      if (date && dailyCounts[date]) {
        dailyCounts[date].ransomware++
        dailyCounts[date].total++
      }
    }

    // Count alerts
    for (const row of alertsData.data || []) {
      const date = row.published_date?.split('T')[0]
      if (date && dailyCounts[date]) {
        dailyCounts[date].alert++
        dailyCounts[date].total++
      }
    }

    // Count vulnerabilities
    for (const row of vulnsData.data || []) {
      const date = row.kev_date?.split('T')[0]
      if (date && dailyCounts[date]) {
        dailyCounts[date].vulnerability++
        dailyCounts[date].total++
      }
    }

    return Object.values(dailyCounts).sort((a, b) => a.date.localeCompare(b.date))
  }
}

// Notifications - in-app user notifications
export const notifications = {
  // Get notifications for a user
  async getForUser(userId = 'anonymous', options = {}) {
    const { limit = 20, unreadOnly = false, includeExpired = false } = options

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    if (!includeExpired) {
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    }

    return query
  },

  // Get unread count
  async getUnreadCount(userId = 'anonymous') {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    return { count: count || 0, error }
  },

  // Mark a notification as read
  async markAsRead(notificationId) {
    return supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId = 'anonymous') {
    return supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
  },

  // Create a notification
  async create(notification) {
    const {
      userId = 'anonymous',
      type,
      title,
      message,
      severity = 'info',
      link = null,
      relatedId = null,
      relatedType = null,
    } = notification

    return supabase.from('notifications').insert({
      user_id: userId,
      notification_type: type,
      title,
      message,
      severity,
      link,
      related_id: relatedId,
      related_type: relatedType,
    })
  },

  // Delete old notifications (cleanup)
  async deleteExpired() {
    return supabase
      .from('notifications')
      .delete()
      .lt('expires_at', new Date().toISOString())
  },

  // Subscribe to new notifications for a user
  subscribeToUser(userId, callback) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe()

    return () => channel.unsubscribe()
  },
}

// User Alert Rules - custom alert configurations
export const alertRules = {
  // Get all rules for a user
  async getForUser(userId = 'anonymous', enabledOnly = true) {
    let query = supabase
      .from('user_alert_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (enabledOnly) {
      query = query.eq('enabled', true)
    }

    return query
  },

  // Get a single rule by ID
  async getById(ruleId) {
    return supabase
      .from('user_alert_rules')
      .select('*')
      .eq('id', ruleId)
      .single()
  },

  // Create a new rule
  async create(rule) {
    const {
      userId = 'anonymous',
      ruleName,
      ruleType,
      conditions = {},
      notifyEmail = true,
      notifyInApp = true,
    } = rule

    return supabase.from('user_alert_rules').insert({
      user_id: userId,
      rule_name: ruleName,
      rule_type: ruleType,
      conditions,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
      enabled: true,
    }).select().single()
  },

  // Update a rule
  async update(ruleId, updates) {
    return supabase
      .from('user_alert_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()
  },

  // Delete a rule
  async delete(ruleId) {
    return supabase
      .from('user_alert_rules')
      .delete()
      .eq('id', ruleId)
  },

  // Toggle rule enabled status
  async toggle(ruleId, enabled) {
    return supabase
      .from('user_alert_rules')
      .update({ enabled })
      .eq('id', ruleId)
      .select()
      .single()
  },

  // Record a trigger event
  async recordTrigger(ruleId, userId, triggerData, notificationSent = false, emailSent = false) {
    return supabase.from('alert_triggers').insert({
      rule_id: ruleId,
      user_id: userId,
      trigger_data: triggerData,
      notification_sent: notificationSent,
      email_sent: emailSent,
    })
  },
}

// Threat Hunts - actionable detection guides
export const threatHunts = {
  // Get all active hunts
  async getAll(options = {}) {
    const { limit = 50, activeOnly = true, search = '', actorId = null } = options

    let query = supabase
      .from('threat_hunts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,actor_name.ilike.%${search}%,tags.cs.{${search}}`)
    }

    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    return query
  },

  // Get hunt by ID
  async getById(huntId) {
    return supabase
      .from('threat_hunts')
      .select('*')
      .eq('id', huntId)
      .single()
  },

  // Get hunts for a specific actor
  async getForActor(actorId) {
    return supabase
      .from('threat_hunts')
      .select('*')
      .eq('actor_id', actorId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
  },

  // Get user's progress on hunts
  async getUserProgress(userId = 'anonymous') {
    return supabase
      .from('user_hunt_progress')
      .select(`
        *,
        hunt:threat_hunts(id, title, actor_name, confidence)
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
  },

  // Start a hunt (record user started)
  async startHunt(userId = 'anonymous', huntId) {
    return supabase.from('user_hunt_progress').upsert({
      user_id: userId,
      hunt_id: huntId,
      status: 'in_progress',
      completed_checks: [],
    }, { onConflict: 'user_id,hunt_id' }).select().single()
  },

  // Update hunt progress
  async updateProgress(userId = 'anonymous', huntId, completedChecks, notes = null) {
    return supabase
      .from('user_hunt_progress')
      .update({
        completed_checks: completedChecks,
        notes,
        status: 'in_progress',
      })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
      .select()
      .single()
  },

  // Complete a hunt
  async completeHunt(userId = 'anonymous', huntId, notes = null) {
    return supabase
      .from('user_hunt_progress')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
      .select()
      .single()
  },

  // Dismiss a hunt
  async dismissHunt(userId = 'anonymous', huntId) {
    return supabase
      .from('user_hunt_progress')
      .update({ status: 'dismissed' })
      .eq('user_id', userId)
      .eq('hunt_id', huntId)
  },
}

// ============================================
// TEAMS & COLLABORATION
// ============================================
export const teams = {
  // Get user's teams
  async getUserTeams(userId) {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        team_id,
        role,
        joined_at,
        teams (
          id,
          name,
          slug,
          description,
          owner_id,
          settings,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })

    if (error) return { data: null, error }
    return { data: data?.map(m => ({ ...m.teams, role: m.role, joined_at: m.joined_at })), error: null }
  },

  // Get team by ID
  async getTeam(teamId) {
    return supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()
  },

  // Create a new team
  async createTeam(userId, name, description = '') {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        slug,
        description,
        owner_id: userId,
      })
      .select()
      .single()

    if (teamError) return { data: null, error: teamError }

    // Add owner as member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        email: '', // Will be updated from Firebase
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (memberError) return { data: null, error: memberError }

    return { data: team, error: null }
  },

  // Update team
  async updateTeam(teamId, updates) {
    return supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single()
  },

  // Delete team
  async deleteTeam(teamId) {
    return supabase
      .from('teams')
      .delete()
      .eq('id', teamId)
  },

  // Get team members
  async getMembers(teamId) {
    return supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true })
  },

  // Add team member
  async addMember(teamId, email, role = 'viewer', invitedBy) {
    return supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: '', // Will be set when user accepts
        email,
        role,
        invited_by: invitedBy,
      })
      .select()
      .single()
  },

  // Update member role
  async updateMemberRole(teamId, userId, role) {
    return supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .select()
      .single()
  },

  // Remove member
  async removeMember(teamId, userId) {
    return supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)
  },

  // Create invitation
  async createInvitation(teamId, email, role, invitedBy) {
    const token = crypto.randomUUID() + crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 day expiry

    return supabase
      .from('team_invitations')
      .upsert({
        team_id: teamId,
        email,
        role,
        token,
        invited_by: invitedBy,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'team_id,email' })
      .select()
      .single()
  },

  // Accept invitation
  async acceptInvitation(token, userId, displayName) {
    // Get invitation
    const { data: invite, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invite) {
      return { data: null, error: { message: 'Invalid or expired invitation' } }
    }

    // Add member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invite.team_id,
        user_id: userId,
        email: invite.email,
        display_name: displayName,
        role: invite.role,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      })

    if (memberError) return { data: null, error: memberError }

    // Mark invitation as accepted
    await supabase
      .from('team_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return { data: invite, error: null }
  },

  // Get pending invitations for a team
  async getPendingInvitations(teamId) {
    return supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
  },

  // Cancel invitation
  async cancelInvitation(invitationId) {
    return supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)
  },

  // Log activity
  async logActivity(teamId, userId, action, entityType = null, entityId = null, details = {}) {
    return supabase
      .from('team_activity_log')
      .insert({
        team_id: teamId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      })
  },

  // Get activity log
  async getActivityLog(teamId, limit = 50) {
    return supabase
      .from('team_activity_log')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },
}

// ============================================
// SHARED WATCHLISTS
// ============================================
export const sharedWatchlists = {
  // Get team's watchlists
  async getTeamWatchlists(teamId) {
    return supabase
      .from('shared_watchlists')
      .select(`
        *,
        items:shared_watchlist_items(count)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
  },

  // Get watchlist by ID
  async getWatchlist(watchlistId) {
    return supabase
      .from('shared_watchlists')
      .select('*')
      .eq('id', watchlistId)
      .single()
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
    return supabase
      .from('shared_watchlists')
      .delete()
      .eq('id', watchlistId)
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
          const { data } = await supabase
            .from(table)
            .select('*')
            .eq('id', item.entity_id)
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
    return supabase
      .from('shared_watchlist_items')
      .delete()
      .eq('id', itemId)
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

export default supabase
