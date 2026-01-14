import { useState, useEffect, useMemo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import { supabase } from '../lib/supabase'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Country code to name mapping for common codes
const COUNTRY_NAMES = {
  US: 'United States',
  USA: 'United States',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  CN: 'China',
  RU: 'Russia',
  BR: 'Brazil',
  IN: 'India',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czech Republic',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  ZA: 'South Africa',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  IL: 'Israel',
  SG: 'Singapore',
  KR: 'South Korea',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  NZ: 'New Zealand',
  IE: 'Ireland',
  PT: 'Portugal',
  GR: 'Greece',
  TR: 'Turkey',
  TH: 'Thailand',
  MY: 'Malaysia',
  ID: 'Indonesia',
  PH: 'Philippines',
  VN: 'Vietnam',
}

// ISO 3166-1 alpha-2 to alpha-3 conversion
const ISO2_TO_ISO3 = {
  US: 'USA', GB: 'GBR', UK: 'GBR', DE: 'DEU', FR: 'FRA', CA: 'CAN',
  AU: 'AUS', JP: 'JPN', CN: 'CHN', RU: 'RUS', BR: 'BRA', IN: 'IND',
  IT: 'ITA', ES: 'ESP', NL: 'NLD', BE: 'BEL', CH: 'CHE', AT: 'AUT',
  SE: 'SWE', NO: 'NOR', DK: 'DNK', FI: 'FIN', PL: 'POL', CZ: 'CZE',
  MX: 'MEX', AR: 'ARG', CL: 'CHL', CO: 'COL', ZA: 'ZAF', AE: 'ARE',
  SA: 'SAU', IL: 'ISR', SG: 'SGP', KR: 'KOR', TW: 'TWN', HK: 'HKG',
  NZ: 'NZL', IE: 'IRL', PT: 'PRT', GR: 'GRC', TR: 'TUR', TH: 'THA',
  MY: 'MYS', ID: 'IDN', PH: 'PHL', VN: 'VNM', EG: 'EGY', NG: 'NGA',
  KE: 'KEN', MA: 'MAR', PK: 'PAK', BD: 'BGD', UA: 'UKR', RO: 'ROU',
  HU: 'HUN', SK: 'SVK', BG: 'BGR', HR: 'HRV', SI: 'SVN', RS: 'SRB',
  LT: 'LTU', LV: 'LVA', EE: 'EST', CY: 'CYP', MT: 'MLT', LU: 'LUX',
  PE: 'PER', VE: 'VEN', EC: 'ECU', UY: 'URY', PY: 'PRY', BO: 'BOL',
  CR: 'CRI', PA: 'PAN', GT: 'GTM', SV: 'SLV', HN: 'HND', NI: 'NIC',
  DO: 'DOM', PR: 'PRI', JM: 'JAM', TT: 'TTO', CU: 'CUB',
}

export default function ThreatAttributionMap({
  days = 30,
  viewMode = 'victims', // 'victims' | 'attackers' | 'industry'
  onCountryClick,
  selectedCountry = null,
  height = 400,
}) {
  const [countryData, setCountryData] = useState({})
  const [actorOrigins, setActorOrigins] = useState({})
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 })

  // Fetch victim country data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      // Get incidents by victim country
      const { data: incidents } = await supabase
        .from('incidents')
        .select('victim_country, victim_sector, actor_id, threat_actor:threat_actors(name, actor_type)')
        .gte('discovered_date', cutoffDate.toISOString())
        .not('victim_country', 'is', null)

      if (incidents) {
        // Aggregate by country
        const byCountry = {}
        incidents.forEach(inc => {
          const country = inc.victim_country?.toUpperCase()
          if (!country) return

          if (!byCountry[country]) {
            byCountry[country] = {
              count: 0,
              sectors: {},
              actors: {},
            }
          }
          byCountry[country].count++

          // Track sectors
          if (inc.victim_sector) {
            byCountry[country].sectors[inc.victim_sector] =
              (byCountry[country].sectors[inc.victim_sector] || 0) + 1
          }

          // Track actors
          if (inc.threat_actor?.name) {
            byCountry[country].actors[inc.threat_actor.name] =
              (byCountry[country].actors[inc.threat_actor.name] || 0) + 1
          }
        })
        setCountryData(byCountry)
      }

      // Get actor origins (from target_countries on threat_actors)
      const { data: actors } = await supabase
        .from('threat_actors')
        .select('name, target_countries, metadata')
        .not('target_countries', 'is', null)

      if (actors) {
        const origins = {}
        actors.forEach(actor => {
          // Check metadata for origin country
          const origin = actor.metadata?.origin_country || actor.metadata?.country
          if (origin) {
            const country = origin.toUpperCase()
            if (!origins[country]) {
              origins[country] = { count: 0, actors: [] }
            }
            origins[country].count++
            origins[country].actors.push(actor.name)
          }
        })
        setActorOrigins(origins)
      }

      setLoading(false)
    }

    fetchData()
  }, [days])

  // Calculate color intensity based on count
  const getColor = (countryCode) => {
    const data = viewMode === 'attackers' ? actorOrigins : countryData
    const iso2 = countryCode?.length === 3
      ? Object.entries(ISO2_TO_ISO3).find(([k, v]) => v === countryCode)?.[0]
      : countryCode

    const countryInfo = data[iso2] || data[countryCode]
    if (!countryInfo) return '#1f2937' // Default dark gray

    const count = countryInfo.count || 0
    const maxCount = Math.max(...Object.values(data).map(d => d.count || 0), 1)
    const intensity = Math.min(count / maxCount, 1)

    if (viewMode === 'attackers') {
      // Red gradient for attacker origins
      if (intensity > 0.7) return '#dc2626'
      if (intensity > 0.4) return '#ef4444'
      if (intensity > 0.2) return '#f87171'
      if (intensity > 0) return '#fca5a5'
      return '#1f2937'
    } else {
      // Cyan gradient for victim locations
      if (intensity > 0.7) return '#0891b2'
      if (intensity > 0.4) return '#06b6d4'
      if (intensity > 0.2) return '#22d3ee'
      if (intensity > 0) return '#67e8f9'
      return '#1f2937'
    }
  }

  // Get country name from code
  const getCountryName = (geo) => {
    return geo.properties?.name || geo.properties?.NAME || 'Unknown'
  }

  // Get tooltip content
  const getTooltipContent = (countryCode, countryName) => {
    const data = viewMode === 'attackers' ? actorOrigins : countryData
    const iso2 = countryCode?.length === 3
      ? Object.entries(ISO2_TO_ISO3).find(([k, v]) => v === countryCode)?.[0]
      : countryCode

    const countryInfo = data[iso2] || data[countryCode]

    if (!countryInfo || countryInfo.count === 0) {
      return { name: countryName, count: 0 }
    }

    if (viewMode === 'attackers') {
      return {
        name: countryName,
        count: countryInfo.count,
        actors: countryInfo.actors?.slice(0, 5) || [],
      }
    }

    // Sort sectors and actors by count
    const topSectors = Object.entries(countryInfo.sectors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    const topActors = Object.entries(countryInfo.actors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    return {
      name: countryName,
      count: countryInfo.count,
      topSectors,
      topActors,
    }
  }

  const handleMouseEnter = (geo, evt) => {
    const countryCode = geo.properties?.ISO_A3 || geo.id
    const countryName = getCountryName(geo)
    const content = getTooltipContent(countryCode, countryName)

    setTooltip({
      ...content,
      x: evt.clientX,
      y: evt.clientY,
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  const handleClick = (geo) => {
    const countryCode = geo.properties?.ISO_A3 || geo.id
    const countryName = getCountryName(geo)
    const data = viewMode === 'attackers' ? actorOrigins : countryData
    const iso2 = countryCode?.length === 3
      ? Object.entries(ISO2_TO_ISO3).find(([k, v]) => v === countryCode)?.[0]
      : countryCode

    const countryInfo = data[iso2] || data[countryCode]

    if (onCountryClick && countryInfo?.count > 0) {
      onCountryClick({
        code: iso2 || countryCode,
        name: countryName,
        ...countryInfo,
      })
    }
  }

  // Stats summary
  const stats = useMemo(() => {
    const data = viewMode === 'attackers' ? actorOrigins : countryData
    const totalCountries = Object.keys(data).length
    const totalIncidents = Object.values(data).reduce((sum, d) => sum + (d.count || 0), 0)
    const topCountry = Object.entries(data)
      .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))[0]

    return { totalCountries, totalIncidents, topCountry }
  }, [countryData, actorOrigins, viewMode])

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
        <div className="flex gap-4">
          <span>{stats.totalCountries} countries</span>
          <span>{stats.totalIncidents} {viewMode === 'attackers' ? 'actors' : 'incidents'}</span>
          {stats.topCountry && (
            <span>
              Top: {COUNTRY_NAMES[stats.topCountry[0]] || stats.topCountry[0]} ({stats.topCountry[1].count})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Zoom:</span>
          <button
            onClick={() => setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }))}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            +
          </button>
          <button
            onClick={() => setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            -
          </button>
          <button
            onClick={() => setPosition({ coordinates: [0, 20], zoom: 1 })}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
        style={{ height }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
          </div>
        ) : (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 120,
              center: [0, 20],
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={setPosition}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const countryCode = geo.properties?.ISO_A3 || geo.id
                    const isSelected = selectedCountry === countryCode

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getColor(countryCode)}
                        stroke={isSelected ? '#06b6d4' : '#374151'}
                        strokeWidth={isSelected ? 1.5 : 0.5}
                        style={{
                          default: { outline: 'none' },
                          hover: {
                            fill: viewMode === 'attackers' ? '#f87171' : '#22d3ee',
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(geo)}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            maxWidth: 250,
          }}
        >
          <div className="font-semibold text-white mb-1">{tooltip.name}</div>
          {tooltip.count > 0 ? (
            <>
              <div className="text-cyan-400 text-sm mb-2">
                {tooltip.count} {viewMode === 'attackers' ? 'threat actors' : 'incidents'}
              </div>
              {tooltip.topActors && tooltip.topActors.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">Top Actors:</div>
                  {tooltip.topActors.map(([name, count]) => (
                    <div key={name} className="text-xs text-gray-300">
                      {name} ({count})
                    </div>
                  ))}
                </div>
              )}
              {tooltip.topSectors && tooltip.topSectors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Top Sectors:</div>
                  {tooltip.topSectors.map(([sector, count]) => (
                    <div key={sector} className="text-xs text-gray-300 capitalize">
                      {sector} ({count})
                    </div>
                  ))}
                </div>
              )}
              {tooltip.actors && tooltip.actors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Active Actors:</div>
                  {tooltip.actors.map(name => (
                    <div key={name} className="text-xs text-red-400">
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-sm">No data</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: viewMode === 'attackers' ? '#fca5a5' : '#67e8f9' }}
          />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: viewMode === 'attackers' ? '#f87171' : '#22d3ee' }}
          />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: viewMode === 'attackers' ? '#ef4444' : '#06b6d4' }}
          />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: viewMode === 'attackers' ? '#dc2626' : '#0891b2' }}
          />
          <span>Critical</span>
        </div>
      </div>
    </div>
  )
}

// Compact map for dashboard widget
export function ThreatMapMini({ days = 30, onViewFull }) {
  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Global Threat Map</h3>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Expand
          </button>
        )}
      </div>
      <ThreatAttributionMap days={days} height={200} />
    </div>
  )
}
