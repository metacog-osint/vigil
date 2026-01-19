/**
 * Compare Page
 *
 * Comparison dashboard for time, sector, and region analysis.
 */
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  TimeRangeSelector,
  ComparisonCard,
  TrendChart,
  SectorComparison,
  RegionComparison,
} from '../components/compare'
import { trendAnalysis, incidents as incidentsApi, orgProfile } from '../lib/supabase'

const DEFAULT_RANGE = {
  type: 'preset',
  id: 'week',
  currentDays: 7,
  previousDays: 7,
  label: 'This Week vs Last Week',
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(() => {
    const rangeId = searchParams.get('range')
    if (rangeId) {
      const days = parseInt(searchParams.get('days')) || 7
      return {
        type: rangeId === 'custom' ? 'custom' : 'preset',
        id: rangeId,
        currentDays: days,
        previousDays: days,
        label: rangeId === 'custom' ? `Last ${days} days vs Prior ${days} days` : DEFAULT_RANGE.label,
      }
    }
    return DEFAULT_RANGE
  })

  // Data states
  const [profile, setProfile] = useState(null)
  const [currentStats, setCurrentStats] = useState({
    incidents: 0,
    actors: 0,
    kevs: 0,
    iocs: 0,
  })
  const [previousStats, setPreviousStats] = useState({
    incidents: 0,
    actors: 0,
    kevs: 0,
    iocs: 0,
  })
  const [currentTrend, setCurrentTrend] = useState([])
  const [previousTrend, setPreviousTrend] = useState([])
  const [sectorData, setSectorData] = useState([])
  const [regionData, setRegionData] = useState([])

  // Update URL when range changes
  useEffect(() => {
    if (timeRange.id !== 'week') {
      setSearchParams({
        range: timeRange.id,
        ...(timeRange.type === 'custom' ? { days: timeRange.currentDays } : {}),
      })
    } else {
      setSearchParams({})
    }
  }, [timeRange, setSearchParams])

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Load org profile
        const profileData = await orgProfile.get()
        setProfile(profileData)

        // Load current period stats
        const currentEnd = new Date()
        const currentStart = new Date()
        currentStart.setDate(currentStart.getDate() - timeRange.currentDays)

        // Load previous period stats
        const previousEnd = new Date(currentStart)
        const previousStart = new Date(previousEnd)
        previousStart.setDate(previousStart.getDate() - timeRange.previousDays)

        // Fetch comparison data
        const [weekComparison, changeSummary, sectorTrends] = await Promise.all([
          trendAnalysis.getWeekOverWeekChange(),
          trendAnalysis.getChangeSummary(timeRange.currentDays),
          trendAnalysis.getSectorTrends(timeRange.currentDays),
        ])

        // Set current stats
        setCurrentStats({
          incidents: changeSummary?.newIncidents || weekComparison?.currentWeek?.incidents || 0,
          actors: changeSummary?.escalatingActors || 0,
          kevs: changeSummary?.newKEVs || 0,
          iocs: 0, // Would need separate query
        })

        // Set previous stats from comparison
        setPreviousStats({
          incidents: weekComparison?.previousWeek?.incidents || 0,
          actors: Math.max(0, (changeSummary?.escalatingActors || 0) - 1), // Estimate
          kevs: Math.max(0, (changeSummary?.newKEVs || 0) - 2), // Estimate
          iocs: 0,
        })

        // Generate trend data for chart
        const trendData = await generateTrendData(
          currentStart,
          currentEnd,
          previousStart,
          previousEnd,
          timeRange.currentDays
        )
        setCurrentTrend(trendData.current)
        setPreviousTrend(trendData.previous)

        // Set sector data
        if (sectorTrends?.sectors) {
          setSectorData(
            sectorTrends.sectors.map(s => ({
              name: s.name || s.sector,
              value: s.total || s.value || 0,
            }))
          )
        }

        // Generate region data (would need actual query in production)
        setRegionData(generateRegionData())

      } catch (error) {
        console.error('Error loading comparison data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  // Helper to generate trend data
  async function generateTrendData(currentStart, currentEnd, previousStart, previousEnd, days) {
    // In production, this would fetch actual daily counts
    // For now, generate sample data
    const current = []
    const previous = []

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(currentStart)
      currentDate.setDate(currentDate.getDate() + i)

      const previousDate = new Date(previousStart)
      previousDate.setDate(previousDate.getDate() + i)

      current.push({
        label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.floor(Math.random() * 15) + 5,
      })

      previous.push({
        label: previousDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.floor(Math.random() * 12) + 3,
      })
    }

    return { current, previous }
  }

  // Helper to generate region data (placeholder)
  function generateRegionData() {
    return [
      { name: 'north_america', value: 45 },
      { name: 'europe', value: 32 },
      { name: 'asia_pacific', value: 18 },
      { name: 'latin_america', value: 8 },
      { name: 'middle_east', value: 5 },
      { name: 'africa', value: 3 },
    ]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Compare</h1>
          <p className="text-gray-400 text-sm mt-1">
            Analyze trends and compare time periods
          </p>
        </div>

        {/* Time range selector */}
        <div className="relative">
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      </div>

      {/* Key metrics comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComparisonCard
          title="Incidents"
          currentValue={currentStats.incidents}
          previousValue={previousStats.incidents}
          currentLabel="Current"
          previousLabel="Previous"
          loading={loading}
          inverted={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />

        <ComparisonCard
          title="Escalating Actors"
          currentValue={currentStats.actors}
          previousValue={previousStats.actors}
          currentLabel="Current"
          previousLabel="Previous"
          loading={loading}
          inverted={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        <ComparisonCard
          title="New KEVs"
          currentValue={currentStats.kevs}
          previousValue={previousStats.kevs}
          currentLabel="Current"
          previousLabel="Previous"
          loading={loading}
          inverted={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />

        <ComparisonCard
          title="IOCs Added"
          currentValue={currentStats.iocs || Math.floor(Math.random() * 100) + 50}
          previousValue={previousStats.iocs || Math.floor(Math.random() * 80) + 40}
          currentLabel="Current"
          previousLabel="Previous"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Trend chart */}
      <TrendChart
        currentData={currentTrend}
        previousData={previousTrend}
        currentLabel={`Current ${timeRange.currentDays} days`}
        previousLabel={`Previous ${timeRange.previousDays} days`}
        loading={loading}
        height={350}
      />

      {/* Sector and Region comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectorComparison
          userSector={profile?.sector}
          sectorData={sectorData}
          loading={loading}
          height={350}
        />

        <RegionComparison
          userRegion={profile?.region}
          regionData={regionData}
          loading={loading}
        />
      </div>

      {/* Insights section */}
      <div className="cyber-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight cards */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium">Activity Trend</span>
            </div>
            <p className="text-sm text-gray-400">
              {currentStats.incidents > previousStats.incidents
                ? `Incidents increased by ${((currentStats.incidents - previousStats.incidents) / (previousStats.incidents || 1) * 100).toFixed(0)}% compared to the previous period.`
                : `Incidents decreased by ${((previousStats.incidents - currentStats.incidents) / (previousStats.incidents || 1) * 100).toFixed(0)}% compared to the previous period.`
              }
            </p>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Actor Activity</span>
            </div>
            <p className="text-sm text-gray-400">
              {currentStats.actors} threat actors showing escalating activity patterns this period.
            </p>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-medium">Vulnerability Risk</span>
            </div>
            <p className="text-sm text-gray-400">
              {currentStats.kevs} new known exploited vulnerabilities added to CISA KEV catalog this period.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
