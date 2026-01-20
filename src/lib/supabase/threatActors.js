/**
 * Threat Actors Module
 * Database queries for threat actor management
 */

import { supabase } from './client'

export const threatActors = {
  async getAll(options = {}) {
    const {
      limit = 100,
      offset = 0,
      search = '',
      sector = '',
      trendStatus = '',
      actorType = '',
      status = '',
    } = options

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
      .select(
        `
        *,
        incidents:incidents(count),
        iocs:iocs(count)
      `
      )
      .eq('id', id)
      .single()
  },

  async getTopActive(days = 30, limit = 10) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data: incidentCounts, error: countError } = await supabase
      .from('incidents')
      .select('actor_id')
      .gte('discovered_date', cutoffDate.toISOString().split('T')[0])

    if (countError || !incidentCounts) {
      return supabase
        .from('threat_actors')
        .select('*')
        .gte('last_seen', cutoffDate.toISOString())
        .limit(limit)
    }

    const actorCounts = {}
    for (const inc of incidentCounts) {
      if (inc.actor_id) {
        actorCounts[inc.actor_id] = (actorCounts[inc.actor_id] || 0) + 1
      }
    }

    const topActorIds = Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    if (topActorIds.length === 0) {
      return { data: [], error: null }
    }

    const { data: actors, error } = await supabase
      .from('threat_actors')
      .select('*')
      .in('id', topActorIds)

    if (error || !actors) {
      return { data: [], error }
    }

    const actorsWithCounts = actors
      .map((actor) => ({
        ...actor,
        incident_count: [{ count: actorCounts[actor.id] || 0 }],
      }))
      .sort((a, b) => (b.incident_count[0]?.count || 0) - (a.incident_count[0]?.count || 0))

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
      supabase
        .from('threat_actors')
        .select('*', { count: 'exact', head: true })
        .eq('trend_status', 'ESCALATING'),
      supabase
        .from('threat_actors')
        .select('*', { count: 'exact', head: true })
        .eq('trend_status', 'STABLE'),
      supabase
        .from('threat_actors')
        .select('*', { count: 'exact', head: true })
        .eq('trend_status', 'DECLINING'),
    ])

    return {
      escalating: escalating.count || 0,
      stable: stable.count || 0,
      declining: declining.count || 0,
    }
  },
}

export default threatActors
