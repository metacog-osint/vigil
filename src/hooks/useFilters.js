// URL-based filters hook for shareable filter state
import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'

export function useFilters(defaultFilters = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse current filters from URL
  const filters = useMemo(() => {
    const parsed = { ...defaultFilters }

    for (const [key, defaultValue] of Object.entries(defaultFilters)) {
      const urlValue = searchParams.get(key)

      if (urlValue !== null) {
        // Type coercion based on default value type
        if (typeof defaultValue === 'number') {
          parsed[key] = parseInt(urlValue, 10) || defaultValue
        } else if (typeof defaultValue === 'boolean') {
          parsed[key] = urlValue === 'true'
        } else if (Array.isArray(defaultValue)) {
          parsed[key] = urlValue.split(',').filter(Boolean)
        } else {
          parsed[key] = urlValue
        }
      }
    }

    return parsed
  }, [searchParams, defaultFilters])

  // Update a single filter
  const setFilter = useCallback(
    (key, value) => {
      const newParams = new URLSearchParams(searchParams)

      // Remove if value matches default or is empty
      if (
        value === defaultFilters[key] ||
        value === '' ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
      ) {
        newParams.delete(key)
      } else {
        // Stringify arrays
        const stringValue = Array.isArray(value) ? value.join(',') : String(value)
        newParams.set(key, stringValue)
      }

      setSearchParams(newParams, { replace: true })
    },
    [searchParams, setSearchParams, defaultFilters]
  )

  // Update multiple filters at once
  const setFilters = useCallback(
    (newFilters) => {
      const newParams = new URLSearchParams(searchParams)

      for (const [key, value] of Object.entries(newFilters)) {
        if (
          value === defaultFilters[key] ||
          value === '' ||
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newParams.delete(key)
        } else {
          const stringValue = Array.isArray(value) ? value.join(',') : String(value)
          newParams.set(key, stringValue)
        }
      }

      setSearchParams(newParams, { replace: true })
    },
    [searchParams, setSearchParams, defaultFilters]
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.keys(defaultFilters).some(key => searchParams.has(key))
  }, [searchParams, defaultFilters])

  // Get URL string for sharing
  const getShareableUrl = useCallback(() => {
    return `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`
  }, [searchParams])

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
    getShareableUrl,
  }
}

// Filter presets
export const FILTER_PRESETS = {
  criticalCVEs: {
    name: 'Critical CVEs',
    description: 'CVEs with CVSS 9.0+',
    filters: { severity: 'critical' },
  },
  ransomwareCVEs: {
    name: 'Ransomware CVEs',
    description: 'CVEs used in ransomware campaigns',
    filters: { ransomware: 'true' },
  },
  recentIncidents: {
    name: 'Recent Incidents',
    description: 'Incidents in the last 7 days',
    filters: { days: 7 },
  },
  escalatingActors: {
    name: 'Escalating Actors',
    description: 'Actors with increasing activity',
    filters: { trend: 'ESCALATING' },
  },
  healthcareSector: {
    name: 'Healthcare',
    description: 'Healthcare sector incidents',
    filters: { sector: 'healthcare' },
  },
}

export default useFilters
