/**
 * Settings Data Hooks
 */
import { useState, useEffect, useCallback } from 'react'
import {
  userPreferences as prefsApi,
  savedSearches as searchesApi,
  tags as tagsApi,
  syncLog as syncLogApi,
  orgProfile as orgProfileApi,
} from '../../lib/supabase'
import { getUserSubscription } from '../../lib/stripe'

export function useSettingsData(user) {
  const [preferences, setPreferences] = useState(null)
  const [savedSearches, setSavedSearches] = useState([])
  const [tags, setTags] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [orgProfile, setOrgProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [prefsResult, searchesResult, tagsResult, syncResult, profileResult] =
        await Promise.all([
          prefsApi.get(),
          searchesApi.getAll(),
          tagsApi.getAll(),
          syncLogApi.getRecent(10),
          orgProfileApi.get(),
        ])

      setPreferences(prefsResult.data?.preferences || {})
      setSavedSearches(searchesResult.data || [])
      setTags(tagsResult.data || [])
      setSyncLogs(syncResult.data || [])
      setOrgProfile(profileResult || null)

      if (user?.id) {
        const sub = await getUserSubscription(user.id)
        setSubscription(sub)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    preferences,
    setPreferences,
    savedSearches,
    setSavedSearches,
    tags,
    setTags,
    syncLogs,
    orgProfile,
    setOrgProfile,
    subscription,
    isLoading,
    error,
    setError,
    isSaving,
    setIsSaving,
    loadData,
  }
}

export function useSettingsActions({
  preferences,
  setPreferences,
  savedSearches,
  setSavedSearches,
  tags,
  setTags,
  setOrgProfile,
  setError,
  setIsSaving,
}) {
  const updatePreference = useCallback(
    async (key, value) => {
      const updated = { ...preferences, [key]: value }
      setPreferences(updated)
      setIsSaving(true)
      try {
        await prefsApi.update('anonymous', updated)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsSaving(false)
      }
    },
    [preferences, setPreferences, setError, setIsSaving]
  )

  const saveOrgProfile = useCallback(
    async (profile) => {
      setIsSaving(true)
      try {
        await orgProfileApi.update(profile)
        setOrgProfile(profile)
        return true
      } catch (err) {
        setError(err.message)
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [setOrgProfile, setError, setIsSaving]
  )

  const deleteSavedSearch = useCallback(
    async (id) => {
      const { error } = await searchesApi.delete(id)
      if (error) {
        setError(error.message)
        return
      }
      setSavedSearches(savedSearches.filter((s) => s.id !== id))
    },
    [savedSearches, setSavedSearches, setError]
  )

  const createTag = useCallback(
    async (tag) => {
      const { data, error } = await tagsApi.create(tag)
      if (error) {
        setError(error.message)
        return
      }
      setTags([...tags, data])
    },
    [tags, setTags, setError]
  )

  const deleteTag = useCallback(
    async (id) => {
      const { error } = await tagsApi.delete(id)
      if (error) {
        setError(error.message)
        return
      }
      setTags(tags.filter((t) => t.id !== id))
    },
    [tags, setTags, setError]
  )

  return {
    updatePreference,
    saveOrgProfile,
    deleteSavedSearch,
    createTag,
    deleteTag,
  }
}
