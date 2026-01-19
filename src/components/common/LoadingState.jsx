/**
 * LoadingState - Standardized loading state wrapper
 *
 * Provides consistent loading, error, and empty state handling
 * across all data-fetching components.
 *
 * Usage:
 * <LoadingState
 *   loading={isLoading}
 *   error={error}
 *   data={data}
 *   skeleton={<SkeletonTable />}
 * >
 *   <YourContent data={data} />
 * </LoadingState>
 */

import { clsx } from 'clsx'
import {
  Skeleton,
  SkeletonTable,
  SkeletonList,
  SkeletonStats,
  SkeletonCard,
  SkeletonPage,
} from './Skeleton'

// Empty state component
function EmptyState({ message, icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon || (
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-400 mb-2">No data found</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        {message || 'There are no items to display at the moment.'}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Error state component
function ErrorState({ error, onRetry }) {
  const message = error?.message || 'An error occurred while loading data.'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">Failed to load</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-cyber-accent/20 text-cyber-accent rounded-lg hover:bg-cyber-accent/30 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

// Inline spinner for compact loading states
function InlineSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div
      className={clsx(
        'animate-spin border-2 border-cyber-accent border-t-transparent rounded-full',
        sizes[size],
        className
      )}
    />
  )
}

// Full page loading spinner
function FullPageLoader({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <InlineSpinner size="lg" className="mb-4" />
      <div className="text-gray-400 text-sm">{message}</div>
    </div>
  )
}

// Main LoadingState component
export function LoadingState({
  loading = false,
  error = null,
  data = null,
  children,
  skeleton,
  skeletonType = 'table',
  emptyMessage,
  emptyIcon,
  emptyAction,
  onRetry,
  minHeight = false,
  className = '',
}) {
  // Show skeleton while loading
  if (loading) {
    if (skeleton) {
      return <div className={className}>{skeleton}</div>
    }

    // Default skeletons based on type
    const skeletons = {
      table: <SkeletonTable rows={5} cols={4} />,
      list: <SkeletonList items={5} />,
      stats: <SkeletonStats count={4} />,
      card: <SkeletonCard />,
      page: <SkeletonPage />,
      inline: (
        <div className="flex items-center justify-center py-8">
          <InlineSpinner />
        </div>
      ),
      full: <FullPageLoader />,
    }

    return <div className={className}>{skeletons[skeletonType] || skeletons.table}</div>
  }

  // Show error state
  if (error) {
    return (
      <div className={clsx(className, minHeight && 'min-h-[200px] flex items-center justify-center')}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    )
  }

  // Check for empty data
  const isEmpty = data === null || data === undefined ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0)

  if (isEmpty) {
    return (
      <div className={clsx(className, minHeight && 'min-h-[200px] flex items-center justify-center')}>
        <EmptyState message={emptyMessage} icon={emptyIcon} action={emptyAction} />
      </div>
    )
  }

  // Render children
  return <div className={className}>{children}</div>
}

// Convenience exports
export { EmptyState, ErrorState, InlineSpinner, FullPageLoader }

// Hook for managing loading state
export function useLoadingState(initialLoading = true) {
  const [state, setState] = React.useState({
    loading: initialLoading,
    error: null,
    data: null,
  })

  const setLoading = (loading) => setState((prev) => ({ ...prev, loading }))
  const setError = (error) => setState((prev) => ({ ...prev, error, loading: false }))
  const setData = (data) => setState((prev) => ({ ...prev, data, loading: false, error: null }))
  const reset = () => setState({ loading: true, error: null, data: null })

  return {
    ...state,
    setLoading,
    setError,
    setData,
    reset,
  }
}

import React from 'react'

export default LoadingState
