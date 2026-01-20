/**
 * Custom hook for loading and managing actor data
 * Supports demo mode with mock data
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { threatActors, subscribeToTable, incidents, savedSearches, orgProfile, relevance, watchlists } from '../../lib/supabase'
import { PAGE_SIZE, getTypeConfig } from './ActorConstants'
import { useDemo } from '../../contexts/DemoContext'
import useDemoData from '../../hooks/useDemoData'

export function useActorData(filters) {
  const { search, sectorFilter, trendFilter, typeFilter, statusFilter } = filters
  const { isDemoMode } = useDemo()
  const demoData = useDemoData()

  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [trendSummary, setTrendSummary] = useState({ escalating: 0, stable: 0, declining: 0 })

  // Organization profile for risk scoring
  const [userOrgProfile, setUserOrgProfile] = useState(null)
  const [riskScores, setRiskScores] = useState({})

  // Demo mode: Load mock actors
  useEffect(() => {
    if (!isDemoMode) return

    const loadDemoActors = async () => {
      setLoading(true)
      try {
        const result = await demoData.getActors({
          search,
          trendStatus: trendFilter,
          actorType: typeFilter,
        })
        const demoActors = result?.data || demoData.actors

        // Apply sector filter manually
        let filtered = demoActors
        if (sectorFilter) {
          filtered = filtered.filter(a =>
            a.target_sectors?.includes(sectorFilter)
          )
        }

        setActors(filtered)
        setTotalCount(filtered.length)

        // Set trend summary
        const summary = await demoData.getTrendSummary()
        setTrendSummary(summary || { escalating: 3, stable: 2, declining: 1 })
      } catch (err) {
        console.error('Demo actors error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDemoActors()
  }, [isDemoMode, demoData, search, sectorFilter, trendFilter, typeFilter, statusFilter])

  // Load actors
  const loadActors = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setActors([])
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : actors.length
      const { data, error, count } = await threatActors.getAll({
        search,
        sector: sectorFilter,
        trendStatus: trendFilter,
        actorType: typeFilter,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setActors(data || [])
      } else {
        setActors(prev => [...prev, ...(data || [])])
      }
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading actors:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, sectorFilter, trendFilter, typeFilter, statusFilter, actors.length])

  // Load trend summary
  const loadTrendSummary = useCallback(async () => {
    try {
      const summary = await threatActors.getTrendSummary()
      setTrendSummary(summary)
    } catch (error) {
      console.error('Error loading trend summary:', error)
    }
  }, [])

  // Load org profile for risk scoring
  const loadOrgProfile = useCallback(async () => {
    try {
      const profile = await orgProfile.get()
      setUserOrgProfile(profile)
    } catch (error) {
      console.error('Error loading org profile:', error)
    }
  }, [])

  // Initial load + subscriptions (skip in demo mode)
  useEffect(() => {
    if (isDemoMode) return

    loadActors(true)
    loadTrendSummary()
    loadOrgProfile()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTable('threat_actors', (payload) => {
      if (payload.eventType === 'INSERT') {
        setActors((prev) => [payload.new, ...prev])
        setTotalCount(c => c + 1)
      } else if (payload.eventType === 'UPDATE') {
        setActors((prev) =>
          prev.map((a) => (a.id === payload.new.id ? payload.new : a))
        )
      }
    })

    return () => unsubscribe()
  }, [isDemoMode, search, sectorFilter, trendFilter, typeFilter, statusFilter])

  // Calculate risk scores when org profile or actors change
  useEffect(() => {
    if (userOrgProfile && actors.length > 0) {
      const scores = {}
      actors.forEach(actor => {
        scores[actor.id] = relevance.calculateActorScore(actor, userOrgProfile)
      })
      setRiskScores(scores)
    }
  }, [userOrgProfile, actors])

  // Load more pagination
  const loadMore = useCallback(() => {
    if (!loadingMore && actors.length < totalCount) {
      loadActors(false)
    }
  }, [loadingMore, actors.length, totalCount, loadActors])

  const hasMore = actors.length < totalCount

  return {
    actors,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    trendSummary,
    userOrgProfile,
    riskScores,
    refresh: () => loadActors(true),
  }
}

export function useActorSort(actors, riskScores) {
  const [sortConfig, setSortConfig] = useState({ field: 'incidents_7d', direction: 'desc' })

  const sortedActors = useMemo(() => {
    return [...actors].sort((a, b) => {
      if (!sortConfig) return 0

      const { field, direction } = sortConfig
      let aVal = a[field]
      let bVal = b[field]

      // Handle nulls
      if (aVal == null) aVal = field === 'name' ? '' : -Infinity
      if (bVal == null) bVal = field === 'name' ? '' : -Infinity

      // Actor type uses sortOrder for logical grouping
      if (field === 'actor_type') {
        aVal = getTypeConfig(aVal).sortOrder
        bVal = getTypeConfig(bVal).sortOrder
      }

      // String comparison for other text fields
      if (field === 'name' || field === 'status') {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }

      // Date comparison
      if (field === 'last_seen' || field === 'first_seen') {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }

      // Trend status ordering
      if (field === 'trend_status') {
        const order = { 'ESCALATING': 3, 'STABLE': 2, 'DECLINING': 1 }
        aVal = order[aVal] || 0
        bVal = order[bVal] || 0
      }

      // Risk score sorting
      if (field === 'risk_score') {
        aVal = riskScores[a.id] || 0
        bVal = riskScores[b.id] || 0
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [actors, sortConfig, riskScores])

  return { sortedActors, sortConfig, setSortConfig }
}

export function useActorIncidents(selectedActor) {
  const { isDemoMode } = useDemo()
  const demoData = useDemoData()
  const [actorIncidents, setActorIncidents] = useState([])

  useEffect(() => {
    if (selectedActor) {
      loadActorIncidents(selectedActor.id)
    } else {
      setActorIncidents([])
    }
  }, [selectedActor])

  async function loadActorIncidents(actorId) {
    // Demo mode: use mock incidents
    if (isDemoMode) {
      const demoIncidents = demoData.incidents.filter(i => i.actor_id === actorId)
      setActorIncidents(demoIncidents)
      return
    }

    try {
      const { data } = await incidents.getRecent({ actor_id: actorId, limit: 20, days: 365 })
      setActorIncidents(data || [])
    } catch (error) {
      console.error('Error loading actor incidents:', error)
    }
  }

  // Convert incidents to timeline events
  const timelineEvents = actorIncidents.map((incident) => ({
    id: incident.id,
    type: 'incident',
    title: incident.victim_name || 'Unknown Victim',
    description: `${incident.victim_sector || 'Unknown sector'} - ${incident.status || 'claimed'}`,
    date: incident.discovered_date,
    tags: [incident.victim_country].filter(Boolean),
  }))

  return { actorIncidents, timelineEvents }
}

export function useRelatedActors(selectedActor) {
  const { isDemoMode } = useDemo()
  const demoData = useDemoData()
  const [relatedActors, setRelatedActors] = useState([])

  useEffect(() => {
    if (selectedActor) {
      loadRelatedActors(selectedActor)
    } else {
      setRelatedActors([])
    }
  }, [selectedActor])

  async function loadRelatedActors(actor) {
    // Get all actors (demo or real)
    let allActors
    if (isDemoMode) {
      allActors = demoData.actors
    } else {
      try {
        const { data } = await threatActors.getAll({ limit: 100 })
        allActors = data
      } catch (error) {
        console.error('Error loading related actors:', error)
        return
      }
    }

    if (!allActors) return

    const related = allActors
      .filter(a => a.id !== actor.id)
      .map(a => {
        let score = 0
        if (a.actor_type === actor.actor_type) score += 20
        const sharedSectors = (a.target_sectors || []).filter(s =>
          (actor.target_sectors || []).includes(s)
        )
        score += sharedSectors.length * 15
        const sharedTTPs = (a.ttps || []).filter(t =>
          (actor.ttps || []).includes(t)
        )
        score += sharedTTPs.length * 10
        return { ...a, similarityScore: score }
      })
      .filter(a => a.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5)

    setRelatedActors(related)
  }

  return relatedActors
}

export function useSavedFilters(applyFilter) {
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersList, setSavedFiltersList] = useState([])
  const [saveFilterName, setSaveFilterName] = useState('')

  useEffect(() => {
    loadSavedFilters()
  }, [])

  async function loadSavedFilters() {
    try {
      const { data } = await savedSearches.getAll('anonymous', 'threat_actors')
      setSavedFiltersList(data || [])
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  async function saveCurrentFilter(filterConfig) {
    if (!saveFilterName.trim()) return

    try {
      await savedSearches.create({
        user_id: 'anonymous',
        name: saveFilterName,
        search_type: 'threat_actors',
        query: filterConfig,
      })
      setSaveFilterName('')
      setSavedFiltersOpen(false)
      loadSavedFilters()
    } catch (error) {
      console.error('Error saving filter:', error)
    }
  }

  async function deleteSavedFilter(id) {
    try {
      await savedSearches.delete(id)
      loadSavedFilters()
    } catch (error) {
      console.error('Error deleting filter:', error)
    }
  }

  return {
    savedFiltersOpen,
    setSavedFiltersOpen,
    savedFiltersList,
    saveFilterName,
    setSaveFilterName,
    saveCurrentFilter,
    deleteSavedFilter,
  }
}
