/**
 * Unified Events Module
 * Aggregates all security events into a single timeline
 */

import { supabase } from './client'

export const unifiedEvents = {
  // Event type configuration
  eventTypes: {
    ransomware: {
      label: 'Ransomware',
      color: 'red',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400',
      borderClass: 'border-red-500/50',
    },
    alert: {
      label: 'Alert',
      color: 'yellow',
      bgClass: 'bg-yellow-500/20',
      textClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/50',
    },
    vulnerability: {
      label: 'KEV',
      color: 'orange',
      bgClass: 'bg-orange-500/20',
      textClass: 'text-orange-400',
      borderClass: 'border-orange-500/50',
    },
    ioc: {
      label: 'IOC',
      color: 'blue',
      bgClass: 'bg-blue-500/20',
      textClass: 'text-blue-400',
      borderClass: 'border-blue-500/50',
    },
    malware: {
      label: 'Malware',
      color: 'cyan',
      bgClass: 'bg-cyan-500/20',
      textClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/50',
    },
    breach: {
      label: 'Breach',
      color: 'purple',
      bgClass: 'bg-purple-500/20',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/50',
    },
  },

  // Normalize incident to unified event
  normalizeIncident(incident) {
    const severityMap = {
      leaked: 'critical',
      confirmed: 'high',
      claimed: 'medium',
      paid: 'medium',
      removed: 'low',
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
      raw: incident,
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
      raw: alert,
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
      raw: vuln,
    }
  },

  // Normalize IOC to unified event
  normalizeIOC(ioc) {
    const severityMap = {
      high: 'high',
      medium: 'medium',
      low: 'low',
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
      raw: ioc,
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
      raw: sample,
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
      raw: breach,
    }
  },

  // Get unified timeline with all event types
  async getTimeline(options = {}) {
    const { days = 30, types = [], severity = '', search = '', limit = 100, offset = 0 } = options

    const cutoffDate =
      days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null
    const activeTypes =
      types.length > 0
        ? types
        : ['ransomware', 'alert', 'vulnerability', 'ioc', 'malware', 'breach']

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
      queries.push(q.then((r) => ({ type: 'ransomware', data: r.data || [], error: r.error })))
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
      queries.push(q.then((r) => ({ type: 'alert', data: r.data || [], error: r.error })))
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
      queries.push(q.then((r) => ({ type: 'vulnerability', data: r.data || [], error: r.error })))
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
      queries.push(q.then((r) => ({ type: 'ioc', data: r.data || [], error: r.error })))
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
      queries.push(q.then((r) => ({ type: 'malware', data: r.data || [], error: r.error })))
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
      queries.push(q.then((r) => ({ type: 'breach', data: r.data || [], error: r.error })))
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
        breach: this.normalizeBreach,
      }[result.type]

      if (normalizer) {
        allEvents = allEvents.concat(result.data.map((item) => normalizer.call(this, item)))
      }
    }

    // Filter by severity if specified
    if (severity) {
      allEvents = allEvents.filter((e) => e.severity === severity)
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
      error: null,
    }
  },

  // Get statistics for all event types
  async getStats(days = 30) {
    const cutoffDate =
      days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null

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
      total:
        (incidents.count || 0) +
        (alerts.count || 0) +
        (vulns.count || 0) +
        (iocs.count || 0) +
        (malware.count || 0) +
        (breaches.count || 0),
    }
  },

  // Get daily counts for timeline chart
  async getDailyCounts(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const cutoff = cutoffDate.toISOString().split('T')[0]

    const [incidentsData, alertsData, vulnsData] = await Promise.all([
      supabase.from('incidents').select('discovered_date').gte('discovered_date', cutoff),
      supabase
        .from('alerts')
        .select('published_date')
        .gte('published_date', cutoffDate.toISOString()),
      supabase
        .from('vulnerabilities')
        .select('kev_date')
        .not('kev_date', 'is', null)
        .gte('kev_date', cutoff),
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
  },
}

export default unifiedEvents
