/**
 * GeographyTab Component
 *
 * Dashboard tab showing geographic threat data:
 * - Global threat map with victim/attacker toggle
 * - Country attack panel for selected country
 */
import { useState } from 'react'
import { ThreatAttributionMap, CountryAttackPanel } from '../../../components'

export default function GeographyTab() {
  const [mapViewMode, setMapViewMode] = useState('victims')
  const [selectedCountry, setSelectedCountry] = useState(null)

  return (
    <div className="space-y-6">
      {/* Global Threat Map */}
      <div className="cyber-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Global Threat Map</h2>
            <p className="text-sm text-gray-400 hidden sm:block">
              Geographic distribution of attacks (30 days)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMapViewMode('victims')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                mapViewMode === 'victims'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Victims
            </button>
            <button
              onClick={() => setMapViewMode('attackers')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                mapViewMode === 'attackers'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Attackers
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ThreatAttributionMap
              days={30}
              viewMode={mapViewMode}
              onCountryClick={setSelectedCountry}
              selectedCountry={selectedCountry?.code}
              height={400}
            />
          </div>
          <div>
            {selectedCountry ? (
              <CountryAttackPanel
                country={selectedCountry}
                days={30}
                onActorClick={(actor) => console.log('Actor clicked:', actor.name)}
                onClose={() => setSelectedCountry(null)}
              />
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-4 h-full flex flex-col justify-center items-center text-center min-h-[300px]">
                <svg
                  className="w-12 h-12 text-gray-600 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-400 text-sm mb-1">Click a country to see details</p>
                <p className="text-gray-500 text-xs">
                  Active actors, targeted sectors, and incidents
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
