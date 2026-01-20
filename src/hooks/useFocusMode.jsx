/**
 * useFocusMode Hook
 *
 * Global focus mode state management.
 * When enabled, filters all data views to show only items relevant to the user's organization.
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { orgProfile } from '../lib/supabase'
import { buildFocusFilters, getFilterDescription } from '../lib/focusFilters'

const STORAGE_KEY = 'vigil_focus_mode'

// Create context
const FocusModeContext = createContext({
  enabled: false,
  profile: null,
  filters: null,
  filterDescription: null,
  toggle: () => {},
  enable: () => {},
  disable: () => {},
  isLoading: true,
})

/**
 * Focus Mode Provider Component
 */
export function FocusModeProvider({ children }) {
  const [enabled, setEnabled] = useState(false)
  const [profile, setProfile] = useState(null)
  const [filters, setFilters] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load profile and saved state on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load saved enabled state
        const savedEnabled = localStorage.getItem(STORAGE_KEY) === 'true'

        // Load org profile
        const userProfile = await orgProfile.get()
        setProfile(userProfile)

        // Only enable focus mode if profile exists and has sector
        if (userProfile?.sector && savedEnabled) {
          setEnabled(true)
          setFilters(buildFocusFilters(userProfile))
        }
      } catch (error) {
        console.error('Error loading focus mode data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Update filters when profile changes
  useEffect(() => {
    if (enabled && profile) {
      setFilters(buildFocusFilters(profile))
    } else {
      setFilters(null)
    }
  }, [enabled, profile])

  // Save enabled state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled.toString())
  }, [enabled])

  const toggle = useCallback(() => {
    if (!profile?.sector) {
      console.warn('Cannot enable focus mode without organization profile')
      return
    }
    setEnabled((prev) => !prev)
  }, [profile])

  const enable = useCallback(() => {
    if (profile?.sector) {
      setEnabled(true)
    }
  }, [profile])

  const disable = useCallback(() => {
    setEnabled(false)
  }, [])

  // Refresh profile (call after profile update)
  const refreshProfile = useCallback(async () => {
    try {
      const userProfile = await orgProfile.get()
      setProfile(userProfile)
      if (enabled && userProfile) {
        setFilters(buildFocusFilters(userProfile))
      }
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }, [enabled])

  const value = {
    enabled,
    profile,
    filters,
    filterDescription: enabled ? getFilterDescription(profile) : null,
    toggle,
    enable,
    disable,
    refreshProfile,
    isLoading,
    hasProfile: !!profile?.sector,
  }

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
}

/**
 * Hook to access focus mode state
 */
export function useFocusMode() {
  const context = useContext(FocusModeContext)
  if (!context) {
    throw new Error('useFocusMode must be used within a FocusModeProvider')
  }
  return context
}

export default useFocusMode
