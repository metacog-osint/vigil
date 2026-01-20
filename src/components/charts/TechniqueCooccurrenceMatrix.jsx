/**
 * Technique Co-occurrence Matrix
 *
 * Visualizes which MITRE ATT&CK techniques frequently appear together
 * across threat actors, helping identify common attack patterns.
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { correlations } from '../../lib/supabase'

const CELL_COLORS = [
  'bg-gray-800', // 0
  'bg-blue-900/50', // 1
  'bg-blue-800/60', // 2-3
  'bg-blue-700/70', // 4-5
  'bg-blue-600/80', // 6-9
  'bg-cyber-accent', // 10+
]

function getCellColor(count) {
  if (count === 0) return CELL_COLORS[0]
  if (count === 1) return CELL_COLORS[1]
  if (count <= 3) return CELL_COLORS[2]
  if (count <= 5) return CELL_COLORS[3]
  if (count <= 9) return CELL_COLORS[4]
  return CELL_COLORS[5]
}

function MatrixCell({ techniqueA, techniqueB, count, actors, onClick }) {
  if (!count) return <div className="w-8 h-8 bg-gray-900" />

  return (
    <button
      onClick={() => onClick({ techniqueA, techniqueB, count, actors })}
      className={`w-8 h-8 ${getCellColor(count)} hover:ring-2 hover:ring-white/50 transition-all flex items-center justify-center`}
      title={`${techniqueA} + ${techniqueB}: ${count} actors`}
    >
      <span className="text-[10px] text-white/80">{count}</span>
    </button>
  )
}

function CooccurrenceDetail({ data, onClose }) {
  if (!data) return null

  return (
    <div className="absolute z-50 top-0 right-0 w-80 bg-cyber-dark border border-gray-700 rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">Technique Pair</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Link
            to={`/techniques?search=${encodeURIComponent(data.techniqueA)}`}
            className="flex-1 p-2 bg-gray-800 rounded text-center hover:bg-gray-700 transition-colors"
          >
            <span className="text-cyber-accent font-mono text-sm">{data.techniqueA}</span>
          </Link>
          <div className="flex items-center text-gray-500">+</div>
          <Link
            to={`/techniques?search=${encodeURIComponent(data.techniqueB)}`}
            className="flex-1 p-2 bg-gray-800 rounded text-center hover:bg-gray-700 transition-colors"
          >
            <span className="text-cyber-accent font-mono text-sm">{data.techniqueB}</span>
          </Link>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-white">{data.count}</div>
          <div className="text-xs text-gray-400">actors use both techniques</div>
        </div>

        {data.actors?.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-2">Actors using both:</div>
            <div className="flex flex-wrap gap-1">
              {data.actors.slice(0, 10).map((actor, i) => (
                <Link
                  key={i}
                  to={`/actors?search=${encodeURIComponent(actor)}`}
                  className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded hover:bg-red-900/50"
                >
                  {actor}
                </Link>
              ))}
              {data.actors.length > 10 && (
                <span className="px-2 py-1 text-gray-500 text-xs">
                  +{data.actors.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-400">
      <span>Actor count:</span>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-gray-800 rounded" />
        <span>0</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-blue-900/50 rounded" />
        <span>1</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-blue-700/70 rounded" />
        <span>2-5</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-cyber-accent rounded" />
        <span>10+</span>
      </div>
    </div>
  )
}

export function TechniqueCooccurrenceMatrix({ techniqueId, limit = 10 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCell, setSelectedCell] = useState(null)

  useEffect(() => {
    async function loadCooccurrence() {
      setLoading(true)
      setError(null)

      try {
        const { data: cooccurrenceData, error: fetchError } =
          await correlations.getTechniqueCooccurrence(techniqueId, limit)

        if (fetchError) throw fetchError
        setData(cooccurrenceData || [])
      } catch (err) {
        console.error('Error loading technique co-occurrence:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (techniqueId) {
      loadCooccurrence()
    }
  }, [techniqueId, limit])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-32 bg-gray-800 rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 p-3 bg-red-500/10 rounded">
        Error loading co-occurrence data: {error}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">No co-occurrence data available</div>
    )
  }

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <h4 className="text-sm text-gray-400">Frequently Used Together</h4>
        <Legend />
      </div>

      <div className="space-y-2">
        {data.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors cursor-pointer"
            onClick={() =>
              setSelectedCell({
                techniqueA: techniqueId,
                techniqueB: item.technique_b || item.technique_id,
                count: item.shared_actor_count || item.count,
                actors: item.actors_using_both || item.actors || [],
              })
            }
          >
            <div
              className={`w-8 h-8 rounded ${getCellColor(item.shared_actor_count || item.count)} flex items-center justify-center`}
            >
              <span className="text-xs font-bold text-white">
                {item.shared_actor_count || item.count}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-sm text-white font-mono">
                {item.technique_b || item.technique_id}
              </div>
              {item.technique_name && (
                <div className="text-xs text-gray-400">{item.technique_name}</div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {item.shared_actor_count || item.count} actors
            </div>
          </div>
        ))}
      </div>

      {selectedCell && (
        <CooccurrenceDetail data={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  )
}

// Full matrix view for dedicated page
export function TechniqueCooccurrenceFullMatrix({ techniques, cooccurrenceData }) {
  const [selectedCell, setSelectedCell] = useState(null)

  // Build matrix from data
  const matrix = useMemo(() => {
    const map = new Map()

    for (const item of cooccurrenceData || []) {
      const key = `${item.technique_a}|${item.technique_b}`
      map.set(key, {
        count: item.shared_actor_count,
        actors: item.actors_using_both || [],
      })
    }

    return map
  }, [cooccurrenceData])

  if (!techniques || techniques.length === 0) {
    return <div className="text-gray-500 text-center py-8">No technique data available</div>
  }

  const displayTechniques = techniques.slice(0, 15) // Limit for readability

  return (
    <div className="relative overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Technique Co-occurrence Matrix</h3>
        <Legend />
      </div>

      <div className="inline-block">
        {/* Header row */}
        <div className="flex">
          <div className="w-20" /> {/* Empty corner */}
          {displayTechniques.map((tech) => (
            <div
              key={tech.id}
              className="w-8 h-20 flex items-end justify-center pb-1"
              title={tech.name}
            >
              <span className="text-[10px] text-gray-400 transform -rotate-45 origin-bottom-left whitespace-nowrap">
                {tech.mitre_id}
              </span>
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {displayTechniques.map((techA) => (
          <div key={techA.id} className="flex">
            <div className="w-20 h-8 flex items-center pr-2">
              <span className="text-[10px] text-gray-400 truncate" title={techA.name}>
                {techA.mitre_id}
              </span>
            </div>
            {displayTechniques.map((techB) => {
              if (techA.id === techB.id) {
                return <div key={techB.id} className="w-8 h-8 bg-gray-900" />
              }

              const key =
                techA.mitre_id < techB.mitre_id
                  ? `${techA.mitre_id}|${techB.mitre_id}`
                  : `${techB.mitre_id}|${techA.mitre_id}`
              const cellData = matrix.get(key)

              return (
                <MatrixCell
                  key={techB.id}
                  techniqueA={techA.mitre_id}
                  techniqueB={techB.mitre_id}
                  count={cellData?.count || 0}
                  actors={cellData?.actors || []}
                  onClick={setSelectedCell}
                />
              )
            })}
          </div>
        ))}
      </div>

      {selectedCell && (
        <CooccurrenceDetail data={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  )
}

export default TechniqueCooccurrenceMatrix
