// Trend Analysis Page - Temporal intelligence and comparisons
import { useState, useEffect } from 'react'
import { trendAnalysis, incidents } from '../lib/supabase'
import WeekComparisonCard from '../components/WeekComparisonCard'
import ChangeSummaryCard from '../components/ChangeSummaryCard'
import { SectorTrendChart, ActivityTrendChart } from '../components/SectorTrendChart'
import { ActorTrajectoryChart, ActorSelector } from '../components/ActorTrajectoryChart'

const TIME_RANGES = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

export default function TrendAnalysis() {
  const [timeRange, setTimeRange] = useState(30)
  const [loading, setLoading] = useState(true)
  const [weekComparison, setWeekComparison] = useState(null)
  const [changeSummary, setChangeSummary] = useState(null)
  const [sectorTrends, setSectorTrends] = useState(null)
  const [dailyActivity, setDailyActivity] = useState([])
  const [selectedActorIds, setSelectedActorIds] = useState([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [weekData, changeData, sectorData, activityData] = await Promise.all([
          trendAnalysis.getWeekOverWeekChange(),
          trendAnalysis.getChangeSummary(7),
          trendAnalysis.getSectorTrends(timeRange),
          incidents.getDailyCounts(timeRange),
        ])

        setWeekComparison(weekData)
        setChangeSummary(changeData)
        setSectorTrends(sectorData)
        setDailyActivity(activityData)
      } catch (error) {
        console.error('Error loading trend data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trend Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">Temporal intelligence and week-over-week comparisons</p>
        </div>

        <div className="flex items-center gap-2">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                timeRange === value
                  ? 'bg-cyber-accent/20 text-cyber-accent'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <WeekComparisonCard data={weekComparison} loading={loading} />
        <ChangeSummaryCard data={changeSummary} loading={loading} />
      </div>

      {/* Activity Over Time */}
      <div className="cyber-card p-6 mb-6">
        <h3 className="text-sm text-gray-400 mb-4">Incident Activity ({timeRange} days)</h3>
        <ActivityTrendChart data={dailyActivity} loading={loading} />
      </div>

      {/* Sector Trends */}
      <div className="cyber-card p-6">
        <h3 className="text-sm text-gray-400 mb-4">Sector Targeting Trends</h3>
        <p className="text-xs text-gray-500 mb-4">
          Weekly incident counts by sector (top 6 sectors shown)
        </p>
        <SectorTrendChart data={sectorTrends} loading={loading} />
      </div>

      {/* Actor Trajectory */}
      <div className="cyber-card p-6 mb-6">
        <h3 className="text-sm text-gray-400 mb-4">Actor Trajectory Comparison</h3>
        <p className="text-xs text-gray-500 mb-4">
          Select up to 5 actors to compare their activity over time
        </p>
        <div className="mb-4">
          <ActorSelector
            selectedIds={selectedActorIds}
            onChange={setSelectedActorIds}
            maxSelections={5}
          />
        </div>
        <ActorTrajectoryChart
          actorIds={selectedActorIds}
          days={timeRange}
          height={280}
        />
      </div>

      {/* Sector Breakdown Table */}
      {sectorTrends?.sectors?.length > 0 && (
        <div className="cyber-card p-6 mt-6">
          <h3 className="text-sm text-gray-400 mb-4">Sector Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sectorTrends.sectors.slice(0, 12).map(sector => {
              const total = Object.entries(sectorTrends.data)
                .filter(([k]) => k.endsWith(`|${sector}`))
                .reduce((sum, [, v]) => sum + v, 0)

              return (
                <div key={sector} className="p-3 bg-gray-800/50 rounded">
                  <div className="text-lg font-semibold text-white">{total}</div>
                  <div className="text-xs text-gray-500 truncate" title={sector}>{sector}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
