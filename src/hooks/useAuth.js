/**
 * Authentication Hook
 *
 * Provides Supabase authentication state throughout the app.
 * Consumes the AuthContext to ensure all components see the same auth state.
 *
 * IMPORTANT: This hook must be used within an AuthProvider.
 * The AuthProvider handles session recovery and auth state changes.
 */

import { useAuthContext } from '../contexts/AuthContext'

export function useAuth() {
  return useAuthContext()
}

export default useAuth
