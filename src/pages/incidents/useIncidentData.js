/**
 * Incident Data Hooks
 * Custom hooks for incident data loading, sorting, filtering, and analytics
 * Supports demo mode with mock data
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { incidents, subscribeToTable, savedSearches, threatActors } from '../../lib/supabase'
import { PAGE_SIZE, SECTOR_COLORS } from './IncidentConstants'
import { useDemo } from '../../contexts/DemoContext'
import useDemoData from '../../hooks/useDemoData'

/**
 * Main hook for incident data loading and management
 */
export function useIncidentData(filters) {
  const { search, sectorFilter, statusFilter, countryFilter, timeRange, actorFilter } = filters
  const { isDemoMode } = useDemo()
  const demoData = useDemoData()

  const [incidentList, setIncidentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [lastIncidentDate, setLastIncidentDate] = useState(null)
  const [actorTrends, setActorTrends] = useState({})

  // Calculate actor incident trends for sparklines
  const calculateActorTrends = useCallback((data) => {
    const trends = {}
    const now = new Date()

    data.forEach(inc => {
      const actorId = inc.actor_id
      if (!actorId) return

      if (!trends[actorId]) {
        trends[actorId] = { week1: 0, week2: 0, week3: 0, week4: 0 }
      }

      const incDate = new Date(inc.discovered_date)
      const daysAgo = Math.floor((now - incDate) / (1000 * 60 * 60 * 24))

      if (daysAgo <= 7) trends[actorId].week1++
      else if (daysAgo <= 14) trends[actorId].week2++
      else if (daysAgo <= 21) trends[actorId].week3++
      else if (daysAgo <= 28) trends[actorId].week4++
    })

    setActorTrends(trends)
  }, [])

  const loadIncidents = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setIncidentList([])
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : incidentList.length
      const { data, error, count } = await incidents.getAll({
        search,
        sector: sectorFilter,
        status: statusFilter,
        country: countryFilter,
        actor_id: actorFilter,
        days: timeRange,
        limit: PAGE_SIZE,
        offset,
      })

      if (error) throw error

      if (reset) {
        setIncidentList(data || [])
        if (data && data.length > 0) {
          setLastIncidentDate(data[0].discovered_date)
        }
        calculateActorTrends(data || [])
      } else {
        setIncidentList(prev => [...prev, ...(data || [])])
      }
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, sectorFilter, statusFilter, countryFilter, timeRange, actorFilter, incidentList.length, calculateActorTrends])

  // Demo mode: Load mock incidents
  useEffect(() => {
    if (!isDemoMode) return

    setLoading(true)
    let data = [...demoData.incidents]

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      data = data.filter(i =>
        i.victim_name?.toLowerCase().includes(searchLower) ||
        i.victim_sector?.toLowerCase().includes(searchLower)
      )
    }
    if (sectorFilter) {
      data = data.filter(i => i.victim_sector === sectorFilter)
    }
    if (actorFilter) {
      data = data.filter(i => i.actor_id === actorFilter)
    }

    setIncidentList(data)
    setTotalCount(data.length)
    if (data.length > 0) {
      setLastIncidentDate(data[0].discovered_date)
    }
    calculateActorTrends(data)
    setLoading(false)
  }, [isDemoMode, demoData, search, sectorFilter, statusFilter, countryFilter, timeRange, actorFilter, calculateActorTrends])

  // Initial load + subscriptions (skip in demo mode)
  useEffect(() => {
    if (isDemoMode) return

    loadIncidents(true)

    const unsubscribe = subscribeToTable('incidents', (payload) => {
      if (payload.eventType === 'INSERT') {
        setIncidentList((prev) => [payload.new, ...prev])
        setTotalCount(c => c + 1)
      }
    })

    return () => unsubscribe()
  }, [isDemoMode, search, sectorFilter, statusFilter, countryFilter, timeRange, actorFilter])

  const loadMore = useCallback(() => {
    if (!loadingMore && incidentList.length < totalCount) {
      loadIncidents(false)
    }
  }, [loadingMore, incidentList.length, totalCount, loadIncidents])

  const hasMore = incidentList.length < totalCount

  // Data freshness indicator
  const dataFreshness = useMemo(() => {
    if (!lastIncidentDate) return null
    const date = new Date(lastIncidentDate)
    const now = new Date()
    const hoursAgo = Math.floor((now - date) / (1000 * 60 * 60))

    if (hoursAgo < 24) return { text: `${hoursAgo}h ago`, color: 'text-green-400' }
    if (hoursAgo < 72) return { text: `${Math.floor(hoursAgo / 24)}d ago`, color: 'text-yellow-400' }
    return { text: `${Math.floor(hoursAgo / 24)}d ago`, color: 'text-red-400' }
  }, [lastIncidentDate])

  return {
    incidentList,
    setIncidentList,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    dataFreshness,
    actorTrends,
    refresh: () => loadIncidents(true),
  }
}

/**
 * Hook for incident sorting
 */
export function useIncidentSort(incidentList) {
  const [sortConfig, setSortConfig] = useState({ field: 'discovered_date', direction: 'desc' })

  const sortedIncidents = useMemo(() => {
    return [...incidentList].sort((a, b) => {
      if (!sortConfig) return 0

      const { field, direction } = sortConfig
      let aVal = a[field]
      let bVal = b[field]

      // Handle nested threat_actor field
      if (field === 'actor_name') {
        aVal = a.threat_actor?.name || ''
        bVal = b.threat_actor?.name || ''
      }

      // Handle nulls
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''

      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      // Date comparison
      if (field === 'discovered_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [incidentList, sortConfig])

  return { sortedIncidents, sortConfig, setSortConfig }
}

/**
 * Hook for actor filter from URL params
 */
export function useActorFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [actorFilter, setActorFilter] = useState('')
  const [actorName, setActorName] = useState('')

  useEffect(() => {
    const actorId = searchParams.get('actor')
    if (actorId) {
      setActorFilter(actorId)
      loadActorName(actorId)
    }
  }, [searchParams])

  async function loadActorName(actorId) {
    try {
      const { data } = await threatActors.getById(actorId)
      if (data) {
        setActorName(data.name)
      }
    } catch (error) {
      console.error('Error loading actor:', error)
    }
  }

  const clearActorFilter = useCallback(() => {
    setActorFilter('')
    setActorName('')
    setSearchParams({})
  }, [setSearchParams])

  return {
    actorFilter,
    setActorFilter,
    actorName,
    setActorName,
    clearActorFilter,
  }
}

/**
 * Hook for saved filters
 */
export function useSavedFilters(applyFilter) {
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersList, setSavedFiltersList] = useState([])
  const [saveFilterName, setSaveFilterName] = useState('')

  useEffect(() => {
    loadSavedFilters()
  }, [])

  async function loadSavedFilters() {
    try {
      const { data } = await savedSearches.getAll('anonymous', 'incidents')
      setSavedFiltersList(data || [])
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  const saveCurrentFilter = useCallback(async (filterConfig) => {
    if (!saveFilterName.trim()) return

    try {
      await savedSearches.create({
        user_id: 'anonymous',
        name: saveFilterName,
        search_type: 'incidents',
        query: filterConfig,
      })
      setSaveFilterName('')
      setSavedFiltersOpen(false)
      loadSavedFilters()
    } catch (error) {
      console.error('Error saving filter:', error)
    }
  }, [saveFilterName])

  const applySavedFilter = useCallback((filter) => {
    applyFilter(filter.query || {})
    setSavedFiltersOpen(false)
  }, [applyFilter])

  const deleteSavedFilter = useCallback(async (id) => {
    try {
      await savedSearches.delete(id)
      loadSavedFilters()
    } catch (error) {
      console.error('Error deleting filter:', error)
    }
  }, [])

  return {
    savedFiltersOpen,
    setSavedFiltersOpen,
    savedFiltersList,
    saveFilterName,
    setSaveFilterName,
    saveCurrentFilter,
    applySavedFilter,
    deleteSavedFilter,
  }
}

/**
 * Hook for incident analytics computation
 */
export function useIncidentAnalytics(incidentList, timeRange) {
  return useMemo(() => {
    if (incidentList.length === 0) return null

    const actorCounts = {}
    const sectorCounts = {}
    const countryCounts = {}
    const statusCounts = {}
    const dailyCounts = {}

    for (const incident of incidentList) {
      const actorName = incident.threat_actor?.name || 'Unknown'
      const actorId = incident.actor_id
      const sectorName = incident.victim_sector || 'Other'
      const countryName = incident.victim_country || 'Unknown'
      const status = incident.status || 'unknown'

      // Actor counts with ID
      if (!actorCounts[actorName]) {
        actorCounts[actorName] = { count: 0, id: actorId }
      }
      actorCounts[actorName].count++

      sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1
      countryCounts[countryName] = (countryCounts[countryName] || 0) + 1
      statusCounts[status] = (statusCounts[status] || 0) + 1

      // Daily timeline
      if (incident.discovered_date) {
        const dateKey = incident.discovered_date.split('T')[0]
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1
      }
    }

    const topActors = Object.entries(actorCounts)
      .map(([name, data]) => ({ name, count: data.count, id: data.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topSectors = Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Sector data for pie chart (with colors)
    const sectorPieData = topSectors.slice(0, 8).map(s => ({
      name: s.name.charAt(0).toUpperCase() + s.name.slice(1),
      value: s.count,
      color: SECTOR_COLORS[s.name.toLowerCase()] || SECTOR_COLORS.other
    }))

    const topCountries = Object.entries(countryCounts)
      .filter(([name]) => name !== 'Unknown')
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    const statuses = Object.entries(statusCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Timeline data - adapts to selected time range
    const timelineData = []
    const now = new Date()
    const days = timeRange === 0 ? 90 : timeRange // Default to 90 for "All"

    // Determine label interval based on time range
    let labelInterval
    if (days <= 7) labelInterval = 1
    else if (days <= 30) labelInterval = 5
    else if (days <= 90) labelInterval = 10
    else labelInterval = 30

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      timelineData.push({
        date: dateKey,
        label: i % labelInterval === 0 ? monthDay : '',
        incidents: dailyCounts[dateKey] || 0
      })
    }

    return { topActors, topSectors, sectorPieData, topCountries, statuses, timelineData }
  }, [incidentList, timeRange])
}
