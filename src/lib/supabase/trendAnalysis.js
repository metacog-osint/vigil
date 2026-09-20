/**
 * Trend Analysis Module
 * Temporal intelligence and trend calculations
 */

import { supabase } from './client'
import { RECENT_WINDOW_DAYS, comparableWindows, countIncidents, tally } from './counts'

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
      ),
    }
  },

  /**
   * The last seven days against the seven before them.
   *
   * This used to take "this week" to mean the calendar week so far. On a
   * Sunday that is a single day, and it was reported against a full previous
   * week as "12 incidents this week, down 94%" - on the same screen as "197
   * new incidents (7d)" and one group credited with 33 that week. Both
   * windows now come from comparableWindows(), so they cannot differ in
   * length, and the current window is the same one getChangeSummary reports.
   */
  async calculateWeekOverWeek() {
    const { current, previous } = comparableWindows(RECENT_WINDOW_DAYS)

    const [currentCount, previousCount] = await Promise.all([
      countIncidents(current),
      countIncidents(previous),
    ])

    // A count that failed is not a week with no incidents in it, so there is
    // no change to report either.
    const bothRead = typeof currentCount === 'number' && typeof previousCount === 'number'
    const changePercent =
      bothRead && previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : null

    return {
      currentWeek: { incidents_total: currentCount },
      previousWeek: { incidents_total: previousCount },
      incidentChange: changePercent,
      windowDays: RECENT_WINDOW_DAYS,
    }
  },

  calculateSectorChanges(current, previous) {
    const changes = []
    const allSectors = new Set([...Object.keys(current || {}), ...Object.keys(previous || {})])

    for (const sector of allSectors) {
      const curr = current?.[sector] || 0
      const prev = previous?.[sector] || 0
      const change = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0

      changes.push({
        sector,
        current: curr,
        previous: prev,
        change,
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

    for (const incident of data || []) {
      const date = new Date(incident.discovered_date)
      const weekStart = this.getWeekStart(date)
      const sector = incident.victim_sector || 'Unknown'
      const key = `${weekStart}|${sector}`

      weeklyBySector[key] = (weeklyBySector[key] || 0) + 1
    }

    const weeks = [...new Set(Object.keys(weeklyBySector).map((k) => k.split('|')[0]))].sort()
    const sectors = [...new Set(Object.keys(weeklyBySector).map((k) => k.split('|')[1]))]

    return {
      weeks,
      sectors,
      data: weeklyBySector,
    }
  },

  getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split('T')[0]
  },

  async getChangeSummary(sinceDays = RECENT_WINDOW_DAYS) {
    const { current } = comparableWindows(sinceDays)
    const cutoff = current.from

    const [newIncidents, newActors, newKEVs, escalatingActors] = await Promise.all([
      // The same window, from the same place, as the week-over-week tile.
      countIncidents(current),

      supabase
        .from('threat_actors')
        .select('*', { count: 'exact', head: true })
        // created_at is a timestamp, but the same cutoff date: midnight on
        // the day the window opens, so this agrees with the counts above.
        .gte('created_at', cutoff),

      supabase
        .from('vulnerabilities')
        .select('*', { count: 'exact', head: true })
        .gte('kev_date', cutoff),

      supabase
        .from('threat_actors')
        .select('id, name, incidents_7d, trend_status')
        .eq('trend_status', 'ESCALATING')
        .order('incidents_7d', { ascending: false })
        .limit(10),
    ])

    return {
      newIncidents,
      newActors: tally(newActors),
      newKEVs: tally(newKEVs),
      escalatingActors: escalatingActors.data || [],
      sinceDays,
    }
  },

  async getActorTrajectories(actorIds, days = 90) {
    return supabase
      .from('actor_trend_history')
      .select('*')
      .in('actor_id', actorIds)
      .gte(
        'recorded_date',
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      .order('recorded_date', { ascending: true })
  },
}

export default trendAnalysis
