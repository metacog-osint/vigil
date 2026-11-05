/**
 * useFilters Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import {
  useFilters,
  useSearchFilter,
  useDateRangeFilter,
  useTab,
  usePagination,
  useSort,
} from '../useFilters'

// Wrapper for hooks that use router
const RouterWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>

describe('useFilters', () => {
  describe('basic functionality', () => {
    it('should initialize with default filters', () => {
      const initialFilters = { status: 'active', search: '' }
      const { result } = renderHook(() => useFilters(initialFilters), {
        wrapper: RouterWrapper,
      })

      expect(result.current.filters).toEqual(initialFilters)
    })

    it('should set a single filter', () => {
      const { result } = renderHook(() => useFilters({ status: '', search: '' }), {
        wrapper: RouterWrapper,
      })

      act(() => {
        result.current.setFilter('status', 'active')
      })

      expect(result.current.filters.status).toBe('active')
    })

    it('should set multiple filters at once', () => {
      const { result } = renderHook(() => useFilters({ status: '', search: '', type: '' }), {
        wrapper: RouterWrapper,
      })

      act(() => {
        result.current.setFilters({ status: 'active', type: 'critical' })
      })

      expect(result.current.filters.status).toBe('active')
      expect(result.current.filters.type).toBe('critical')
      expect(result.current.filters.search).toBe('')
    })

    it('should reset filters to initial values', () => {
      const initialFilters = { status: 'all', search: '' }
      const { result } = renderHook(() => useFilters(initialFilters), {
        wrapper: RouterWrapper,
      })

      act(() => {
        result.current.setFilter('status', 'active')
        result.current.setFilter('search', 'test')
      })

      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.filters).toEqual(initialFilters)
    })

    it('should detect active filters', () => {
      const { result } = renderHook(() => useFilters({ status: '', search: '' }), {
        wrapper: RouterWrapper,
      })

      expect(result.current.hasActiveFilters).toBe(false)

      act(() => {
        result.current.setFilter('status', 'active')
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should count active filters', () => {
      const { result } = renderHook(() => useFilters({ status: '', search: '', type: '' }), {
        wrapper: RouterWrapper,
      })

      expect(result.current.activeFilterCount).toBe(0)

      act(() => {
        result.current.setFilter('status', 'active')
      })

      expect(result.current.activeFilterCount).toBe(1)

      act(() => {
        result.current.setFilter('type', 'critical')
      })

      expect(result.current.activeFilterCount).toBe(2)
    })

    it('should get filter value by key', () => {
      const { result } = renderHook(() => useFilters({ status: 'pending' }), {
        wrapper: RouterWrapper,
      })

      expect(result.current.getFilter('status')).toBe('pending')
    })
  })

  describe('callback support', () => {
    it('should call onFilterChange when filter changes', () => {
      const onFilterChange = vi.fn()
      const { result } = renderHook(() => useFilters({ status: '' }, { onFilterChange }), {
        wrapper: RouterWrapper,
      })

      act(() => {
        result.current.setFilter('status', 'active')
      })

      expect(onFilterChange).toHaveBeenCalledWith({ status: 'active' })
    })
  })

  describe('array filters', () => {
    it('should handle array filter values', () => {
      const { result } = renderHook(() => useFilters({ tags: [] }), {
        wrapper: RouterWrapper,
      })

      act(() => {
        result.current.setFilter('tags', ['critical', 'urgent'])
      })

      expect(result.current.filters.tags).toEqual(['critical', 'urgent'])
    })

    it('should detect active array filters', () => {
      const { result } = renderHook(() => useFilters({ tags: [] }), {
        wrapper: RouterWrapper,
      })

      expect(result.current.hasActiveFilters).toBe(false)

      act(() => {
        result.current.setFilter('tags', ['critical'])
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })
  })
})

describe('useSearchFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with default value', () => {
    const { result } = renderHook(() => useSearchFilter(''))

    expect(result.current.search).toBe('')
    expect(result.current.debouncedSearch).toBe('')
  })

  it('should update search immediately', () => {
    const { result } = renderHook(() => useSearchFilter(''))

    act(() => {
      result.current.setSearch('test')
    })

    expect(result.current.search).toBe('test')
  })

  it('should debounce search value', () => {
    const { result } = renderHook(() => useSearchFilter('', 300))

    act(() => {
      result.current.setSearch('test')
    })

    // Debounced value should not update immediately
    expect(result.current.debouncedSearch).toBe('')

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedSearch).toBe('test')
  })

  it('should clear search', () => {
    const { result } = renderHook(() => useSearchFilter('initial'))

    act(() => {
      result.current.setSearch('test')
      vi.advanceTimersByTime(300)
    })

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.search).toBe('')
    expect(result.current.debouncedSearch).toBe('')
  })

  it('should report hasSearch correctly', () => {
    const { result } = renderHook(() => useSearchFilter(''))

    expect(result.current.hasSearch).toBe(false)

    act(() => {
      result.current.setSearch('test')
    })

    expect(result.current.hasSearch).toBe(true)
  })
})

describe('useDateRangeFilter', () => {
  it('should initialize with default days', () => {
    const { result } = renderHook(() => useDateRangeFilter(30))

    expect(result.current.days).toBe(30)
    expect(result.current.startDate).toBeInstanceOf(Date)
    expect(result.current.endDate).toBeInstanceOf(Date)
  })

  it('should set days and update range', () => {
    // setDays steps back by calendar days in local time, so the span is measured
    // in calendar days, not hours. The clock is pinned to a week that crosses the
    // US fall-back (1 Nov 2026), where 7 days is 169 hours in US zones and a
    // ceil of the hours read 8; pinning also stops the hook's two new Date()
    // calls from landing a millisecond apart.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T18:00:00Z'))
    try {
      const { result } = renderHook(() => useDateRangeFilter(30))

      act(() => {
        result.current.setDays(7)
      })

      expect(result.current.days).toBe(7)

      const calendarDay = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000
      expect(calendarDay(result.current.endDate) - calendarDay(result.current.startDate)).toBe(7)
      expect(result.current.endDate.getTime()).toBe(Date.now())
    } finally {
      vi.useRealTimers()
    }
  })

  it('should set custom date range', () => {
    const { result } = renderHook(() => useDateRangeFilter(30))

    const start = new Date('2026-01-01')
    const end = new Date('2026-01-15')

    act(() => {
      result.current.setCustomRange(start, end)
    })

    expect(result.current.startDate).toEqual(start)
    expect(result.current.endDate).toEqual(end)
    expect(result.current.days).toBe(14)
  })
})

describe('useTab', () => {
  it('should initialize with default tab', () => {
    const { result } = renderHook(() => useTab('overview'), {
      wrapper: RouterWrapper,
    })

    expect(result.current[0]).toBe('overview')
  })

  it('should change tab', () => {
    const { result } = renderHook(() => useTab('overview'), {
      wrapper: RouterWrapper,
    })

    act(() => {
      result.current[1]('details')
    })

    expect(result.current[0]).toBe('details')
  })
})

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination(1, 25), {
      wrapper: RouterWrapper,
    })

    expect(result.current.page).toBe(1)
    expect(result.current.perPage).toBe(25)
  })

  it('should have setPage function', () => {
    const { result } = renderHook(() => usePagination(1, 25), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.setPage).toBe('function')
  })

  it('should have nextPage function', () => {
    const { result } = renderHook(() => usePagination(1, 25), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.nextPage).toBe('function')
  })

  it('should have prevPage function', () => {
    const { result } = renderHook(() => usePagination(1, 25), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.prevPage).toBe('function')
  })

  it('should have setPerPage function', () => {
    const { result } = renderHook(() => usePagination(1, 25), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.setPerPage).toBe('function')
  })
})

describe('useSort', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSort('date', 'desc'), {
      wrapper: RouterWrapper,
    })

    expect(result.current.sortBy).toBe('date')
    expect(result.current.sortOrder).toBe('desc')
  })

  it('should have setSort function', () => {
    const { result } = renderHook(() => useSort('date', 'desc'), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.setSort).toBe('function')
  })

  it('should have toggleSort function', () => {
    const { result } = renderHook(() => useSort('date', 'desc'), {
      wrapper: RouterWrapper,
    })

    expect(typeof result.current.toggleSort).toBe('function')
  })
})
