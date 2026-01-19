/**
 * SimilarItems Component
 *
 * Displays similar incidents, actors, or vulnerabilities.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getSimilarIncidents,
  getSimilarActors,
  getSimilarVulnerabilities,
} from '../../lib/similarity'

export function SimilarItems({
  type, // 'incident' | 'actor' | 'vulnerability'
  entityId,
  limit = 5,
  className = '',
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSimilar()
  }, [type, entityId])

  async function loadSimilar() {
    setLoading(true)
    try {
      let data = []
      switch (type) {
        case 'incident':
          data = await getSimilarIncidents(entityId, limit)
          break
        case 'actor':
          data = await getSimilarActors(entityId, limit)
          break
        case 'vulnerability':
          data = await getSimilarVulnerabilities(entityId, limit)
          break
      }
      setItems(data)
    } catch (error) {
      console.error('Error loading similar items:', error)
    } finally {
      setLoading(false)
    }
  }

  const getItemLink = (item) => {
    switch (type) {
      case 'incident':
        return `/events?search=${encodeURIComponent(item.victim_name || item.id)}`
      case 'actor':
        return `/actors?search=${encodeURIComponent(item.name)}`
      case 'vulnerability':
        return `/vulnerabilities?search=${encodeURIComponent(item.cve_id)}`
      default:
        return '#'
    }
  }

  const getItemName = (item) => {
    switch (type) {
      case 'incident':
        return item.victim_name || 'Unknown victim'
      case 'actor':
        return item.name
      case 'vulnerability':
        return item.cve_id
      default:
        return item.id
    }
  }

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="text-sm font-medium text-gray-400 mb-3">Similar {type}s</div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 bg-gray-800/50 rounded-lg animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-sm font-medium text-gray-400 mb-3">Similar {type}s</div>
        <p className="text-sm text-gray-500 text-center py-4">No similar items found</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="text-sm font-medium text-gray-400 mb-3">Similar {type}s</div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <Link
            key={item.id || idx}
            to={getItemLink(item)}
            className="block p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">{getItemName(item)}</span>
              <span className="text-sm text-cyan-400">{item.similarity?.score}%</span>
            </div>

            {/* Similarity factors */}
            {item.similarity?.factors?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.similarity.factors.slice(0, 3).map((factor, fIdx) => (
                  <span
                    key={fIdx}
                    className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded"
                  >
                    {factor.factor}
                  </span>
                ))}
              </div>
            )}

            {/* Additional context */}
            <div className="mt-2 text-xs text-gray-500">
              {type === 'incident' && item.threat_actor?.name && (
                <span>Actor: {item.threat_actor.name}</span>
              )}
              {type === 'incident' && item.sector && (
                <span className="ml-2">Sector: {item.sector}</span>
              )}
              {type === 'actor' && item.actor_type && (
                <span>Type: {item.actor_type}</span>
              )}
              {type === 'vulnerability' && item.severity && (
                <span>Severity: {item.severity}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default SimilarItems
