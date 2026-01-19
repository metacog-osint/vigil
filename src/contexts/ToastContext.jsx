/**
 * Toast Notification Context
 *
 * Provides a unified toast notification system for the entire app.
 * Supports success, error, warning, and info toast types.
 */

import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

const ToastContext = createContext(null)

// Toast icons
const icons = {
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  copy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  ),
}

// Toast type styles
const typeStyles = {
  success: {
    container: 'bg-green-900/90 border-green-500/50',
    icon: 'text-green-400',
  },
  error: {
    container: 'bg-red-900/90 border-red-500/50',
    icon: 'text-red-400',
  },
  warning: {
    container: 'bg-yellow-900/90 border-yellow-500/50',
    icon: 'text-yellow-400',
  },
  info: {
    container: 'bg-cyan-900/90 border-cyan-500/50',
    icon: 'text-cyan-400',
  },
  copy: {
    container: 'bg-purple-900/90 border-purple-500/50',
    icon: 'text-purple-400',
  },
}

// Single Toast component
function Toast({ toast, onDismiss }) {
  const styles = typeStyles[toast.type] || typeStyles.info
  const icon = icons[toast.type] || icons.info

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        'transform transition-all duration-300 ease-out',
        'animate-in slide-in-from-right-full',
        styles.container
      )}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon}>{icon}</span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-medium text-white text-sm">{toast.title}</div>
        )}
        <div className={clsx('text-sm', toast.title ? 'text-gray-300' : 'text-white')}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-white transition-colors p-1"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Toast container component
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  )
}

// Provider component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      type: 'info',
      duration: 4000,
      ...toast,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, newToast.duration)
    }

    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const success = useCallback((message, options = {}) => {
    return addToast({ type: 'success', message, ...options })
  }, [addToast])

  const error = useCallback((message, options = {}) => {
    return addToast({ type: 'error', message, duration: 6000, ...options })
  }, [addToast])

  const warning = useCallback((message, options = {}) => {
    return addToast({ type: 'warning', message, ...options })
  }, [addToast])

  const info = useCallback((message, options = {}) => {
    return addToast({ type: 'info', message, ...options })
  }, [addToast])

  const copy = useCallback((message = 'Copied to clipboard', options = {}) => {
    return addToast({ type: 'copy', message, duration: 2000, ...options })
  }, [addToast])

  const value = {
    toasts,
    addToast,
    dismissToast,
    dismissAll,
    success,
    error,
    warning,
    info,
    copy,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastContext
