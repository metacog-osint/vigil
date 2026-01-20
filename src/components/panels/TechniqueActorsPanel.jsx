/**
 * TechniqueActorsPanel
 * Shows which threat actors use a specific MITRE ATT&CK technique
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { correlations } from '../../lib/supabase'
import { TrendBadge } from '../badges'

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-12 bg-gray-800 rounded"></div>
        </div>
      ))}
    </div>
  )
}

function ActorTypeBadge({ type }) {
  const colors = {
    'Nation-State': 'bg-red-900/50 text-red-400 border-red-700/50',
    Criminal: 'bg-orange-900/50 text-orange-400 border-orange-700/50',
    Hacktivist: 'bg-purple-900/50 text-purple-400 border-purple-700/50',
    Unknown: 'bg-gray-800 text-gray-400 border-gray-700',
  }

  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border ${colors[type] || colors.Unknown}`}>
      {type || 'Unknown'}
    </span>
  )
}

function ActorItem({ actor, usageNotes, confidence }) {
  return (
    <Link
      to={`/actors?selected=${actor?.id}`}
      className="block p-3 bg-gray-800/50 rounded border border-gray-700/50 hover:border-cyber-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-white truncate">{actor?.name || 'Unknown Actor'}</span>
          {actor?.trend_status && <TrendBadge status={actor.trend_status} showLabel={false} />}
        </div>
        <ActorTypeBadge type={actor?.actor_type} />
      </div>

      {usageNotes && <p className="mt-2 text-xs text-gray-400 line-clamp-2">{usageNotes}</p>}

      {actor?.target_sectors?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {actor.target_sectors.slice(0, 3).map((sector) => (
            <span
              key={sector}
              className="px-1.5 py-0.5 text-xs rounded bg-gray-700/50 text-gray-400"
            >
              {sector}
            </span>
          ))}
          {actor.target_sectors.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700/50 text-gray-500">
              +{actor.target_sectors.length - 3}
            </span>
          )}
        </div>
      )}

      {confidence && <div className="mt-2 text-xs text-gray-500">Confidence: {confidence}</div>}
    </Link>
  )
}

export default function TechniqueActorsPanel({ techniqueId, techniqueName }) {
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadActors() {
      if (!techniqueId) return

      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await correlations.getTechniqueActors(techniqueId)

        if (fetchError) throw fetchError

        setActors(data || [])
      } catch (err) {
        console.error('Error loading technique actors:', err)
        setError('Failed to load actors')
      } finally {
        setLoading(false)
      }
    }

    loadActors()
  }, [techniqueId])

  if (loading) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Actors Using This Technique
        </h4>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Threat Actors</h4>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    )
  }

  if (actors.length === 0) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Threat Actors
        </h4>
        <div className="p-4 bg-gray-800/50 rounded border border-gray-700/50 text-center">
          <p className="text-sm text-gray-500">No known actors using this technique</p>
        </div>
      </div>
    )
  }

  // Group actors by type
  const actorsByType = actors.reduce((acc, item) => {
    const type = item.actor?.actor_type || 'Unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(item)
    return acc
  }, {})

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        Actors Using {techniqueName || 'This Technique'}
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-700/50">
          {actors.length}
        </span>
      </h4>

      <div className="space-y-4">
        {Object.entries(actorsByType).map(([type, typeActors]) => (
          <div key={type}>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              {type} ({typeActors.length})
            </div>
            <div className="space-y-2">
              {typeActors.map((item) => (
                <ActorItem
                  key={item.actor_id || item.actor?.id}
                  actor={item.actor}
                  usageNotes={item.usage_notes}
                  confidence={item.confidence}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <a
          href={`https://attack.mitre.org/techniques/${techniqueId?.replace('.', '/')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyber-accent hover:underline flex items-center gap-1"
        >
          View on MITRE ATT&CK
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  )
}
