/**
 * Industry Benchmarking Module
 * API for comparing threat landscape against industry peers
 */

import { supabase } from './supabase'

// Sector display names and colors
export const SECTOR_CONFIG = {
  healthcare: { label: 'Healthcare', color: '#ef4444' },
  finance: { label: 'Finance', color: '#f97316' },
  technology: { label: 'Technology', color: '#3b82f6' },
  manufacturing: { label: 'Manufacturing', color: '#8b5cf6' },
  retail: { label: 'Retail', color: '#ec4899' },
  education: { label: 'Education', color: '#10b981' },
  government: { label: 'Government', color: '#6366f1' },
  energy: { label: 'Energy', color: '#f59e0b' },
  transportation: { label: 'Transportation', color: '#14b8a6' },
  telecommunications: { label: 'Telecommunications', color: '#06b6d4' },
  legal: { label: 'Legal', color: '#84cc16' },
  construction: { label: 'Construction', color: '#78716c' },
  real_estate: { label: 'Real Estate', color: '#a855f7' },
  hospitality: { label: 'Hospitality', color: '#f43f5e' },
  media: { label: 'Media', color: '#0ea5e9' },
  defense: { label: 'Defense', color: '#64748b' },
  pharmaceuticals: { label: 'Pharmaceuticals', color: '#22c55e' },
  agriculture: { label: 'Agriculture', color: '#65a30d' },
  professional_services: { label: 'Professional Services', color: '#7c3aed' },
  nonprofit: { label: 'Nonprofit', color: '#fb923c' },
  Other: { label: 'Other', color: '#9ca3af' },
}

// Period types
export const PERIOD_TYPES = {
  daily: { label: 'Daily', days: 1 },
  weekly: { label: 'Weekly', days: 7 },
  monthly: { label: 'Monthly', days: 30 },
  quarterly: { label: 'Quarterly', days: 90 },
}

export const benchmarks = {
  /**
   * Get latest benchmark snapshot
   */
  async getLatestSnapshot(periodType = 'weekly') {
    const { data, error } = await supabase
      .from('benchmark_snapshots')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get benchmark history
   */
  async getSnapshotHistory(periodType = 'weekly', limit = 12) {
    const { data, error } = await supabase
      .from('benchmark_snapshots')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get sector benchmarks
   */
  async getSectorBenchmarks(periodType = 'weekly') {
    const { data, error } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .order('incident_count', { ascending: false })
      .limit(50)

    if (error) throw error

    // Group by latest period
    const latestPeriod = data?.[0]?.period_start
    return (data || []).filter((d) => d.period_start === latestPeriod)
  },

  /**
   * Get benchmark for specific sector
   */
  async getSectorBenchmark(sector, periodType = 'weekly') {
    const { data, error } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .eq('sector', sector)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get sector history for trend analysis
   */
  async getSectorHistory(sector, periodType = 'weekly', limit = 12) {
    const { data, error } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .eq('sector', sector)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).reverse()
  },

  /**
   * Compare sectors
   */
  async compareSectors(sectors, periodType = 'weekly') {
    const { data, error } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .in('sector', sectors)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })

    if (error) throw error

    // Group by sector, taking latest for each
    const result = {}
    for (const sector of sectors) {
      result[sector] = (data || []).find((d) => d.sector === sector)
    }
    return result
  },

  /**
   * Get sector rankings
   */
  async getSectorRankings(periodType = 'weekly') {
    const benchmarks = await this.getSectorBenchmarks(periodType)

    return benchmarks
      .sort((a, b) => b.incident_count - a.incident_count)
      .map((b, index) => ({
        ...b,
        rank: index + 1,
        config: SECTOR_CONFIG[b.sector] || SECTOR_CONFIG.Other,
      }))
  },

  /**
   * Get industry overview statistics
   */
  async getIndustryOverview(periodType = 'weekly') {
    const [snapshot, sectorBenchmarks] = await Promise.all([
      this.getLatestSnapshot(periodType),
      this.getSectorBenchmarks(periodType),
    ])

    // Calculate additional metrics
    const totalIncidents = sectorBenchmarks.reduce((sum, s) => sum + s.incident_count, 0)
    const avgIncidentsPerSector = Math.round(totalIncidents / sectorBenchmarks.length) || 0
    const mostTargeted = sectorBenchmarks[0] || null
    const fastestGrowing =
      [...sectorBenchmarks].sort((a, b) => (b.wow_change || 0) - (a.wow_change || 0))[0] || null

    return {
      snapshot,
      sectorBenchmarks,
      metrics: {
        totalIncidents,
        avgIncidentsPerSector,
        activeSectors: sectorBenchmarks.length,
        mostTargeted: mostTargeted
          ? {
              sector: mostTargeted.sector,
              label: SECTOR_CONFIG[mostTargeted.sector]?.label || mostTargeted.sector,
              count: mostTargeted.incident_count,
            }
          : null,
        fastestGrowing:
          fastestGrowing && fastestGrowing.wow_change > 0
            ? {
                sector: fastestGrowing.sector,
                label: SECTOR_CONFIG[fastestGrowing.sector]?.label || fastestGrowing.sector,
                change: fastestGrowing.wow_change,
              }
            : null,
      },
    }
  },

  /**
   * Calculate position of user's sector relative to industry
   */
  async getUserSectorPosition(userSector, periodType = 'weekly') {
    const rankings = await this.getSectorRankings(periodType)
    const totalSectors = rankings.length

    const userRanking = rankings.find((r) => r.sector === userSector)
    if (!userRanking) return null

    const avgIncidents = rankings.reduce((sum, r) => sum + r.incident_count, 0) / totalSectors
    const percentile = Math.round(((totalSectors - userRanking.rank + 1) / totalSectors) * 100)

    return {
      rank: userRanking.rank,
      totalSectors,
      percentile,
      incidentCount: userRanking.incident_count,
      avgIncidents: Math.round(avgIncidents),
      aboveAverage: userRanking.incident_count > avgIncidents,
      trend: userRanking.wow_change,
      riskScore: userRanking.risk_score,
    }
  },
}

export const benchmarkPreferences = {
  /**
   * Get user's benchmark preferences
   */
  async get(userId) {
    const { data, error } = await supabase
      .from('benchmark_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Update preferences
   */
  async update(userId, updates) {
    const { data, error } = await supabase
      .from('benchmark_preferences')
      .upsert(
        {
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Set comparison sectors
   */
  async setComparisonSectors(userId, sectors) {
    return this.update(userId, { comparison_sectors: sectors })
  },

  /**
   * Toggle data contribution
   */
  async toggleDataContribution(userId, contribute) {
    return this.update(userId, { contribute_anonymized_data: contribute })
  },
}

// Helper: Get risk level from score
export function getRiskLevel(score) {
  if (score >= 80) return { level: 'critical', label: 'Critical', color: 'red' }
  if (score >= 60) return { level: 'high', label: 'High', color: 'orange' }
  if (score >= 40) return { level: 'medium', label: 'Medium', color: 'yellow' }
  return { level: 'low', label: 'Low', color: 'green' }
}

// Helper: Format trend percentage
export function formatTrend(value) {
  if (value === null || value === undefined) return { text: 'N/A', color: 'gray' }
  const rounded = Math.round(value * 10) / 10
  if (rounded > 0) return { text: `+${rounded}%`, color: 'red', direction: 'up' }
  if (rounded < 0) return { text: `${rounded}%`, color: 'green', direction: 'down' }
  return { text: '0%', color: 'gray', direction: 'flat' }
}

// Helper: Get sector color
export function getSectorColor(sector) {
  return SECTOR_CONFIG[sector]?.color || SECTOR_CONFIG.Other.color
}

// Helper: Get sector label
export function getSectorLabel(sector) {
  return SECTOR_CONFIG[sector]?.label || sector
}

export default { benchmarks, benchmarkPreferences }
