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
import { compare, orgProfile } from '../lib/supabase/index'

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
        label:
          rangeId === 'custom' ? `Last ${days} days vs Prior ${days} days` : DEFAULT_RANGE.label,
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
        // Load org profile and comparison data in parallel
        const [profileData, comparisonData] = await Promise.all([
          orgProfile.get(),
          compare.getComparison(timeRange),
        ])

        setProfile(profileData)

        // Set stats from real database queries
        setCurrentStats(comparisonData.currentStats)
        setPreviousStats(comparisonData.previousStats)

        // Set trend data from real queries
        setCurrentTrend(comparisonData.currentTrend)
        setPreviousTrend(comparisonData.previousTrend)

        // Set sector data
        setSectorData(comparisonData.currentSectors || [])

        // Set region data from real queries
        setRegionData(comparisonData.currentRegions || [])
      } catch (error) {
        console.error('Error loading comparison data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Compare</h1>
          <p className="text-gray-400 text-sm mt-1">Analyze trends and compare time periods</p>
        </div>

        {/* Time range selector */}
        <div className="relative">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          }
        />

        <ComparisonCard
          title="IOCs Added"
          currentValue={currentStats.iocs}
          previousValue={previousStats.iocs}
          currentLabel="Current"
          previousLabel="Previous"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
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

        <RegionComparison userRegion={profile?.region} regionData={regionData} loading={loading} />
      </div>

      {/* Insights section */}
      <div className="cyber-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight cards */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span className="font-medium">Activity Trend</span>
            </div>
            <p className="text-sm text-gray-400">
              {currentStats.incidents > previousStats.incidents
                ? `Incidents increased by ${(((currentStats.incidents - previousStats.incidents) / (previousStats.incidents || 1)) * 100).toFixed(0)}% compared to the previous period.`
                : `Incidents decreased by ${(((previousStats.incidents - currentStats.incidents) / (previousStats.incidents || 1)) * 100).toFixed(0)}% compared to the previous period.`}
            </p>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="font-medium">Vulnerability Risk</span>
            </div>
            <p className="text-sm text-gray-400">
              {currentStats.kevs} new known exploited vulnerabilities added to CISA KEV catalog this
              period.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
