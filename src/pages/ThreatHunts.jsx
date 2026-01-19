import { useState, useEffect } from 'react'
import { threatHunts } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ThreatHuntCard, Tooltip, FeatureGate } from '../components'

const CONFIDENCE_FILTERS = [
  { value: '', label: 'All Confidence' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

export default function ThreatHunts() {
  const { user } = useAuth()
  const userId = user?.uid || 'anonymous'

  const [hunts, setHunts] = useState([])
  const [userProgress, setUserProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    loadHunts()
    loadProgress()
  }, [userId])

  async function loadHunts() {
    setLoading(true)
    try {
      const { data, error } = await threatHunts.getAll({ limit: 100, activeOnly: true })
      if (error) throw error
      setHunts(data || [])
    } catch (error) {
      console.error('Error loading threat hunts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadProgress() {
    try {
      const { data, error } = await threatHunts.getUserProgress(userId)
      if (error) throw error

      // Convert to map for easy lookup
      const progressMap = {}
      for (const p of data || []) {
        progressMap[p.hunt_id] = p
      }
      setUserProgress(progressMap)
    } catch (error) {
      console.error('Error loading progress:', error)
    }
  }

  function handleProgressUpdate(huntId, completedChecks, notes, isComplete = false) {
    setUserProgress(prev => ({
      ...prev,
      [huntId]: {
        ...prev[huntId],
        hunt_id: huntId,
        completed_checks: completedChecks,
        notes,
        status: isComplete ? 'completed' : 'in_progress',
      }
    }))
  }

  // Filter hunts
  const filteredHunts = hunts.filter(hunt => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        hunt.title?.toLowerCase().includes(searchLower) ||
        hunt.actor_name?.toLowerCase().includes(searchLower) ||
        (hunt.tags || []).some(t => t.toLowerCase().includes(searchLower))
      if (!matchesSearch) return false
    }

    // Confidence filter
    if (confidenceFilter && hunt.confidence !== confidenceFilter) {
      return false
    }

    // Status filter
    if (statusFilter) {
      const progress = userProgress[hunt.id]
      const status = progress?.status || 'not_started'
      if (status !== statusFilter) return false
    }

    return true
  })

  // Group by status for display
  const inProgressHunts = filteredHunts.filter(h => userProgress[h.id]?.status === 'in_progress')
  const completedHunts = filteredHunts.filter(h => userProgress[h.id]?.status === 'completed')
  const notStartedHunts = filteredHunts.filter(h => !userProgress[h.id] || userProgress[h.id]?.status === 'not_started')

  // Stats
  const totalHunts = hunts.length
  const totalCompleted = Object.values(userProgress).filter(p => p.status === 'completed').length
  const totalInProgress = Object.values(userProgress).filter(p => p.status === 'in_progress').length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Threat Hunts</h1>
            <p className="text-gray-400 text-sm mt-1">Loading threat hunt guides...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-cyan-400 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <FeatureGate feature="threat_hunts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Threat Hunts
              <Tooltip content="Actionable detection guides with step-by-step checks and SIEM queries to hunt for threats in your environment">
                <span className="text-gray-500 cursor-help">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </Tooltip>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Step-by-step guides to detect threats in your environment
            </p>
          </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-lg font-bold text-white">{totalHunts}</div>
            <div className="text-xs text-gray-500">Total Hunts</div>
          </div>
          <div className="text-center px-4 py-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="text-lg font-bold text-cyan-400">{totalInProgress}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
          <div className="text-center px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="text-lg font-bold text-green-400">{totalCompleted}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hunts, actors, tags..."
            className="w-full cyber-input pl-9"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Confidence Filter */}
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value)}
          className="cyber-input"
        >
          {CONFIDENCE_FILTERS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="cyber-input"
        >
          {STATUS_FILTERS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || confidenceFilter || statusFilter) && (
          <button
            onClick={() => {
              setSearch('')
              setConfidenceFilter('')
              setStatusFilter('')
            }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filteredHunts.length} of {totalHunts} threat hunts
      </div>

      {/* Hunt List */}
      {filteredHunts.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg text-white mb-1">No threat hunts found</h3>
          <p className="text-gray-500 text-sm">
            {search ? 'Try adjusting your search terms' : 'No threat hunts match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* In Progress Section */}
          {inProgressHunts.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="text-cyan-400">In Progress</span>
                <span className="text-sm text-gray-500">({inProgressHunts.length})</span>
              </h2>
              <div className="space-y-3">
                {inProgressHunts.map(hunt => (
                  <ThreatHuntCard
                    key={hunt.id}
                    hunt={hunt}
                    userId={userId}
                    progress={userProgress[hunt.id]}
                    onProgressUpdate={handleProgressUpdate}
                    expanded={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Not Started Section */}
          {notStartedHunts.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span>Available Hunts</span>
                <span className="text-sm text-gray-500">({notStartedHunts.length})</span>
              </h2>
              <div className="space-y-3">
                {notStartedHunts.map(hunt => (
                  <ThreatHuntCard
                    key={hunt.id}
                    hunt={hunt}
                    userId={userId}
                    progress={userProgress[hunt.id]}
                    onProgressUpdate={handleProgressUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completedHunts.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="text-green-400">Completed</span>
                <span className="text-sm text-gray-500">({completedHunts.length})</span>
              </h2>
              <div className="space-y-3">
                {completedHunts.map(hunt => (
                  <ThreatHuntCard
                    key={hunt.id}
                    hunt={hunt}
                    userId={userId}
                    progress={userProgress[hunt.id]}
                    onProgressUpdate={handleProgressUpdate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

        {/* Info box at bottom */}
        <div className="mt-8 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-white mb-2">About Threat Hunts</h3>
          <p className="text-sm text-gray-400">
            These guides provide practical, actionable steps to detect specific threats in your environment.
            Each hunt includes quick checks you can run manually, SIEM queries for automated detection,
            and defensive recommendations. Progress is saved automatically as you work through each hunt.
          </p>
        </div>
      </div>
    </FeatureGate>
  )
}
