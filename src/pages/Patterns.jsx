/**
 * Patterns Page
 *
 * Displays detected threat patterns including:
 * - Campaigns (related incidents grouped together)
 * - Anomaly alerts (unusual activity spikes)
 * - Temporal clusters (activity bursts)
 * - Geographic targeting patterns
 * - Actor-sector patterns
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyzePatterns, PATTERN_TYPES } from '../lib/patternDetection'
import { incidents as incidentsApi, supabase } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { SkeletonCard } from '../components'

// Pattern type configurations
const PATTERN_CONFIG = {
  [PATTERN_TYPES.CAMPAIGN]: {
    label: 'Campaigns',
    icon: '🎯',
    color: 'text-red-400',
    bgColor: 'bg-red-900/20',
    borderColor: 'border-red-700/50',
    description: 'Related incidents grouped by actor and timeframe',
  },
  [PATTERN_TYPES.ANOMALY]: {
    label: 'Anomalies',
    icon: '⚠️',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/20',
    borderColor: 'border-yellow-700/50',
    description: 'Unusual activity spikes detected',
  },
  [PATTERN_TYPES.TEMPORAL_CLUSTER]: {
    label: 'Activity Bursts',
    icon: '📈',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/20',
    borderColor: 'border-orange-700/50',
    description: 'Concentrated activity in short time windows',
  },
  [PATTERN_TYPES.GEOGRAPHIC]: {
    label: 'Geographic',
    icon: '🌍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-700/50',
    description: 'Country targeting patterns',
  },
  [PATTERN_TYPES.ACTOR_SECTOR]: {
    label: 'Actor-Sector',
    icon: '🏢',
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/20',
    borderColor: 'border-purple-700/50',
    description: 'Actors consistently targeting specific sectors',
  },
  [PATTERN_TYPES.ACTOR_TECHNIQUE]: {
    label: 'Actor-Technique',
    icon: '⚔️',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-900/20',
    borderColor: 'border-cyan-700/50',
    description: 'Actors using specific techniques repeatedly',
  },
}

function ConfidenceBadge({ confidence }) {
  const percentage = Math.round(confidence * 100)
  let color = 'text-gray-400 bg-gray-800 border-gray-700'
  if (percentage >= 80) color = 'text-green-400 bg-green-900/50 border-green-700/50'
  else if (percentage >= 60) color = 'text-yellow-400 bg-yellow-900/50 border-yellow-700/50'
  else if (percentage >= 40) color = 'text-orange-400 bg-orange-900/50 border-orange-700/50'

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${color}`}>
      {percentage}% confidence
    </span>
  )
}

function CampaignCard({ pattern }) {
  return (
    <div className="cyber-card hover:border-cyber-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{pattern.actorName || 'Unknown Actor'}</h3>
          <p className="text-sm text-gray-400">Campaign detected</p>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs">Incidents</div>
            <div className="text-white font-medium">{pattern.incidentCount}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Duration</div>
            <div className="text-white">
              {pattern.startDate && pattern.endDate && (
                <>
                  {new Date(pattern.startDate).toLocaleDateString()} -{' '}
                  {new Date(pattern.endDate).toLocaleDateString()}
                </>
              )}
            </div>
          </div>
        </div>

        {pattern.targetSectors?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1">Target Sectors</div>
            <div className="flex flex-wrap gap-1">
              {pattern.targetSectors.slice(0, 4).map((sector) => (
                <span key={sector} className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300">
                  {sector}
                </span>
              ))}
              {pattern.targetSectors.length > 4 && (
                <span className="text-xs text-gray-500">+{pattern.targetSectors.length - 4}</span>
              )}
            </div>
          </div>
        )}

        {pattern.description && (
          <p className="text-gray-400 text-xs">{pattern.description}</p>
        )}

        <div className="pt-2 border-t border-gray-800">
          <Link
            to={`/actors?search=${encodeURIComponent(pattern.actorName || '')}`}
            className="text-xs text-cyber-accent hover:underline"
          >
            View Actor Profile →
          </Link>
        </div>
      </div>
    </div>
  )
}

function AnomalyCard({ pattern }) {
  return (
    <div className="cyber-card border-yellow-700/50 hover:border-yellow-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-yellow-400 font-medium">Anomaly Detected</h3>
            <p className="text-sm text-gray-400">{pattern.type}</p>
          </div>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs">Current</div>
            <div className="text-white font-medium">{pattern.currentValue}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Expected</div>
            <div className="text-gray-400">{pattern.expectedValue}</div>
          </div>
        </div>

        <div>
          <div className="text-gray-500 text-xs">Deviation</div>
          <div className="text-yellow-400 font-medium">
            {pattern.deviation > 0 ? '+' : ''}{pattern.deviation?.toFixed(1)}% from normal
          </div>
        </div>

        {pattern.description && (
          <p className="text-gray-400 text-xs mt-2">{pattern.description}</p>
        )}
      </div>
    </div>
  )
}

function TemporalClusterCard({ pattern }) {
  return (
    <div className="cyber-card hover:border-cyber-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-orange-400 font-medium">Activity Burst</h3>
          <p className="text-sm text-gray-400">
            {pattern.incidentCount} incidents in {pattern.windowHours || 24} hours
          </p>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Time Window</div>
          <div className="text-white">
            {pattern.startTime && formatDistanceToNow(new Date(pattern.startTime), { addSuffix: true })}
          </div>
        </div>

        {pattern.actors?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1">Actors Involved</div>
            <div className="flex flex-wrap gap-1">
              {pattern.actors.slice(0, 3).map((actor) => (
                <span key={actor} className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300">
                  {actor}
                </span>
              ))}
              {pattern.actors.length > 3 && (
                <span className="text-xs text-gray-500">+{pattern.actors.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {pattern.description && (
          <p className="text-gray-400 text-xs">{pattern.description}</p>
        )}
      </div>
    </div>
  )
}

function GeographicCard({ pattern }) {
  return (
    <div className="cyber-card hover:border-cyber-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌍</span>
          <div>
            <h3 className="text-blue-400 font-medium">{pattern.country}</h3>
            <p className="text-sm text-gray-400">Geographic targeting</p>
          </div>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs">Incidents</div>
            <div className="text-white font-medium">{pattern.incidentCount}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Unique Actors</div>
            <div className="text-white">{pattern.actorCount || 'N/A'}</div>
          </div>
        </div>

        {pattern.topActors?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1">Top Actors</div>
            <div className="flex flex-wrap gap-1">
              {pattern.topActors.slice(0, 3).map((actor) => (
                <span key={actor} className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300">
                  {actor}
                </span>
              ))}
            </div>
          </div>
        )}

        {pattern.description && (
          <p className="text-gray-400 text-xs">{pattern.description}</p>
        )}
      </div>
    </div>
  )
}

function ActorSectorCard({ pattern }) {
  return (
    <div className="cyber-card hover:border-cyber-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-purple-400 font-medium">{pattern.actorName}</h3>
          <p className="text-sm text-gray-400">
            Targeting {pattern.sector}
          </p>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs">Occurrences</div>
            <div className="text-white font-medium">{pattern.occurrences}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Sector</div>
            <div className="text-purple-300">{pattern.sector}</div>
          </div>
        </div>

        {pattern.description && (
          <p className="text-gray-400 text-xs">{pattern.description}</p>
        )}

        <div className="pt-2 border-t border-gray-800">
          <Link
            to={`/actors?search=${encodeURIComponent(pattern.actorName || '')}`}
            className="text-xs text-cyber-accent hover:underline"
          >
            View Actor →
          </Link>
        </div>
      </div>
    </div>
  )
}

function PatternCard({ pattern }) {
  const type = pattern.type

  switch (type) {
    case PATTERN_TYPES.CAMPAIGN:
      return <CampaignCard pattern={pattern} />
    case PATTERN_TYPES.ANOMALY:
      return <AnomalyCard pattern={pattern} />
    case PATTERN_TYPES.TEMPORAL_CLUSTER:
      return <TemporalClusterCard pattern={pattern} />
    case PATTERN_TYPES.GEOGRAPHIC:
      return <GeographicCard pattern={pattern} />
    case PATTERN_TYPES.ACTOR_SECTOR:
    case PATTERN_TYPES.ACTOR_TECHNIQUE:
      return <ActorSectorCard pattern={pattern} />
    default:
      return (
        <div className="cyber-card">
          <pre className="text-xs text-gray-400">{JSON.stringify(pattern, null, 2)}</pre>
        </div>
      )
  }
}

function PatternStats({ patterns }) {
  const stats = Object.entries(PATTERN_CONFIG).map(([type, config]) => {
    const count = patterns.filter((p) => p.type === type).length
    return { type, config, count }
  })

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map(({ type, config, count }) => (
        <div key={type} className={`cyber-card ${config.bgColor} border ${config.borderColor}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{config.icon}</span>
            <span className={`text-xl font-bold ${config.color}`}>{count}</span>
          </div>
          <div className="text-xs text-gray-400">{config.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Patterns() {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedType, setSelectedType] = useState('all')
  const [timeRange, setTimeRange] = useState(30)

  useEffect(() => {
    async function loadPatterns() {
      setLoading(true)
      setError(null)

      try {
        // Load incidents for pattern analysis
        const { data: incidentsData } = await incidentsApi.getRecent({ days: timeRange, limit: 500 })

        if (!incidentsData || incidentsData.length === 0) {
          setPatterns([])
          return
        }

        // Run pattern detection
        const detectedPatterns = await analyzePatterns({
          days: timeRange,
          minConfidence: 0.3,
        })

        setPatterns(detectedPatterns?.patterns || [])
      } catch (err) {
        console.error('Error loading patterns:', err)
        setError('Failed to analyze patterns')
      } finally {
        setLoading(false)
      }
    }

    loadPatterns()
  }, [timeRange])

  // Filter patterns by type
  const filteredPatterns = selectedType === 'all'
    ? patterns
    : patterns.filter((p) => p.type === selectedType)

  // Sort by confidence
  const sortedPatterns = [...filteredPatterns].sort((a, b) => b.confidence - a.confidence)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Pattern Detection</h1>
        <p className="text-gray-400 text-sm mt-1">
          Automatically detected threat patterns and anomalies
        </p>
      </div>

      {/* Time Range Filter */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 rounded text-sm ${
                timeRange === days
                  ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>

        <span className="text-gray-500 text-sm">
          {patterns.length} patterns detected
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="cyber-card text-center py-12">
          <div className="text-red-400 mb-2">{error}</div>
          <button
            onClick={() => setTimeRange(timeRange)}
            className="text-cyber-accent hover:underline text-sm"
          >
            Try Again
          </button>
        </div>
      ) : patterns.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-gray-400 font-medium">No patterns detected</h3>
          <p className="text-gray-500 text-sm mt-1">
            Try increasing the time range or wait for more data
          </p>
        </div>
      ) : (
        <>
          {/* Pattern Stats */}
          <PatternStats patterns={patterns} />

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded text-sm ${
                selectedType === 'all'
                  ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              All ({patterns.length})
            </button>
            {Object.entries(PATTERN_CONFIG).map(([type, config]) => {
              const count = patterns.filter((p) => p.type === type).length
              if (count === 0) return null
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${
                    selectedType === type
                      ? `${config.bgColor} ${config.color} border ${config.borderColor}`
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span>{config.icon}</span>
                  {config.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Pattern Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPatterns.map((pattern, index) => (
              <PatternCard key={`${pattern.type}-${index}`} pattern={pattern} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
