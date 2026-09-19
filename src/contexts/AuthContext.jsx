/**
 * Auth Context
 *
 * Provides a single source of truth for authentication state throughout the app.
 * This prevents race conditions where different components might see different
 * auth states when using independent useState hooks.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load user profile from user_preferences table
  const loadProfile = useCallback(async (userId) => {
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
  }, [])

  // Clear session data from storage
  const clearSessionData = useCallback(() => {
    try {
      localStorage.removeItem('vigil_auth_user')
      localStorage.removeItem('vigil_push_subscription')
      sessionStorage.removeItem('vigil_auth_token')
      sessionStorage.removeItem('vigil_session_id')
      sessionStorage.removeItem('vigil_last_activity')
    } catch {
      // Ignore storage errors
    }
  }, [])

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous. supabase-js runs it while holding its auth
      // lock, so awaiting another Supabase call here (loadProfile) deadlocks every
      // query on the page after a token refresh. Defer it until the lock is released.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        if (session?.user) {
          const userId = session.user.id
          setTimeout(() => loadProfile(userId), 0)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        clearSessionData()
      } else if (event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadProfile, clearSessionData])

  const value = {
    user,
    profile,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}

export default AuthContext
