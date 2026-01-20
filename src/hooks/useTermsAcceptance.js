/**
 * Hook for managing terms acceptance state
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import {
  hasAcceptedCurrentTerms,
  getCurrentTermsVersion,
  acceptTerms,
  CURRENT_TERMS_VERSION,
} from '../lib/terms'

/**
 * Hook to check and manage terms acceptance
 * Returns the acceptance state and functions to accept terms
 */
export function useTermsAcceptance() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [needsAcceptance, setNeedsAcceptance] = useState(false)
  const [termsVersion, setTermsVersion] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState(null)

  // Check if user needs to accept terms
  useEffect(() => {
    if (!user) {
      setLoading(false)
      setNeedsAcceptance(false)
      return
    }

    async function checkTerms() {
      try {
        setLoading(true)
        setError(null)

        // Get current version info
        const version = await getCurrentTermsVersion()
        setTermsVersion(version)

        // Check if user has accepted
        const accepted = await hasAcceptedCurrentTerms()
        setNeedsAcceptance(!accepted)
      } catch (err) {
        console.error('Error checking terms acceptance:', err)
        setError(err.message)
        // On error, don't block the user
        setNeedsAcceptance(false)
      } finally {
        setLoading(false)
      }
    }

    checkTerms()
  }, [user])

  // Accept terms function
  const handleAcceptTerms = useCallback(async () => {
    try {
      setAccepting(true)
      setError(null)

      await acceptTerms(termsVersion?.version || CURRENT_TERMS_VERSION)
      setNeedsAcceptance(false)

      return true
    } catch (err) {
      console.error('Error accepting terms:', err)
      setError(err.message)
      return false
    } finally {
      setAccepting(false)
    }
  }, [termsVersion])

  return {
    loading,
    needsAcceptance,
    termsVersion,
    accepting,
    error,
    acceptTerms: handleAcceptTerms,
  }
}

export default useTermsAcceptance
