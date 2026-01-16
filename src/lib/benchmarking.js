/**
 * Industry Benchmarking Module
 *
 * Provides anonymized aggregate statistics for sector comparison.
 * Allows organizations to compare their security posture against industry peers.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const SHARE_LEVELS = {
  NONE: 'none',
  AGGREGATES: 'aggregates',
  DETAILED: 'detailed',
}

export const ORG_SIZES = {
  SMALL: 'small', // 1-50 employees
  MEDIUM: 'medium', // 51-500 employees
  LARGE: 'large', // 501-5000 employees
  ENTERPRISE: 'enterprise', // 5000+ employees
}

export const METRIC_TYPES = {
  INCIDENT_AVG: 'incident_avg_per_org',
  RESPONSE_TIME: 'response_time_avg_minutes',
  PATCH_TIME: 'patch_time_avg_days',
  VULN_EXPOSURE: 'vuln_exposure_avg',
}

export const COMPARISON_STATUS = {
  BETTER: 'better',
  AVERAGE: 'average',
  WORSE: 'worse',
}

// ============================================
// PARTICIPATION
// ============================================

export const participation = {
  /**
   * Get team's benchmark participation status
   */
  async getStatus(teamId) {
    const { data, error } = await supabase
      .from('benchmark_participants')
      .select('*')
      .eq('team_id', teamId)
      .single()

    return { data, error }
  },

  /**
   * Opt in to benchmarking
   */
  async optIn(teamId, options = {}) {
    const { sector, orgSize, region, shareLevel = SHARE_LEVELS.AGGREGATES } = options

    const { data, error } = await supabase
      .from('benchmark_participants')
      .upsert({
        team_id: teamId,
        opted_in: true,
        opted_in_at: new Date().toISOString(),
        opted_out_at: null,
        share_level: shareLevel,
        sector,
        org_size: orgSize,
        region,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Opt out of benchmarking
   */
  async optOut(teamId) {
    const { data, error } = await supabase
      .from('benchmark_participants')
      .update({
        opted_in: false,
        opted_out_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update participation settings
   */
  async updateSettings(teamId, settings) {
    const { data, error } = await supabase
      .from('benchmark_participants')
      .update(settings)
      .eq('team_id', teamId)
      .select()
      .single()

    return { data, error }
  },
}

// ============================================
// BENCHMARK DATA
// ============================================

export const benchmarks = {
  /**
   * Get benchmark metrics for a sector
   */
  async getBySector(sector, options = {}) {
    const { periodType = 'monthly', limit = 12 } = options

    const { data, error } = await supabase
      .from('benchmark_metrics')
      .select('*')
      .eq('sector', sector)
      .eq('period_type', periodType)
      .gte('org_count', 3) // Minimum for anonymity
      .order('period_start', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  /**
   * Get latest benchmarks for all sectors
   */
  async getLatestAll(options = {}) {
    const { periodType = 'monthly' } = options

    const { data, error } = await supabase
      .from('benchmark_metrics')
      .select('*')
      .eq('period_type', periodType)
      .gte('org_count', 3)
      .order('period_start', { ascending: false })

    if (error) return { data: null, error }

    // Get latest for each sector
    const latestBySector = {}
    data.forEach((metric) => {
      if (!latestBySector[metric.sector]) {
        latestBySector[metric.sector] = metric
      }
    })

    return { data: Object.values(latestBySector), error: null }
  },

  /**
   * Get sector rankings
   */
  async getRankings(metric = METRIC_TYPES.INCIDENT_AVG) {
    const { data, error } = await supabase.rpc('get_sector_rankings', {
      p_metric: metric,
    })

    return { data, error }
  },

  /**
   * Compare organization metrics to sector benchmark
   */
  async compare(sector, orgMetrics) {
    const { data, error } = await supabase.rpc('get_benchmark_comparison', {
      p_sector: sector,
      p_org_metrics: orgMetrics,
    })

    return { data, error }
  },
}

// ============================================
// REPORTS
// ============================================

export const reports = {
  /**
   * Get available benchmark reports
   */
  async getAll(options = {}) {
    const { isPublic = true, sector, reportType, limit = 20 } = options

    let query = supabase
      .from('benchmark_reports')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(limit)

    if (isPublic !== undefined) {
      query = query.eq('is_public', isPublic)
    }
    if (sector) {
      query = query.eq('sector', sector)
    }
    if (reportType) {
      query = query.eq('report_type', reportType)
    }

    const { data, error } = await query

    return { data, error }
  },

  /**
   * Get a specific report
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('benchmark_reports')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  /**
   * Get the latest report for a sector
   */
  async getLatest(sector) {
    const { data, error } = await supabase
      .from('benchmark_reports')
      .select('*')
      .eq('sector', sector)
      .eq('is_public', true)
      .order('period_start', { ascending: false })
      .limit(1)
      .single()

    return { data, error }
  },
}

// ============================================
// CONTRIBUTION
// ============================================

export const contributions = {
  /**
   * Submit benchmark contribution for a team
   */
  async submit(teamId, periodStart, periodEnd) {
    const { data, error } = await supabase.rpc('submit_benchmark_contribution', {
      p_team_id: teamId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })

    return { data, error }
  },
}

// ============================================
// ANALYSIS HELPERS
// ============================================

/**
 * Calculate comparison status (better/average/worse)
 */
export function calculateComparisonStatus(value, sectorAvg, sectorP90, lowerIsBetter = true) {
  if (lowerIsBetter) {
    if (value < sectorAvg * 0.8) return COMPARISON_STATUS.BETTER
    if (value > sectorP90) return COMPARISON_STATUS.WORSE
    return COMPARISON_STATUS.AVERAGE
  } else {
    if (value > sectorAvg * 1.2) return COMPARISON_STATUS.BETTER
    if (value < sectorAvg * 0.8) return COMPARISON_STATUS.WORSE
    return COMPARISON_STATUS.AVERAGE
  }
}

/**
 * Calculate percentile position
 */
export function calculatePercentile(value, sectorData) {
  if (!sectorData || sectorData.length === 0) return null

  const sorted = [...sectorData].sort((a, b) => a - b)
  const belowCount = sorted.filter((v) => v < value).length
  return Math.round((belowCount / sorted.length) * 100)
}

/**
 * Generate benchmark summary for an organization
 */
export async function generateBenchmarkSummary(teamId, sector) {
  // Get team's participation status
  const { data: participant } = await participation.getStatus(teamId)

  if (!participant?.opted_in) {
    return {
      available: false,
      message: 'Opt in to benchmarking to see how you compare to your industry',
    }
  }

  // Get sector benchmarks
  const { data: sectorBenchmarks } = await benchmarks.getBySector(sector, { limit: 1 })

  if (!sectorBenchmarks || sectorBenchmarks.length === 0) {
    return {
      available: false,
      message: 'Not enough data available for your sector yet',
    }
  }

  const latest = sectorBenchmarks[0]

  return {
    available: true,
    sector,
    period: {
      start: latest.period_start,
      end: latest.period_end,
    },
    participants: latest.org_count,
    metrics: {
      incidentAvg: latest.incident_avg_per_org,
      incidentMedian: latest.incident_median_per_org,
      responseTimeAvg: latest.response_time_avg_minutes,
      patchTimeAvg: latest.patch_time_avg_days,
      vulnExposureAvg: latest.vuln_exposure_avg,
    },
    severityDistribution: {
      critical: latest.incidents_critical,
      high: latest.incidents_high,
      medium: latest.incidents_medium,
      low: latest.incidents_low,
    },
    topAttackVectors: latest.top_attack_vectors || [],
    topThreatActors: latest.top_threat_actors || [],
  }
}

/**
 * Get trend data for a metric over time
 */
export async function getMetricTrend(sector, metric, periods = 12) {
  const { data: benchmarkData } = await benchmarks.getBySector(sector, {
    periodType: 'monthly',
    limit: periods,
  })

  if (!benchmarkData || benchmarkData.length === 0) {
    return { data: [], error: null }
  }

  const trend = benchmarkData
    .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
    .map((b) => ({
      period: b.period_start,
      value: b[metric] || 0,
      participants: b.org_count,
    }))

  return { data: trend, error: null }
}

/**
 * Compare two sectors
 */
export async function compareSectors(sector1, sector2) {
  const [data1, data2] = await Promise.all([
    benchmarks.getBySector(sector1, { limit: 1 }),
    benchmarks.getBySector(sector2, { limit: 1 }),
  ])

  if (!data1.data?.[0] || !data2.data?.[0]) {
    return { available: false, message: 'Insufficient data for comparison' }
  }

  const b1 = data1.data[0]
  const b2 = data2.data[0]

  return {
    available: true,
    sectors: [sector1, sector2],
    comparison: {
      incidentAvg: {
        [sector1]: b1.incident_avg_per_org,
        [sector2]: b2.incident_avg_per_org,
        difference: ((b1.incident_avg_per_org - b2.incident_avg_per_org) / b2.incident_avg_per_org) * 100,
      },
      responseTime: {
        [sector1]: b1.response_time_avg_minutes,
        [sector2]: b2.response_time_avg_minutes,
        difference: ((b1.response_time_avg_minutes - b2.response_time_avg_minutes) / b2.response_time_avg_minutes) * 100,
      },
      patchTime: {
        [sector1]: b1.patch_time_avg_days,
        [sector2]: b2.patch_time_avg_days,
        difference: ((b1.patch_time_avg_days - b2.patch_time_avg_days) / b2.patch_time_avg_days) * 100,
      },
    },
  }
}

export default {
  participation,
  benchmarks,
  reports,
  contributions,
  generateBenchmarkSummary,
  getMetricTrend,
  compareSectors,
  calculateComparisonStatus,
  calculatePercentile,
  SHARE_LEVELS,
  ORG_SIZES,
  METRIC_TYPES,
  COMPARISON_STATUS,
}
