/**
 * useDataLoading Hook
 * Standardized data fetching with loading, error, and refresh states
 */

import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Data loading hook with error handling and caching
 * @param {Function} fetchFn - Async function that returns data
 * @param {Object} options - Configuration options
 * @param {Array} options.deps - Dependencies that trigger refetch
 * @param {boolean} options.immediate - Fetch immediately on mount (default: true)
 * @param {number} options.cacheTime - Cache time in ms (default: 0, no cache)
 * @param {Function} options.onSuccess - Callback on successful fetch
 * @param {Function} options.onError - Callback on error
 * @param {*} options.initialData - Initial data value
 * @returns {Object} Loading state and data
 */
export function useDataLoading(fetchFn, options = {}) {
  const {
    deps = [],
    immediate = true,
    cacheTime = 0,
    onSuccess,
    onError,
    initialData = null,
  } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const [lastFetchedAt, setLastFetchedAt] = useState(null)

  const cacheRef = useRef({ data: null, timestamp: 0 })
  const abortControllerRef = useRef(null)

  const fetchData = useCallback(async (ignoreCache = false) => {
    // Check cache
    if (!ignoreCache && cacheTime > 0 && cacheRef.current.data) {
      const cacheAge = Date.now() - cacheRef.current.timestamp
      if (cacheAge < cacheTime) {
        setData(cacheRef.current.data)
        return cacheRef.current.data
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn({ signal: abortControllerRef.current.signal })

      setData(result)
      setLastFetchedAt(new Date())

      // Update cache
      if (cacheTime > 0) {
        cacheRef.current = { data: result, timestamp: Date.now() }
      }

      onSuccess?.(result)
      return result
    } catch (err) {
      if (err.name === 'AbortError') return

      setError(err.message || 'An error occurred')
      onError?.(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchFn, cacheTime, onSuccess, onError])

  // Refresh without cache
  const refresh = useCallback(() => fetchData(true), [fetchData])

  // Initial fetch and refetch on deps change
  useEffect(() => {
    if (immediate) {
      fetchData()
    }

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [...deps, immediate]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    setData,
    loading,
    error,
    refresh,
    lastFetchedAt,
    isStale: cacheTime > 0 && lastFetchedAt && (Date.now() - lastFetchedAt.getTime() > cacheTime),
  }
}

/**
 * Paginated data loading hook
 * @param {Function} fetchFn - Async function that accepts { page, limit } and returns { data, total, hasMore }
 * @param {Object} options - Configuration options
 */
export function usePaginatedData(fetchFn, options = {}) {
  const {
    deps = [],
    limit = 50,
    initialPage = 1,
    onSuccess,
    onError,
  } = options

  const [data, setData] = useState([])
  const [page, setPage] = useState(initialPage)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const fetchPage = useCallback(async (pageNum, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setPage(pageNum)
    }
    setError(null)

    try {
      const result = await fetchFn({ page: pageNum, limit })

      if (append) {
        setData((prev) => [...prev, ...result.data])
      } else {
        setData(result.data)
      }

      setTotalCount(result.total || result.data.length)
      setHasMore(result.hasMore ?? result.data.length === limit)
      setPage(pageNum)

      onSuccess?.(result)
      return result
    } catch (err) {
      setError(err.message || 'An error occurred')
      onError?.(err)
      throw err
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [fetchFn, limit, onSuccess, onError])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      return fetchPage(page + 1, true)
    }
  }, [fetchPage, page, loadingMore, hasMore])

  const refresh = useCallback(() => fetchPage(1, false), [fetchPage])

  // Initial fetch and refetch on deps change
  useEffect(() => {
    fetchPage(initialPage, false)
  }, [...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    setData,
    page,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
    goToPage: (p) => fetchPage(p, false),
  }
}

/**
 * Infinite scroll data loading hook
 * @param {Function} fetchFn - Async function that accepts cursor and returns { data, nextCursor }
 * @param {Object} options - Configuration options
 */
export function useInfiniteData(fetchFn, options = {}) {
  const {
    deps = [],
    limit = 50,
    onSuccess,
    onError,
  } = options

  const [data, setData] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (cursorValue, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const result = await fetchFn({ cursor: cursorValue, limit })

      if (append) {
        setData((prev) => [...prev, ...result.data])
      } else {
        setData(result.data)
      }

      setCursor(result.nextCursor)
      setHasMore(!!result.nextCursor)

      onSuccess?.(result)
      return result
    } catch (err) {
      setError(err.message || 'An error occurred')
      onError?.(err)
      throw err
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [fetchFn, limit, onSuccess, onError])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && cursor) {
      return fetchData(cursor, true)
    }
  }, [fetchData, cursor, loadingMore, hasMore])

  const refresh = useCallback(() => {
    setCursor(null)
    return fetchData(null, false)
  }, [fetchData])

  // Initial fetch and refetch on deps change
  useEffect(() => {
    fetchData(null, false)
  }, [...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    setData,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  }
}

export default useDataLoading
