/**
 * Authentication Hook
 *
 * Provides Supabase authentication state throughout the app.
 * Listens to auth state changes and handles session recovery from URL tokens.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        // This also handles URL tokens from email verification/magic links
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error.message)
        }

        if (session?.user) {
          setUser(session.user)
          // Load user profile in background (don't block auth loading)
          loadProfile(session.user.id)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    // Safety timeout - ensure loading never hangs forever
    const safetyTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    initAuth().finally(() => {
      clearTimeout(safetyTimeout)
    })

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        // Clear any cached data on sign out
        clearSessionData()
      } else if (event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load user profile from user_preferences table
  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle() // Returns null instead of error when no rows

      if (error) {
        // Ignore 404 table not found errors
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading profile:', error.message)
        }
        setProfile(null)
        return
      }

      setProfile(data?.preferences?.org_profile || null)
    } catch (error) {
      console.error('Profile loading error:', error)
      setProfile(null)
    }
  }

  // Clear session data from storage
  const clearSessionData = () => {
    try {
      localStorage.removeItem('vigil_auth_user')
      localStorage.removeItem('vigil_push_subscription')
      sessionStorage.removeItem('vigil_auth_token')
      sessionStorage.removeItem('vigil_session_id')
      sessionStorage.removeItem('vigil_last_activity')
    } catch {
      // Ignore storage errors
    }
  }

  return { user, profile, loading }
}

export default useAuth
