import { useState, useEffect } from 'react'
import {
  benchmarks,
  benchmarkPreferences,
  SECTOR_CONFIG,
  PERIOD_TYPES,
  getRiskLevel,
  formatTrend,
  getSectorColor,
  getSectorLabel,
} from '../lib/benchmarks'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../contexts/SubscriptionContext'
import { FeatureGate } from '../components/UpgradePrompt'
import { Tooltip } from '../components/Tooltip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Tooltip as RechartsTooltip,
  Area,
  AreaChart,
} from 'recharts'

export default function Benchmarks() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [periodType, setPeriodType] = useState('weekly')
  const [view, setView] = useState('overview') // overview, sectors, compare
  const [overview, setOverview] = useState(null)
  const [sectorHistory, setSectorHistory] = useState({})
  const [selectedSector, setSelectedSector] = useState(null)
  const [userPrefs, setUserPrefs] = useState(null)
  const [comparisonSectors, setComparisonSectors] = useState([])

  useEffect(() => {
    loadData()
  }, [periodType])

  useEffect(() => {
    if (user?.uid) {
      loadPreferences()
    }
  }, [user?.uid])

  async function loadData() {
    setLoading(true)
    try {
      const data = await benchmarks.getIndustryOverview(periodType)
      setOverview(data)
    } catch (err) {
      console.error('Failed to load benchmarks:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadPreferences() {
    try {
      const prefs = await benchmarkPreferences.get(user.uid)
      if (prefs) {
        setUserPrefs(prefs)
        if (prefs.comparison_sectors?.length) {
          setComparisonSectors(prefs.comparison_sectors)
        }
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  async function loadSectorHistory(sector) {
    if (sectorHistory[sector]) return
    try {
      const history = await benchmarks.getSectorHistory(sector, periodType)
      setSectorHistory((prev) => ({ ...prev, [sector]: history }))
    } catch (err) {
      console.error('Failed to load sector history:', err)
    }
  }

  function handleSectorClick(sector) {
    setSelectedSector(sector)
    loadSectorHistory(sector)
  }

  // Prepare chart data
  const sectorChartData = overview?.sectorBenchmarks?.slice(0, 10).map((s) => ({
    sector: getSectorLabel(s.sector),
    sectorKey: s.sector,
    incidents: s.incident_count,
    change: s.wow_change || 0,
    fill: getSectorColor(s.sector),
  })) || []

  const pieData = overview?.sectorBenchmarks?.slice(0, 8).map((s) => ({
    name: getSectorLabel(s.sector),
    value: s.incident_count,
    fill: getSectorColor(s.sector),
  })) || []

  return (
    <FeatureGate feature="benchmarks" requiredTier="pro">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Industry Benchmarks</h1>
            <p className="text-gray-400 text-sm mt-1">
              Compare threat landscape across industries
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {Object.entries(PERIOD_TYPES).slice(0, 3).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setPeriodType(key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    periodType === key
                      ? 'bg-cyber-accent text-black'
                      : 'bg-cyber-dark text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              <button
                onClick={() => setView('overview')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'overview'
                    ? 'bg-cyber-accent text-black'
                    : 'bg-cyber-dark text-gray-400 hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setView('sectors')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'sectors'
                    ? 'bg-cyber-accent text-black'
                    : 'bg-cyber-dark text-gray-400 hover:text-white'
                }`}
              >
                Sectors
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="cyber-card p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : view === 'overview' ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="cyber-card p-4">
                <div className="text-gray-400 text-sm mb-1">Total Incidents</div>
                <div className="text-3xl font-bold text-white">
                  {overview?.metrics?.totalIncidents?.toLocaleString() || 0}
                </div>
                {overview?.snapshot?.incident_trend !== undefined && (
                  <div className={`text-sm mt-1 ${
                    overview.snapshot.incident_trend > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatTrend(overview.snapshot.incident_trend).text} vs prev period
                  </div>
                )}
              </div>

              <div className="cyber-card p-4">
                <div className="text-gray-400 text-sm mb-1">Active Actors</div>
                <div className="text-3xl font-bold text-white">
                  {overview?.snapshot?.total_actors_active?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Targeting {overview?.metrics?.activeSectors || 0} sectors
                </div>
              </div>

              <div className="cyber-card p-4">
                <div className="text-gray-400 text-sm mb-1">Most Targeted</div>
                <div className="text-xl font-bold text-white">
                  {overview?.metrics?.mostTargeted?.label || 'N/A'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {overview?.metrics?.mostTargeted?.count || 0} incidents
                </div>
              </div>

              <div className="cyber-card p-4">
                <div className="text-gray-400 text-sm mb-1">Fastest Growing</div>
                <div className="text-xl font-bold text-white">
                  {overview?.metrics?.fastestGrowing?.label || 'N/A'}
                </div>
                {overview?.metrics?.fastestGrowing && (
                  <div className="text-sm text-red-400 mt-1">
                    +{Math.round(overview.metrics.fastestGrowing.change)}% increase
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart - Incidents by Sector */}
              <div className="cyber-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Incidents by Sector
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sectorChartData}
                      layout="vertical"
                      margin={{ left: 100, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" />
                      <YAxis
                        type="category"
                        dataKey="sector"
                        stroke="#9ca3af"
                        width={95}
                        tick={{ fontSize: 12 }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => [value, 'Incidents']}
                      />
                      <Bar dataKey="incidents" radius={[0, 4, 4, 0]}>
                        {sectorChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart - Distribution */}
              <div className="cyber-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Incident Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={{ stroke: '#6b7280' }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Actors */}
            {overview?.snapshot?.top_actors?.length > 0 && (
              <div className="cyber-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Most Active Threat Actors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {overview.snapshot.top_actors.slice(0, 10).map((actor, i) => (
                    <div
                      key={actor.id || i}
                      className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {actor.name}
                        </span>
                        {actor.trend === 'ESCALATING' && (
                          <span className="text-xs text-red-400">
                            <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-cyber-accent">
                        {actor.count}
                      </div>
                      <div className="text-xs text-gray-500">incidents</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Sectors View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sector List */}
            <div className="lg:col-span-1">
              <div className="cyber-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Sector Rankings
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {overview?.sectorBenchmarks?.map((sector, i) => {
                    const risk = getRiskLevel(sector.risk_score)
                    const trend = formatTrend(sector.wow_change)
                    const isSelected = selectedSector === sector.sector

                    return (
                      <button
                        key={sector.sector}
                        onClick={() => handleSectorClick(sector.sector)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-cyber-accent/20 border-cyber-accent'
                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getSectorColor(sector.sector) }}
                            />
                            <span className="font-medium text-white">
                              {getSectorLabel(sector.sector)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">#{i + 1}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            {sector.incident_count} incidents
                          </span>
                          <span className={`text-${trend.color}-400`}>
                            {trend.text}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${sector.risk_score}%`,
                              backgroundColor:
                                risk.level === 'critical'
                                  ? '#ef4444'
                                  : risk.level === 'high'
                                  ? '#f97316'
                                  : risk.level === 'medium'
                                  ? '#eab308'
                                  : '#22c55e',
                            }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Sector Detail */}
            <div className="lg:col-span-2">
              {selectedSector ? (
                <div className="space-y-4">
                  {/* Sector header */}
                  <div className="cyber-card p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getSectorColor(selectedSector) }}
                      />
                      <h3 className="text-xl font-bold text-white">
                        {getSectorLabel(selectedSector)}
                      </h3>
                    </div>

                    {(() => {
                      const sector = overview?.sectorBenchmarks?.find(
                        (s) => s.sector === selectedSector
                      )
                      if (!sector) return null
                      const risk = getRiskLevel(sector.risk_score)
                      const trend = formatTrend(sector.wow_change)

                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-gray-400 text-sm">Incidents</div>
                            <div className="text-2xl font-bold text-white">
                              {sector.incident_count}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-sm">Actors</div>
                            <div className="text-2xl font-bold text-white">
                              {sector.unique_actors}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-sm">Trend</div>
                            <div className={`text-2xl font-bold text-${trend.color}-400`}>
                              {trend.text}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-sm">Risk Level</div>
                            <div
                              className={`text-2xl font-bold text-${risk.color}-400`}
                            >
                              {risk.label}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Sector trend chart */}
                  {sectorHistory[selectedSector]?.length > 1 && (
                    <div className="cyber-card p-4">
                      <h4 className="text-lg font-semibold text-white mb-4">
                        Incident Trend
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sectorHistory[selectedSector]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                              dataKey="period_start"
                              stroke="#9ca3af"
                              tickFormatter={(date) =>
                                new Date(date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              }
                            />
                            <YAxis stroke="#9ca3af" />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="incident_count"
                              stroke={getSectorColor(selectedSector)}
                              fill={getSectorColor(selectedSector)}
                              fillOpacity={0.3}
                              name="Incidents"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Top actors for sector */}
                  {(() => {
                    const sector = overview?.sectorBenchmarks?.find(
                      (s) => s.sector === selectedSector
                    )
                    const actors = sector?.top_actors || []
                    if (actors.length === 0) return null

                    return (
                      <div className="cyber-card p-4">
                        <h4 className="text-lg font-semibold text-white mb-4">
                          Top Actors Targeting This Sector
                        </h4>
                        <div className="space-y-2">
                          {actors.map((actor, i) => (
                            <div
                              key={actor.id || i}
                              className="flex items-center justify-between p-2 bg-gray-800/30 rounded"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-sm w-4">
                                  {i + 1}.
                                </span>
                                <span className="text-white font-medium">
                                  {actor.name}
                                </span>
                              </div>
                              <span className="text-cyber-accent font-bold">
                                {actor.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="cyber-card p-8 text-center">
                  <svg
                    className="w-16 h-16 text-gray-600 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-400 mb-2">
                    Select a Sector
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Click on a sector from the list to view detailed benchmarks
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Attribution */}
        <div className="text-center text-xs text-gray-500 py-4">
          Benchmark data aggregated from public threat intelligence sources.
          <Tooltip content="Data is anonymized and aggregated. No individual organization data is exposed.">
            <span className="ml-1 underline cursor-help">Privacy info</span>
          </Tooltip>
        </div>
      </div>
    </FeatureGate>
  )
}
