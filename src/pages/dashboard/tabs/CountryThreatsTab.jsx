/**
 * CountryThreatsTab Component
 *
 * Dashboard tab showing threats by country:
 * - Country threat profile table
 * - World map visualization
 * - Attack attribution by nation
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonTable } from '../../../components'
import {
  ComposableMap,
  Geographies,
  Geography,
  Tooltip as MapTooltip,
} from 'react-simple-maps'

// ISO-2 to ISO-3 mapping for common countries
const ISO2_TO_ISO3 = {
  US: 'USA', GB: 'GBR', DE: 'DEU', FR: 'FRA', CA: 'CAN',
  AU: 'AUS', JP: 'JPN', CN: 'CHN', RU: 'RUS', BR: 'BRA',
  IN: 'IND', KR: 'KOR', IT: 'ITA', ES: 'ESP', MX: 'MEX',
  NL: 'NLD', SE: 'SWE', CH: 'CHE', PL: 'POL', BE: 'BEL',
  AT: 'AUT', NO: 'NOR', DK: 'DNK', FI: 'FIN', IE: 'IRL',
  NZ: 'NZL', SG: 'SGP', HK: 'HKG', TW: 'TWN', IL: 'ISR',
  AE: 'ARE', SA: 'SAU', ZA: 'ZAF', EG: 'EGY', NG: 'NGA',
  AR: 'ARG', CL: 'CHL', CO: 'COL', PE: 'PER', VE: 'VEN',
  TH: 'THA', MY: 'MYS', ID: 'IDN', PH: 'PHL', VN: 'VNM',
  TR: 'TUR', GR: 'GRC', PT: 'PRT', CZ: 'CZE', HU: 'HUN',
  RO: 'ROU', UA: 'UKR', IR: 'IRN', PK: 'PAK', BD: 'BGD',
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

function getCountryColor(events, maxEvents) {
  if (!events || events === 0) return '#1f2937'
  const intensity = Math.min(events / maxEvents, 1)
  if (intensity > 0.8) return '#dc2626'
  if (intensity > 0.6) return '#ea580c'
  if (intensity > 0.4) return '#d97706'
  if (intensity > 0.2) return '#ca8a04'
  return '#65a30d'
}

function CountryRow({ country, onSelect, isSelected }) {
  return (
    <tr
      onClick={() => onSelect(country)}
      className={`cursor-pointer transition-colors ${
        isSelected ? 'bg-cyber-accent/10' : 'hover:bg-gray-800/50'
      }`}
    >
      <td>
        <div className="font-medium text-white">{country.country}</div>
        <div className="text-xs text-gray-500">
          {country.unique_actors || 0} actors
        </div>
      </td>
      <td>
        <span className="text-lg font-bold text-cyber-accent">
          {country.total_events?.toLocaleString() || 0}
        </span>
      </td>
      <td className="hidden md:table-cell">
        <div className="flex gap-2 text-xs">
          {country.nation_state_events > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">
              NS: {country.nation_state_events}
            </span>
          )}
          {country.criminal_events > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400">
              CR: {country.criminal_events}
            </span>
          )}
          {country.hacktivist_events > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400">
              HT: {country.hacktivist_events}
            </span>
          )}
        </div>
      </td>
      <td className="hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {country.attacking_countries?.slice(0, 2).map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400"
            >
              {c}
            </span>
          ))}
          {country.attacking_countries?.length > 2 && (
            <span className="text-xs text-gray-500">
              +{country.attacking_countries.length - 2}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

function CountryDetailPanel({ country, onClose }) {
  if (!country) return null

  return (
    <div className="w-80 cyber-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{country.country}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="cyber-card bg-gray-800/50">
            <div className="text-2xl font-bold text-cyber-accent">
              {country.total_events?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500">Total Events</div>
          </div>
          <div className="cyber-card bg-gray-800/50">
            <div className="text-2xl font-bold text-yellow-400">
              {country.unique_actors || 0}
            </div>
            <div className="text-xs text-gray-500">Unique Actors</div>
          </div>
        </div>

        <div>
          <div className="text-gray-500 mb-2">Events by Actor Type</div>
          <div className="space-y-2">
            {country.nation_state_events > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-red-400">Nation-State</span>
                <span className="text-white font-medium">{country.nation_state_events}</span>
              </div>
            )}
            {country.criminal_events > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-orange-400">Criminal</span>
                <span className="text-white font-medium">{country.criminal_events}</span>
              </div>
            )}
            {country.hacktivist_events > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-purple-400">Hacktivist</span>
                <span className="text-white font-medium">{country.hacktivist_events}</span>
              </div>
            )}
          </div>
        </div>

        {country.attacking_countries?.length > 0 && (
          <div>
            <div className="text-gray-500 mb-2">Attacking Countries</div>
            <div className="flex flex-wrap gap-1">
              {country.attacking_countries.map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-400 border border-red-700/50"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {country.targeted_industries?.length > 0 && (
          <div>
            <div className="text-gray-500 mb-2">Targeted Industries</div>
            <div className="flex flex-wrap gap-1">
              {country.targeted_industries.slice(0, 6).map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400"
                >
                  {ind}
                </span>
              ))}
              {country.targeted_industries.length > 6 && (
                <span className="text-xs text-gray-500">
                  +{country.targeted_industries.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-800">
          <div className="text-xs text-gray-500">
            Events last year: {country.events_last_year || 0}
          </div>
          {country.last_event && (
            <div className="text-xs text-gray-500 mt-1">
              Last event: {new Date(country.last_event).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CountryThreatsTab({ countryThreats, loading }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [tooltipContent, setTooltipContent] = useState('')

  // Create lookup map for the world map
  const countryLookup = useMemo(() => {
    const lookup = {}
    for (const country of countryThreats || []) {
      // Try to find by country name
      lookup[country.country] = country
      // Also map by ISO-3 code if we can convert
      const iso3 = ISO2_TO_ISO3[country.country]
      if (iso3) {
        lookup[iso3] = country
      }
    }
    return lookup
  }, [countryThreats])

  const maxEvents = useMemo(() => {
    return Math.max(...(countryThreats || []).map((c) => c.total_events || 0), 1)
  }, [countryThreats])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="cyber-card h-96 animate-pulse bg-gray-800/50" />
        <div className="cyber-card">
          <SkeletonTable rows={10} cols={4} />
        </div>
      </div>
    )
  }

  if (!countryThreats || countryThreats.length === 0) {
    return (
      <div className="cyber-card text-center py-12">
        <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-gray-400 font-medium">No country threat data</h3>
        <p className="text-gray-500 text-sm mt-1">
          Run the correlation view refresh to populate country threats
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* World Map */}
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Global Threat Distribution</h2>
        <div className="h-80">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 120,
              center: [0, 30],
            }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name
                  const countryData = countryLookup[countryName] || countryLookup[geo.properties.ISO_A3]
                  const events = countryData?.total_events || 0

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(events, maxEvents)}
                      stroke="#374151"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { fill: '#06b6d4', outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => {
                        setTooltipContent(
                          events > 0
                            ? `${countryName}: ${events.toLocaleString()} events`
                            : countryName
                        )
                      }}
                      onMouseLeave={() => setTooltipContent('')}
                      onClick={() => {
                        if (countryData) {
                          setSelectedCountry(countryData)
                        }
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
          {tooltipContent && (
            <div className="absolute bg-gray-900 border border-gray-700 px-3 py-1.5 rounded text-sm text-white pointer-events-none">
              {tooltipContent}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#65a30d' }} />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#d97706' }} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Country Table + Detail */}
      <div className="flex gap-6">
        <div className="flex-1 cyber-card overflow-hidden">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Events</th>
                <th className="hidden md:table-cell">Actor Types</th>
                <th className="hidden lg:table-cell">Attacking From</th>
              </tr>
            </thead>
            <tbody>
              {countryThreats.slice(0, 20).map((country, i) => (
                <CountryRow
                  key={`${country.country}-${i}`}
                  country={country}
                  onSelect={setSelectedCountry}
                  isSelected={selectedCountry?.country === country.country}
                />
              ))}
            </tbody>
          </table>
        </div>

        {selectedCountry && (
          <CountryDetailPanel
            country={selectedCountry}
            onClose={() => setSelectedCountry(null)}
          />
        )}
      </div>
    </div>
  )
}
