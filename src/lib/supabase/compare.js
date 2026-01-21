/**
 * Compare Module
 * Database queries for time-based comparison analytics
 */
import { supabase } from './client'

export const compare = {
  /**
   * Get daily incident counts for a date range
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Array} Daily counts [{date, count}]
   */
  async getIncidentTrend(startDate, endDate) {
    const { data, error } = await supabase
      .from('incidents')
      .select('discovered_date')
      .gte('discovered_date', startDate.toISOString())
      .lte('discovered_date', endDate.toISOString())

    if (error) {
      console.error('Error fetching incident trend:', error)
      return []
    }

    // Group by date
    const countsByDate = {}
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0]
      countsByDate[dateKey] = 0
      current.setDate(current.getDate() + 1)
    }

    // Count incidents per day
    data?.forEach((incident) => {
      if (incident.discovered_date) {
        const dateKey = incident.discovered_date.split('T')[0]
        if (countsByDate[dateKey] !== undefined) {
          countsByDate[dateKey]++
        }
      }
    })

    // Convert to array format
    return Object.entries(countsByDate).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: count,
    }))
  },

  /**
   * Get incident counts by region for a date range
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Array} Region breakdown [{name, value}]
   */
  async getRegionBreakdown(startDate, endDate) {
    const { data, error } = await supabase
      .from('incidents')
      .select('victim_country')
      .gte('discovered_date', startDate.toISOString())
      .lte('discovered_date', endDate.toISOString())

    if (error) {
      console.error('Error fetching region breakdown:', error)
      return []
    }

    // Map countries to regions
    const regionMap = {
      // North America
      US: 'north_america',
      CA: 'north_america',
      MX: 'north_america',
      'United States': 'north_america',
      Canada: 'north_america',
      Mexico: 'north_america',
      // Europe
      GB: 'europe',
      DE: 'europe',
      FR: 'europe',
      IT: 'europe',
      ES: 'europe',
      NL: 'europe',
      BE: 'europe',
      CH: 'europe',
      AT: 'europe',
      PL: 'europe',
      SE: 'europe',
      NO: 'europe',
      DK: 'europe',
      FI: 'europe',
      IE: 'europe',
      PT: 'europe',
      CZ: 'europe',
      RO: 'europe',
      HU: 'europe',
      GR: 'europe',
      'United Kingdom': 'europe',
      Germany: 'europe',
      France: 'europe',
      Italy: 'europe',
      Spain: 'europe',
      Netherlands: 'europe',
      Switzerland: 'europe',
      Poland: 'europe',
      // Asia Pacific
      CN: 'asia_pacific',
      JP: 'asia_pacific',
      KR: 'asia_pacific',
      IN: 'asia_pacific',
      AU: 'asia_pacific',
      NZ: 'asia_pacific',
      SG: 'asia_pacific',
      HK: 'asia_pacific',
      TW: 'asia_pacific',
      TH: 'asia_pacific',
      MY: 'asia_pacific',
      ID: 'asia_pacific',
      PH: 'asia_pacific',
      VN: 'asia_pacific',
      China: 'asia_pacific',
      Japan: 'asia_pacific',
      'South Korea': 'asia_pacific',
      India: 'asia_pacific',
      Australia: 'asia_pacific',
      Singapore: 'asia_pacific',
      // Latin America
      BR: 'latin_america',
      AR: 'latin_america',
      CL: 'latin_america',
      CO: 'latin_america',
      PE: 'latin_america',
      VE: 'latin_america',
      EC: 'latin_america',
      Brazil: 'latin_america',
      Argentina: 'latin_america',
      Chile: 'latin_america',
      Colombia: 'latin_america',
      Peru: 'latin_america',
      // Middle East
      AE: 'middle_east',
      SA: 'middle_east',
      IL: 'middle_east',
      TR: 'middle_east',
      IR: 'middle_east',
      IQ: 'middle_east',
      QA: 'middle_east',
      KW: 'middle_east',
      UAE: 'middle_east',
      'Saudi Arabia': 'middle_east',
      Israel: 'middle_east',
      Turkey: 'middle_east',
      Iran: 'middle_east',
      // Africa
      ZA: 'africa',
      EG: 'africa',
      NG: 'africa',
      KE: 'africa',
      MA: 'africa',
      'South Africa': 'africa',
      Egypt: 'africa',
      Nigeria: 'africa',
      Kenya: 'africa',
    }

    // Count by region
    const regionCounts = {
      north_america: 0,
      europe: 0,
      asia_pacific: 0,
      latin_america: 0,
      middle_east: 0,
      africa: 0,
      unknown: 0,
    }

    data?.forEach((incident) => {
      const country = incident.victim_country
      const region = regionMap[country] || 'unknown'
      regionCounts[region]++
    })

    // Convert to array, excluding unknown if empty
    return Object.entries(regionCounts)
      .filter(([name, value]) => name !== 'unknown' || value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  },

  /**
   * Get sector breakdown for a date range
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Array} Sector breakdown [{name, value}]
   */
  async getSectorBreakdown(startDate, endDate) {
    const { data, error } = await supabase
      .from('incidents')
      .select('victim_sector')
      .gte('discovered_date', startDate.toISOString())
      .lte('discovered_date', endDate.toISOString())

    if (error) {
      console.error('Error fetching sector breakdown:', error)
      return []
    }

    // Count by sector
    const sectorCounts = {}
    data?.forEach((incident) => {
      const sector = incident.victim_sector || 'unknown'
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
    })

    return Object.entries(sectorCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  },

  /**
   * Get summary stats for a date range
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Object} Stats {incidents, actors, kevs, iocs}
   */
  async getPeriodStats(startDate, endDate) {
    const [incidentCount, actorCount, kevCount, iocCount] = await Promise.all([
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .gte('discovered_date', startDate.toISOString())
        .lte('discovered_date', endDate.toISOString()),
      supabase
        .from('incidents')
        .select('actor_id')
        .gte('discovered_date', startDate.toISOString())
        .lte('discovered_date', endDate.toISOString())
        .not('actor_id', 'is', null),
      supabase
        .from('vulnerabilities')
        .select('id', { count: 'exact', head: true })
        .not('kev_date', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      supabase
        .from('iocs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
    ])

    // Count unique actors
    const uniqueActors = new Set(actorCount.data?.map((i) => i.actor_id) || [])

    return {
      incidents: incidentCount.count || 0,
      actors: uniqueActors.size,
      kevs: kevCount.count || 0,
      iocs: iocCount.count || 0,
    }
  },

  /**
   * Get comparison data for two time periods
   * @param {Object} timeRange - {currentDays, previousDays}
   * @returns {Object} Full comparison data
   */
  async getComparison(timeRange) {
    const now = new Date()
    const currentEnd = now
    const currentStart = new Date(now - timeRange.currentDays * 24 * 60 * 60 * 1000)
    const previousEnd = new Date(currentStart - 1) // Day before current period
    const previousStart = new Date(previousEnd - timeRange.previousDays * 24 * 60 * 60 * 1000)

    const [
      currentStats,
      previousStats,
      currentTrend,
      previousTrend,
      currentRegions,
      previousRegions,
      currentSectors,
      previousSectors,
    ] = await Promise.all([
      this.getPeriodStats(currentStart, currentEnd),
      this.getPeriodStats(previousStart, previousEnd),
      this.getIncidentTrend(currentStart, currentEnd),
      this.getIncidentTrend(previousStart, previousEnd),
      this.getRegionBreakdown(currentStart, currentEnd),
      this.getRegionBreakdown(previousStart, previousEnd),
      this.getSectorBreakdown(currentStart, currentEnd),
      this.getSectorBreakdown(previousStart, previousEnd),
    ])

    return {
      currentStats,
      previousStats,
      currentTrend,
      previousTrend,
      currentRegions,
      previousRegions,
      currentSectors,
      previousSectors,
      periods: {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
      },
    }
  },
}

export default compare
