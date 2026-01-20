/**
 * SimilarIncidentsPanel
 * Shows incidents similar to a selected incident based on similarity scoring
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSimilarIncidents } from '../../lib/similarity'
import { formatDistanceToNow } from 'date-fns'

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-16 bg-gray-800 rounded"></div>
        </div>
      ))}
    </div>
  )
}

function SimilarityBadge({ score }) {
  const getColor = (s) => {
    if (s >= 75) return 'bg-green-900/50 text-green-400 border-green-700/50'
    if (s >= 50) return 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50'
    if (s >= 25) return 'bg-orange-900/50 text-orange-400 border-orange-700/50'
    return 'bg-gray-800 text-gray-400 border-gray-700'
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getColor(score)}`}>
      {score}% match
    </span>
  )
}

function FactorChip({ factor }) {
  const icons = {
    actor: '👤',
    sector: '🏢',
    country: '🌍',
    ttp: '⚔️',
    malware: '🦠',
    temporal: '⏰',
  }

  const icon =
    Object.entries(icons).find(([key]) => factor.toLowerCase().includes(key))?.[1] || '📌'

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-gray-700/50 text-gray-400">
      <span>{icon}</span>
      <span>{factor}</span>
    </span>
  )
}

function IncidentItem({ incident, similarity }) {
  return (
    <Link
      to={`/events?selected=${incident.id}`}
      className="block p-3 bg-gray-800/50 rounded border border-gray-700/50 hover:border-cyber-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white truncate">
            {incident.victim_name || 'Unknown Victim'}
          </div>
          {incident.threat_actor && (
            <div className="text-sm text-gray-400 mt-0.5">
              by {incident.threat_actor.name || incident.threat_actor}
            </div>
          )}
        </div>
        <SimilarityBadge score={similarity.score} />
      </div>

      {similarity.factors?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {similarity.factors.slice(0, 4).map((factor, i) => (
            <FactorChip key={i} factor={factor.factor || factor} />
          ))}
          {similarity.factors.length > 4 && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700/50 text-gray-500">
              +{similarity.factors.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        {incident.sector && <span>{incident.sector}</span>}
        {incident.discovered_date && (
          <span>
            {formatDistanceToNow(new Date(incident.discovered_date), { addSuffix: true })}
          </span>
        )}
      </div>
    </Link>
  )
}

export default function SimilarIncidentsPanel({ incidentId, currentIncident }) {
  const [similarIncidents, setSimilarIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadSimilar() {
      if (!incidentId) return

      setLoading(true)
      setError(null)

      try {
        const results = await getSimilarIncidents(incidentId, 5)
        setSimilarIncidents(results || [])
      } catch (err) {
        console.error('Error loading similar incidents:', err)
        setError('Failed to load similar incidents')
      } finally {
        setLoading(false)
      }
    }

    loadSimilar()
  }, [incidentId])

  if (loading) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          Similar Incidents
        </h4>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Similar Incidents</h4>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    )
  }

  if (similarIncidents.length === 0) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          Similar Incidents
        </h4>
        <div className="p-4 bg-gray-800/50 rounded border border-gray-700/50 text-center">
          <p className="text-sm text-gray-500">No similar incidents found</p>
        </div>
      </div>
    )
  }

  // Calculate average similarity
  const avgSimilarity = Math.round(
    similarIncidents.reduce((sum, i) => sum + (i.similarity?.score || 0), 0) /
      similarIncidents.length
  )

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        Similar Incidents
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-blue-900/50 text-blue-400 border border-blue-700/50">
          {similarIncidents.length} found
        </span>
      </h4>

      <div className="mb-3 p-2 bg-gray-800/30 rounded text-xs text-gray-500 flex items-center gap-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Average similarity: {avgSimilarity}%
      </div>

      <div className="space-y-2">
        {similarIncidents.map((item) => (
          <IncidentItem
            key={item.id}
            incident={item}
            similarity={item.similarity || { score: 0, factors: [] }}
          />
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Similarity based on: actor, sector, geography, and TTPs
      </div>
    </div>
  )
}
