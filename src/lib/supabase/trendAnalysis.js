/**
 * Trend Analysis Module
 * Temporal intelligence and trend calculations
 */

import { supabase } from './client'

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

    const weeklyBySector = {}

    for (const incident of (data || [])) {
      const date = new Date(incident.discovered_date)
      const weekStart = this.getWeekStart(date)
      const sector = incident.victim_sector || 'Unknown'
      const key = `${weekStart}|${sector}`

      weeklyBySector[key] = (weeklyBySector[key] || 0) + 1
    }

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

export default trendAnalysis
