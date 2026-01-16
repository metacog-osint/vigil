/**
 * Custom IOC Data Hooks
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { customIocLists, customIocs } from '../../lib/customIocs'

/**
 * Hook for managing IOC lists and data
 */
export function useIocData(userId) {
  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState(null)
  const [iocs, setIocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadLists = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await customIocLists.getAll(userId)
      setLists(data)
      if (data.length > 0 && !selectedList) {
        setSelectedList(data[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, selectedList])

  const loadIocs = useCallback(async (filters = {}) => {
    if (!selectedList) return
    setLoading(true)
    try {
      const data = await customIocs.getByList(selectedList.id, userId, filters)
      setIocs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedList, userId])

  useEffect(() => {
    if (userId) {
      loadLists()
    }
  }, [userId])

  useEffect(() => {
    if (selectedList) {
      loadIocs()
    }
  }, [selectedList])

  return {
    lists,
    setLists,
    selectedList,
    setSelectedList,
    iocs,
    setIocs,
    loading,
    error,
    setError,
    loadLists,
    loadIocs,
  }
}

/**
 * Hook for IOC filtering
 */
export function useIocFilters(iocs) {
  const [iocTypeFilter, setIocTypeFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIocs = useMemo(() => {
    return iocs.filter(ioc => {
      if (iocTypeFilter && ioc.ioc_type !== iocTypeFilter) return false
      if (severityFilter && ioc.severity !== severityFilter) return false
      if (searchQuery && !ioc.value.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [iocs, iocTypeFilter, severityFilter, searchQuery])

  return {
    iocTypeFilter,
    setIocTypeFilter,
    severityFilter,
    setSeverityFilter,
    searchQuery,
    setSearchQuery,
    filteredIocs,
  }
}

/**
 * Hook for IOC actions
 */
export function useIocActions(userId, lists, setLists, selectedList, setSelectedList, loadLists, loadIocs) {
  const handleCreateList = useCallback(async (listData) => {
    const newList = await customIocLists.create(userId, listData)
    setLists(prev => [...prev, newList])
    setSelectedList(newList)
    return newList
  }, [userId, setLists, setSelectedList])

  const handleDeleteList = useCallback(async (listId) => {
    if (!confirm('Delete this list and all its IOCs? This cannot be undone.')) return false
    await customIocLists.delete(listId, userId)
    setLists(prev => prev.filter(l => l.id !== listId))
    if (selectedList?.id === listId) {
      setSelectedList(lists[0] || null)
    }
    return true
  }, [userId, lists, selectedList, setLists, setSelectedList])

  const handleAddIoc = useCallback(async (iocData) => {
    await customIocs.add(selectedList.id, userId, iocData)
    await loadIocs()
  }, [selectedList, userId, loadIocs])

  const handleImport = useCallback(async (iocsData) => {
    const result = await customIocs.addBulk(selectedList.id, userId, iocsData)
    await loadIocs()
    await loadLists()
    return result
  }, [selectedList, userId, loadIocs, loadLists])

  const handleDeleteIocs = useCallback(async (selectedIocIds) => {
    if (selectedIocIds.length === 0) return false
    if (!confirm(`Delete ${selectedIocIds.length} IOCs? This cannot be undone.`)) return false
    await customIocs.deleteBulk(selectedIocIds, userId)
    await loadIocs()
    return true
  }, [userId, loadIocs])

  return {
    handleCreateList,
    handleDeleteList,
    handleAddIoc,
    handleImport,
    handleDeleteIocs,
  }
}
