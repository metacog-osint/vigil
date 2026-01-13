import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// These should be set in your .env file:
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Helper to subscribe to real-time changes
export function subscribeToTable(table, callback, filter = null) {
  let channel = supabase.channel(`${table}-changes`)

  const subscription = channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: table,
      ...(filter && { filter }),
    },
    (payload) => callback(payload)
  )

  channel.subscribe()

  return () => {
    channel.unsubscribe()
  }
}

// Threat Actors queries
export const threatActors = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', sector = '', trendStatus = '' } = options

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

    return supabase
      .from('threat_actors')
      .select(`
        *,
        incident_count:incidents(count)
      `)
      .gte('last_seen', cutoffDate.toISOString())
      .order('incident_velocity', { ascending: false, nullsFirst: true })
      .limit(limit)
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

  async getBySector(days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return supabase
      .rpc('incidents_by_sector', { cutoff_date: cutoffDate.toISOString() })
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
}

// IOCs queries
export const iocs = {
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
}

// Vulnerabilities queries
export const vulnerabilities = {
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

export default supabase
