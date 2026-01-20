/**
 * Geographic Analysis Page
 *
 * Advanced geographic threat intelligence showing:
 * - Actor × Sector × Country targeting matrix
 * - Regional threat profiles
 * - Geographic targeting trends
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { correlations } from '../lib/supabase'
import { TargetingHeatmap } from '../components/charts/TargetingHeatmap'
import { SkeletonTable } from '../components'

const ACTOR_TYPE_COLORS = {
  'Nation-State': 'bg-red-500/20 text-red-400 border-red-500/30',
  Criminal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Hacktivist: 'bg-green-500/20 text-green-400 border-green-500/30',
  Unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function ActorTypeBadge({ type }) {
  const colorClass = ACTOR_TYPE_COLORS[type] || ACTOR_TYPE_COLORS.Unknown
  return <span className={`px-2 py-0.5 text-xs rounded border ${colorClass}`}>{type}</span>
}

function StatCard({ label, value, subtext, trend }) {
  return (
    <div className="cyber-card">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
      {trend && (
        <div className={`text-xs mt-1 ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  )
}

function CountryDetailPanel({ country, data, onClose }) {
  if (!country) return null

  const countryData = data?.find((d) => d.country === country) || {}

  return (
    <div className="cyber-card w-96">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{country}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-800 rounded">
            <div className="text-2xl font-bold text-white">{countryData.total_events || 0}</div>
            <div className="text-xs text-gray-400">Total Events</div>
          </div>
          <div className="text-center p-3 bg-gray-800 rounded">
            <div className="text-2xl font-bold text-white">{countryData.actor_count || 0}</div>
            <div className="text-xs text-gray-400">Unique Actors</div>
          </div>
        </div>

        {countryData.top_sectors?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Top Targeted Sectors</div>
            <div className="flex flex-wrap gap-1">
              {countryData.top_sectors.slice(0, 5).map((sector, i) => (
                <span key={i} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded">
                  {sector}
                </span>
              ))}
            </div>
          </div>
        )}

        {countryData.attacking_countries?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Attacking From</div>
            <div className="flex flex-wrap gap-1">
              {countryData.attacking_countries.slice(0, 5).map((c, i) => (
                <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {countryData.primary_actor_type && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Primary Threat Type</div>
            <ActorTypeBadge type={countryData.primary_actor_type} />
          </div>
        )}

        <Link
          to={`/actors?country=${encodeURIComponent(country)}`}
          className="block text-center py-2 bg-cyber-accent/20 text-cyber-accent rounded hover:bg-cyber-accent/30 text-sm"
        >
          View Actors Targeting {country}
        </Link>
      </div>
    </div>
  )
}

export default function GeographicAnalysis() {
  const [targetingData, setTargetingData] = useState([])
  const [countryProfiles, setCountryProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [filters, setFilters] = useState({
    actorType: '',
    sector: '',
  })

  useEffect(() => {
    loadData()
  }, [filters])

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const [targetingResult, countryResult] = await Promise.all([
        correlations.getGeographicTargetingMatrix({
          actorType: filters.actorType || undefined,
          sector: filters.sector || undefined,
        }),
        correlations.getAllCountryThreats(50),
      ])

      if (targetingResult.error) throw targetingResult.error
      if (countryResult.error) throw countryResult.error

      setTargetingData(targetingResult.data || [])
      setCountryProfiles(countryResult.data || [])
    } catch (err) {
      console.error('Error loading geographic data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Extract unique sectors and countries
  const { sectors, countries } = useMemo(() => {
    const sectorSet = new Set()
    const countrySet = new Set()

    for (const item of targetingData) {
      if (item.target_sector) sectorSet.add(item.target_sector)
      if (item.target_country) countrySet.add(item.target_country)
    }

    return {
      sectors: Array.from(sectorSet).sort(),
      countries: Array.from(countrySet).sort(),
    }
  }, [targetingData])

  // Calculate stats
  const stats = useMemo(() => {
    const uniqueCountries = new Set(countryProfiles.map((c) => c.country)).size
    const totalEvents = countryProfiles.reduce((sum, c) => sum + (c.total_events || 0), 0)
    const nationStateTargeted = countryProfiles.filter(
      (c) => c.primary_actor_type === 'Nation-State'
    ).length

    return { uniqueCountries, totalEvents, nationStateTargeted }
  }, [countryProfiles])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Geographic Analysis</h1>
        <p className="text-gray-400 text-sm mt-1">
          Threat actor targeting patterns across sectors and countries
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={filters.actorType}
          onChange={(e) => setFilters((f) => ({ ...f, actorType: e.target.value }))}
          className="cyber-input"
        >
          <option value="">All Actor Types</option>
          <option value="Nation-State">Nation-State</option>
          <option value="Criminal">Criminal</option>
          <option value="Hacktivist">Hacktivist</option>
        </select>

        <select
          value={filters.sector}
          onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
          className="cyber-input"
        >
          <option value="">All Sectors</option>
          {sectors.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Countries Targeted" value={stats.uniqueCountries} />
        <StatCard label="Total Events" value={stats.totalEvents.toLocaleString()} />
        <StatCard label="Nation-State Targets" value={stats.nationStateTargeted} />
        <StatCard label="Unique Sectors" value={sectors.length} />
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="cyber-card">
          <SkeletonTable rows={8} cols={6} />
        </div>
      ) : error ? (
        <div className="cyber-card text-center py-12">
          <div className="text-red-400 mb-2">{error}</div>
          <button onClick={loadData} className="text-cyber-accent hover:underline text-sm">
            Try Again
          </button>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Heatmap */}
          <div className="flex-1 cyber-card">
            <TargetingHeatmap
              data={targetingData}
              sectors={sectors}
              countries={countries}
              onCellClick={(cell) => setSelectedCountry(cell.col)}
            />
          </div>

          {/* Country Detail Panel */}
          {selectedCountry && (
            <CountryDetailPanel
              country={selectedCountry}
              data={countryProfiles}
              onClose={() => setSelectedCountry(null)}
            />
          )}
        </div>
      )}

      {/* Country Rankings Table */}
      {!loading && countryProfiles.length > 0 && (
        <div className="cyber-card">
          <h3 className="text-lg font-medium text-white mb-4">Country Threat Rankings</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="pb-2 pr-4">Country</th>
                  <th className="pb-2 pr-4">Events</th>
                  <th className="pb-2 pr-4">Actors</th>
                  <th className="pb-2 pr-4">Primary Type</th>
                  <th className="pb-2">Top Sectors</th>
                </tr>
              </thead>
              <tbody>
                {countryProfiles.slice(0, 20).map((profile, i) => (
                  <tr
                    key={profile.country || i}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setSelectedCountry(profile.country)}
                  >
                    <td className="py-3 pr-4">
                      <span className="text-white font-medium">{profile.country}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-gray-300">{profile.total_events || 0}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-gray-300">{profile.actor_count || 0}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {profile.primary_actor_type && (
                        <ActorTypeBadge type={profile.primary_actor_type} />
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {(profile.top_sectors || []).slice(0, 3).map((sector, j) => (
                          <span
                            key={j}
                            className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
                          >
                            {sector}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
