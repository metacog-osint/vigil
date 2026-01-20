/**
 * useTableState Hook
 * Standardized table state management for sorting, selection, and pagination
 */

import { useState, useCallback, useMemo } from 'react'

/**
 * Table state management hook
 * @param {Array} data - Array of items to manage
 * @param {Object} options - Configuration options
 * @param {string} options.idField - Field to use as unique identifier (default: 'id')
 * @param {Object} options.defaultSort - Initial sort { field, direction }
 * @param {number} options.pageSize - Items per page (0 for no pagination)
 * @returns {Object} Table state and handlers
 */
export function useTableState(data = [], options = {}) {
  const { idField = 'id', defaultSort = null, pageSize = 0 } = options

  // Sorting state
  const [sortConfig, setSortConfig] = useState(defaultSort)

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig?.field || !data.length) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.field]
      const bVal = b[sortConfig.field]

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1
      if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1

      // Handle different types
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime()
      }

      // String comparison
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sortConfig])

  // Pagination logic
  const paginatedData = useMemo(() => {
    if (pageSize <= 0) return sortedData

    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const totalPages = useMemo(() => {
    if (pageSize <= 0) return 1
    return Math.ceil(sortedData.length / pageSize)
  }, [sortedData.length, pageSize])

  // Sort handler
  const handleSort = useCallback((field) => {
    setSortConfig((prev) => {
      if (prev?.field !== field) {
        return { field, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { field, direction: 'desc' }
      }
      return null // Remove sorting
    })
  }, [])

  // Selection handlers
  const handleSelectOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const currentPageIds = paginatedData.map((item) => item[idField])
      const allSelected = currentPageIds.every((id) => prev.has(id))

      if (allSelected) {
        // Deselect all on current page
        const next = new Set(prev)
        currentPageIds.forEach((id) => next.delete(id))
        return next
      } else {
        // Select all on current page
        const next = new Set(prev)
        currentPageIds.forEach((id) => next.add(id))
        return next
      }
    })
  }, [paginatedData, idField])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Check if item is selected
  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds])

  // Check if all on current page are selected
  const isAllSelected = useMemo(() => {
    if (paginatedData.length === 0) return false
    return paginatedData.every((item) => selectedIds.has(item[idField]))
  }, [paginatedData, selectedIds, idField])

  const isSomeSelected = useMemo(() => {
    return paginatedData.some((item) => selectedIds.has(item[idField]))
  }, [paginatedData, selectedIds, idField])

  // Get selected items
  const selectedItems = useMemo(() => {
    return data.filter((item) => selectedIds.has(item[idField]))
  }, [data, selectedIds, idField])

  // Pagination handlers
  const goToPage = useCallback(
    (page) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }, [])

  // Reset pagination when data changes significantly
  const resetPagination = useCallback(() => {
    setCurrentPage(1)
  }, [])

  return {
    // Data
    sortedData,
    paginatedData,
    displayData: paginatedData, // Alias for convenience

    // Sorting
    sortConfig,
    setSortConfig,
    handleSort,
    getSortDirection: (field) => (sortConfig?.field === field ? sortConfig.direction : null),

    // Selection
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
    hasSelection: selectedIds.size > 0,

    // Pagination
    currentPage,
    totalPages,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    resetPagination,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    startIndex: pageSize > 0 ? (currentPage - 1) * pageSize + 1 : 1,
    endIndex:
      pageSize > 0 ? Math.min(currentPage * pageSize, sortedData.length) : sortedData.length,
    totalItems: sortedData.length,
  }
}

/**
 * Keyboard navigation hook for tables
 * @param {Object} tableState - State from useTableState
 * @param {Object} options - Configuration options
 */
export function useTableKeyboard(tableState, options = {}) {
  const { onSelect, onOpen, onEscape } = options

  const [focusedIndex, setFocusedIndex] = useState(-1)

  const handleKeyDown = useCallback(
    (event) => {
      // Don't handle if user is typing in an input
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'SELECT' ||
        event.target.tagName === 'TEXTAREA'
      ) {
        return
      }

      const { displayData, handleSelectOne, selectedIds } = tableState

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, displayData.length - 1))
          break

        case 'ArrowUp':
          event.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break

        case 'Enter':
          if (focusedIndex >= 0 && displayData[focusedIndex]) {
            event.preventDefault()
            onOpen?.(displayData[focusedIndex])
          }
          break

        case ' ':
          if (focusedIndex >= 0 && displayData[focusedIndex]) {
            event.preventDefault()
            const id = displayData[focusedIndex].id
            handleSelectOne(id)
            onSelect?.(displayData[focusedIndex], !selectedIds.has(id))
          }
          break

        case 'Escape':
          event.preventDefault()
          setFocusedIndex(-1)
          onEscape?.()
          break

        case 'Home':
          event.preventDefault()
          setFocusedIndex(0)
          break

        case 'End':
          event.preventDefault()
          setFocusedIndex(displayData.length - 1)
          break

        default:
          break
      }
    },
    [tableState, focusedIndex, onSelect, onOpen, onEscape]
  )

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    isFocused: (index) => focusedIndex === index,
  }
}

/**
 * Column resize hook for tables
 */
export function useColumnResize(initialWidths = {}) {
  const [columnWidths, setColumnWidths] = useState(initialWidths)

  const handleResize = useCallback((columnId, width) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: Math.max(50, width), // Minimum 50px
    }))
  }, [])

  const resetWidths = useCallback(() => {
    setColumnWidths(initialWidths)
  }, [initialWidths])

  return {
    columnWidths,
    handleResize,
    resetWidths,
    getWidth: (columnId) => columnWidths[columnId] || 'auto',
  }
}

export default useTableState
