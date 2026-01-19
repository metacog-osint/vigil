/**
 * useLastVisit Hook
 *
 * Tracks user's last visit timestamp for "What's New" feature.
 * Uses localStorage for persistence, with optional Supabase sync for logged-in users.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'vigil_last_visit'
const VISIT_HISTORY_KEY = 'vigil_visit_history'
const MAX_HISTORY = 10

export function useLastVisit() {
  const { user } = useAuth()
  const [lastVisit, setLastVisit] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load last visit on mount
  useEffect(() => {
    const loadLastVisit = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          setLastVisit(new Date(stored))
        } else {
          // First visit - set to 24 hours ago so they see some "new" content
          setLastVisit(new Date(Date.now() - 24 * 60 * 60 * 1000))
        }
      } catch (error) {
        console.error('Error loading last visit:', error)
        setLastVisit(new Date(Date.now() - 24 * 60 * 60 * 1000))
      }
      setIsLoading(false)
    }

    loadLastVisit()
  }, [])

  // Update last visit time
  const updateLastVisit = useCallback(() => {
    const now = new Date()

    try {
      // Update current visit
      localStorage.setItem(STORAGE_KEY, now.toISOString())

      // Add to visit history
      const historyStr = localStorage.getItem(VISIT_HISTORY_KEY)
      const history = historyStr ? JSON.parse(historyStr) : []
      history.unshift(now.toISOString())
      localStorage.setItem(
        VISIT_HISTORY_KEY,
        JSON.stringify(history.slice(0, MAX_HISTORY))
      )

      setLastVisit(now)
    } catch (error) {
      console.error('Error updating last visit:', error)
    }
  }, [])

  // Get formatted time since last visit
  const getTimeSinceLastVisit = useCallback(() => {
    if (!lastVisit) return null

    const now = new Date()
    const diffMs = now - lastVisit
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return lastVisit.toLocaleDateString()
  }, [lastVisit])

  // Get visit history
  const getVisitHistory = useCallback(() => {
    try {
      const historyStr = localStorage.getItem(VISIT_HISTORY_KEY)
      return historyStr ? JSON.parse(historyStr).map(d => new Date(d)) : []
    } catch {
      return []
    }
  }, [])

  return {
    lastVisit,
    isLoading,
    updateLastVisit,
    getTimeSinceLastVisit,
    getVisitHistory,
  }
}

export default useLastVisit
