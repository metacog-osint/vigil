/**
 * Investigation Data Hooks
 */
import { useState, useEffect, useCallback } from 'react'
import { investigations } from '../../lib/investigations'

/**
 * Main hook for investigation data loading
 */
export function useInvestigationData(userId, hasAccess, filters) {
  const [investigationList, setInvestigationList] = useState([])
  const [selectedInvestigation, setSelectedInvestigation] = useState(null)
  const [templates, setTemplates] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [list, templateList, statsData] = await Promise.all([
        investigations.getAll(userId, filters),
        investigations.getTemplates(),
        investigations.getStats(userId),
      ])
      setInvestigationList(list)
      setTemplates(templateList)
      setStats(statsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, hasAccess, filters])

  const loadInvestigation = useCallback(
    async (id) => {
      try {
        const inv = await investigations.getById(id, userId)
        setSelectedInvestigation(inv)
      } catch (err) {
        setError(err.message)
      }
    },
    [userId]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    investigationList,
    setInvestigationList,
    selectedInvestigation,
    setSelectedInvestigation,
    templates,
    stats,
    loading,
    error,
    setError,
    loadData,
    loadInvestigation,
  }
}

/**
 * Hook for investigation actions
 */
export function useInvestigationActions(
  userId,
  investigationList,
  setInvestigationList,
  selectedInvestigation,
  setSelectedInvestigation,
  loadData,
  loadInvestigation
) {
  const handleCreate = useCallback(
    async (data) => {
      const newInv = await investigations.create(userId, data)
      setInvestigationList([newInv, ...investigationList])
      setSelectedInvestigation(newInv)
      loadInvestigation(newInv.id)
      return newInv
    },
    [userId, investigationList, setInvestigationList, setSelectedInvestigation, loadInvestigation]
  )

  const handleUpdateStatus = useCallback(
    async (id, status) => {
      await investigations.update(id, userId, { status })
      loadData()
      if (selectedInvestigation?.id === id) {
        loadInvestigation(id)
      }
    },
    [userId, selectedInvestigation, loadData, loadInvestigation]
  )

  const handleDelete = useCallback(
    async (id) => {
      if (!confirm('Delete this investigation and all its entries?')) return false
      await investigations.delete(id, userId)
      setInvestigationList(investigationList.filter((i) => i.id !== id))
      if (selectedInvestigation?.id === id) {
        setSelectedInvestigation(null)
      }
      return true
    },
    [
      userId,
      investigationList,
      setInvestigationList,
      selectedInvestigation,
      setSelectedInvestigation,
    ]
  )

  return {
    handleCreate,
    handleUpdateStatus,
    handleDelete,
  }
}
