/**
 * Hook for session management with idle/absolute timeouts
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import {
  initSessionManager,
  destroySessionManager,
  getSessionTimeRemaining,
  extendSession,
  SESSION_CONFIG,
} from '../lib/sessionManager'

/**
 * Hook to manage user session with timeouts
 */
export function useSessionManager() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [warningInfo, setWarningInfo] = useState(null)
  const [timeoutReason, setTimeoutReason] = useState(null)

  // Handle session timeout
  const handleTimeout = useCallback(
    ({ reason }) => {
      setTimeoutReason(reason)

      // Navigate to auth page with timeout message
      const messages = {
        idle: 'Your session expired due to inactivity.',
        absolute: 'Your session has expired. Please sign in again.',
        cross_tab: 'You were signed out from another tab.',
        manual: 'You have been signed out.',
      }

      navigate('/auth', {
        state: {
          message: messages[reason] || 'Your session has expired.',
          type: 'session_expired',
        },
        replace: true,
      })
    },
    [navigate]
  )

  // Handle warning before timeout
  const handleWarning = useCallback(({ minutes, type }) => {
    setWarningInfo({ minutes, type })
    setShowWarning(true)
  }, [])

  // Extend session (dismiss warning and reset timer)
  const handleExtendSession = useCallback(() => {
    extendSession()
    setShowWarning(false)
    setWarningInfo(null)
  }, [])

  // Initialize session manager when user is logged in
  useEffect(() => {
    if (!user) {
      destroySessionManager()
      return
    }

    initSessionManager({
      onTimeout: handleTimeout,
      onWarning: handleWarning,
    })

    return () => {
      destroySessionManager()
    }
  }, [user, handleTimeout, handleWarning])

  return {
    showWarning,
    warningInfo,
    timeoutReason,
    extendSession: handleExtendSession,
    dismissWarning: () => setShowWarning(false),
    getTimeRemaining: getSessionTimeRemaining,
    config: SESSION_CONFIG,
  }
}

export default useSessionManager
