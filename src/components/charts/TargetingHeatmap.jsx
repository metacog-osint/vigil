/**
 * Targeting Heatmap
 *
 * Visualizes the intersection of actors, sectors, and countries
 * in a heatmap format for geographic threat analysis.
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

// Color scale for heatmap
const HEAT_COLORS = [
  { threshold: 0, bg: 'bg-gray-800', text: 'text-gray-600' },
  { threshold: 1, bg: 'bg-blue-900/40', text: 'text-blue-400' },
  { threshold: 3, bg: 'bg-blue-800/50', text: 'text-blue-300' },
  { threshold: 5, bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
  { threshold: 10, bg: 'bg-orange-900/60', text: 'text-orange-400' },
  { threshold: 20, bg: 'bg-red-900/70', text: 'text-red-400' },
  { threshold: 50, bg: 'bg-red-700', text: 'text-white' },
]

function getHeatColor(value) {
  for (let i = HEAT_COLORS.length - 1; i >= 0; i--) {
    if (value >= HEAT_COLORS[i].threshold) {
      return HEAT_COLORS[i]
    }
  }
  return HEAT_COLORS[0]
}

function HeatmapCell({ value, rowLabel, colLabel, onClick }) {
  const { bg, text } = getHeatColor(value)

  return (
    <button
      onClick={() => onClick({ row: rowLabel, col: colLabel, value })}
      className={clsx(
        'w-full h-10 flex items-center justify-center transition-all',
        bg,
        'hover:ring-2 hover:ring-white/30'
      )}
      title={`${rowLabel} × ${colLabel}: ${value}`}
    >
      {value > 0 && (
        <span className={clsx('text-xs font-medium', text)}>{value}</span>
      )}
    </button>
  )
}

function CellDetail({ data, onClose }) {
  if (!data) return null

  return (
    <div className="absolute z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-xl p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">Targeting Detail</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-gray-500">Sector</div>
            <div className="text-white">{data.row}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Country</div>
            <div className="text-white">{data.col}</div>
          </div>
        </div>

        <div className="text-center py-2 bg-gray-800 rounded">
          <div className="text-2xl font-bold text-cyber-accent">{data.value}</div>
          <div className="text-xs text-gray-400">threat actors</div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/actors?sector=${encodeURIComponent(data.row)}&country=${encodeURIComponent(data.col)}`}
            className="flex-1 text-center text-xs py-2 bg-cyber-accent/20 text-cyber-accent rounded hover:bg-cyber-accent/30"
          >
            View Actors
          </Link>
        </div>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span>Actors:</span>
      {HEAT_COLORS.slice(1).map((color, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={clsx('w-4 h-4 rounded', color.bg)} />
          <span>{color.threshold}+</span>
        </div>
      ))}
    </div>
  )
}

export function TargetingHeatmap({ data, sectors, countries, onCellClick }) {
  const [selectedCell, setSelectedCell] = useState(null)

  // Build matrix from data
  const matrix = useMemo(() => {
    const map = new Map()

    for (const item of (data || [])) {
      const key = `${item.target_sector}|${item.target_country}`
      const existing = map.get(key) || 0
      map.set(key, existing + (item.actor_count || 1))
    }

    return map
  }, [data])

  const handleCellClick = (cellData) => {
    setSelectedCell(cellData)
    if (onCellClick) onCellClick(cellData)
  }

  if (!sectors?.length || !countries?.length) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No targeting data available
      </div>
    )
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Geographic Targeting Matrix</h3>
        <Legend />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="w-32 p-2 text-left text-xs text-gray-500">Sector / Country</th>
              {countries.slice(0, 12).map(country => (
                <th key={country} className="p-1 text-center">
                  <span className="text-[10px] text-gray-400 transform -rotate-45 inline-block origin-bottom-left">
                    {country}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.slice(0, 10).map(sector => (
              <tr key={sector}>
                <td className="p-2 text-xs text-gray-400 truncate max-w-[120px]" title={sector}>
                  {sector}
                </td>
                {countries.slice(0, 12).map(country => {
                  const value = matrix.get(`${sector}|${country}`) || 0
                  return (
                    <td key={country} className="p-0.5">
                      <HeatmapCell
                        value={value}
                        rowLabel={sector}
                        colLabel={country}
                        onClick={handleCellClick}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <CellDetail
          data={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  )
}

// Mini version for dashboards
export function TargetingHeatmapMini({ data, topN = 5 }) {
  // Get top sectors and countries
  const { sectors, countries, matrix } = useMemo(() => {
    const sectorCounts = {}
    const countryCounts = {}
    const matrixMap = new Map()

    for (const item of (data || [])) {
      const sector = item.target_sector
      const country = item.target_country
      const count = item.actor_count || 1

      if (sector) sectorCounts[sector] = (sectorCounts[sector] || 0) + count
      if (country) countryCounts[country] = (countryCounts[country] || 0) + count

      if (sector && country) {
        const key = `${sector}|${country}`
        matrixMap.set(key, (matrixMap.get(key) || 0) + count)
      }
    }

    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([name]) => name)

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([name]) => name)

    return { sectors: topSectors, countries: topCountries, matrix: matrixMap }
  }, [data, topN])

  if (sectors.length === 0 || countries.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-4">
        No targeting data
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(${countries.length}, 1fr)` }}>
        {/* Header */}
        <div />
        {countries.map(country => (
          <div key={country} className="text-[9px] text-gray-500 text-center truncate px-1">
            {country.slice(0, 3)}
          </div>
        ))}

        {/* Rows */}
        {sectors.map(sector => (
          <>
            <div key={`label-${sector}`} className="text-[9px] text-gray-400 truncate pr-1">
              {sector}
            </div>
            {countries.map(country => {
              const value = matrix.get(`${sector}|${country}`) || 0
              const { bg } = getHeatColor(value)
              return (
                <div
                  key={`${sector}-${country}`}
                  className={clsx('h-5 rounded-sm', bg)}
                  title={`${sector} × ${country}: ${value}`}
                />
              )
            })}
          </>
        ))}
      </div>

      <Link
        to="/geographic-analysis"
        className="block text-center text-xs text-cyber-accent hover:underline"
      >
        View Full Analysis →
      </Link>
    </div>
  )
}

export default TargetingHeatmap
