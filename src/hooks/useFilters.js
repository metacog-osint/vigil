/**
 * useFilters Hook
 * Standardized filter state management with optional URL synchronization
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Filter state management hook
 * @param {Object} initialFilters - Initial filter values { filterName: defaultValue }
 * @param {Object} options - Configuration options
 * @param {boolean} options.syncWithUrl - Sync filters with URL params (default: false)
 * @param {Function} options.onFilterChange - Callback when any filter changes
 * @returns {Object} Filter state and handlers
 */
export function useFilters(initialFilters = {}, options = {}) {
  const { syncWithUrl = false, onFilterChange } = options
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize filters from URL if syncing, otherwise use initial values
  const getInitialState = useCallback(() => {
    if (!syncWithUrl) return initialFilters

    const fromUrl = {}
    Object.keys(initialFilters).forEach((key) => {
      const urlValue = searchParams.get(key)
      if (urlValue !== null) {
        // Handle arrays (comma-separated)
        if (Array.isArray(initialFilters[key])) {
          fromUrl[key] = urlValue ? urlValue.split(',') : []
        } else {
          fromUrl[key] = urlValue
        }
      } else {
        fromUrl[key] = initialFilters[key]
      }
    })
    return fromUrl
  }, [initialFilters, searchParams, syncWithUrl])

  const [filters, setFiltersState] = useState(getInitialState)

  // Update URL when filters change (if syncing)
  useEffect(() => {
    if (!syncWithUrl) return

    const newParams = new URLSearchParams(searchParams)

    Object.entries(filters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        newParams.delete(key)
      } else if (Array.isArray(value)) {
        newParams.set(key, value.join(','))
      } else {
        newParams.set(key, String(value))
      }
    })

    setSearchParams(newParams, { replace: true })
  }, [filters, syncWithUrl, searchParams, setSearchParams])

  // Set a single filter
  const setFilter = useCallback((key, value) => {
    setFiltersState((prev) => {
      const next = { ...prev, [key]: value }
      onFilterChange?.(next)
      return next
    })
  }, [onFilterChange])

  // Set multiple filters at once
  const setFilters = useCallback((updates) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...updates }
      onFilterChange?.(next)
      return next
    })
  }, [onFilterChange])

  // Reset all filters to initial values
  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters)
    onFilterChange?.(initialFilters)
  }, [initialFilters, onFilterChange])

  // Check if any filter is active (different from initial)
  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some((key) => {
      const current = filters[key]
      const initial = initialFilters[key]

      if (Array.isArray(current)) {
        return current.length !== (initial?.length || 0) ||
          current.some((v, i) => v !== initial?.[i])
      }
      return current !== initial
    })
  }, [filters, initialFilters])

  // Count of active filters
  const activeFilterCount = useMemo(() => {
    return Object.keys(filters).filter((key) => {
      const value = filters[key]
      const initial = initialFilters[key]

      if (Array.isArray(value)) return value.length > 0 && value.length !== (initial?.length || 0)
      return value !== '' && value !== initial
    }).length
  }, [filters, initialFilters])

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
    // Convenience getters for common patterns
    getFilter: (key) => filters[key],
  }
}

/**
 * Pre-configured filter hooks for common patterns
 */

/**
 * Search filter with debouncing
 */
export function useSearchFilter(initialValue = '', debounceMs = 300) {
  const [search, setSearchImmediate] = useState(initialValue)
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [search, debounceMs])

  const clearSearch = useCallback(() => {
    setSearchImmediate('')
    setDebouncedSearch('')
  }, [])

  return {
    search,
    setSearch: setSearchImmediate,
    debouncedSearch,
    clearSearch,
    hasSearch: search.length > 0,
  }
}

/**
 * Date range filter
 */
export function useDateRangeFilter(defaultDays = 30) {
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - defaultDays)
    return { start, end, days: defaultDays }
  })

  const setDays = useCallback((days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateRange({ start, end, days })
  }, [])

  const setCustomRange = useCallback((start, end) => {
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    setDateRange({ start, end, days })
  }, [])

  return {
    dateRange,
    setDays,
    setCustomRange,
    startDate: dateRange.start,
    endDate: dateRange.end,
    days: dateRange.days,
  }
}

/**
 * Tab state hook with URL sync
 */
export function useTab(defaultTab, paramName = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTabState] = useState(searchParams.get(paramName) || defaultTab)

  const setTab = useCallback((newTab) => {
    setTabState(newTab)
    const params = new URLSearchParams(searchParams)
    if (newTab === defaultTab) {
      params.delete(paramName)
    } else {
      params.set(paramName, newTab)
    }
    setSearchParams(params, { replace: true })
  }, [defaultTab, paramName, searchParams, setSearchParams])

  // Sync from URL on mount
  useEffect(() => {
    const urlTab = searchParams.get(paramName)
    if (urlTab && urlTab !== tab) {
      setTabState(urlTab)
    }
  }, []) // Only on mount

  return [tab, setTab]
}

/**
 * Pagination hook with URL sync
 */
export function usePagination(defaultPage = 1, defaultPerPage = 25) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = parseInt(searchParams.get('page') || String(defaultPage), 10)
  const perPage = parseInt(searchParams.get('perPage') || String(defaultPerPage), 10)

  const setPage = useCallback((newPage) => {
    const params = new URLSearchParams(searchParams)
    if (newPage === defaultPage) {
      params.delete('page')
    } else {
      params.set('page', String(newPage))
    }
    setSearchParams(params, { replace: true })
  }, [defaultPage, searchParams, setSearchParams])

  const setPerPage = useCallback((newPerPage) => {
    const params = new URLSearchParams(searchParams)
    params.set('perPage', String(newPerPage))
    params.delete('page') // Reset to page 1 when changing page size
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage])
  const prevPage = useCallback(() => setPage(Math.max(1, page - 1)), [page, setPage])

  return {
    page,
    perPage,
    setPage,
    setPerPage,
    nextPage,
    prevPage,
  }
}

/**
 * Sort state hook with URL sync
 */
export function useSort(defaultSortBy = 'date', defaultSortOrder = 'desc') {
  const [searchParams, setSearchParams] = useSearchParams()

  const sortBy = searchParams.get('sortBy') || defaultSortBy
  const sortOrder = searchParams.get('sortOrder') || defaultSortOrder

  const setSort = useCallback((newSortBy, newSortOrder) => {
    const params = new URLSearchParams(searchParams)

    if (newSortBy === defaultSortBy) {
      params.delete('sortBy')
    } else {
      params.set('sortBy', newSortBy)
    }

    if (newSortOrder === defaultSortOrder) {
      params.delete('sortOrder')
    } else {
      params.set('sortOrder', newSortOrder)
    }

    setSearchParams(params, { replace: true })
  }, [defaultSortBy, defaultSortOrder, searchParams, setSearchParams])

  const toggleSort = useCallback((field) => {
    if (sortBy === field) {
      setSort(field, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field, 'desc')
    }
  }, [sortBy, sortOrder, setSort])

  return {
    sortBy,
    sortOrder,
    setSort,
    toggleSort,
  }
}

export default useFilters
