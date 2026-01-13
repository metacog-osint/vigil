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

  async getBySeverity() {
    // Fetch all vulnerabilities with CVSS scores
    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('cvss_score, severity')

    if (error || !data) return []

    // Count by severity
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const row of data) {
      if (row.cvss_score >= 9.0) counts.critical++
      else if (row.cvss_score >= 7.0) counts.high++
      else if (row.cvss_score >= 4.0) counts.medium++
      else counts.low++
    }

    // Return format for treemap
    return [
      { name: 'Critical', value: counts.critical, severity: 'critical' },
      { name: 'High', value: counts.high, severity: 'high' },
      { name: 'Medium', value: counts.medium, severity: 'medium' },
      { name: 'Low', value: counts.low, severity: 'low' },
    ].filter(d => d.value > 0)
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
      .single()

    if (error && error.code === 'PGRST116') {
      // No row found, return defaults
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

export default supabase
