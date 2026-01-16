/**
 * Incidents Module
 * Database queries for incident management
 */

import { supabase } from './client'

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

    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('discovered_date', cutoffDate.toISOString())
    }

    if (search) {
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

    const { data, error } = await supabase
      .from('incidents')
      .select('victim_sector')
      .gte('discovered_date', cutoffDate.toISOString())

    if (error || !data) return []

    const counts = {}
    for (const row of data) {
      const sector = row.victim_sector || 'Unknown'
      counts[sector] = (counts[sector] || 0) + 1
    }

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

    const counts = {}
    for (const row of data) {
      const date = row.discovered_date?.split('T')[0]
      if (date) {
        counts[date] = (counts[date] || 0) + 1
      }
    }

    return Object.entries(counts).map(([date, count]) => ({ date, count }))
  },

  async getSectorDetails(days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const prevCutoff = new Date()
    prevCutoff.setDate(prevCutoff.getDate() - (days * 2))

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

      const actorName = incident.threat_actor?.name || 'Unknown'
      sectorMap[sector].actorCounts[actorName] = (sectorMap[sector].actorCounts[actorName] || 0) + 1

      if (sectorMap[sector].recentIncidents.length < 5) {
        sectorMap[sector].recentIncidents.push(incident)
      }
    }

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

export default incidents
