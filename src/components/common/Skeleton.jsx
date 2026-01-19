// Loading skeleton components for perceived performance
import { clsx } from 'clsx'

// Base skeleton with shimmer effect
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] rounded',
        className
      )}
      {...props}
    />
  )
}

export function SkeletonLine({ width = '100%', height = '1rem', className = '' }) {
  return (
    <Skeleton
      className={className}
      style={{ width, height }}
    />
  )
}

// Avatar skeleton
export function SkeletonAvatar({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }
  return <Skeleton className={clsx('rounded-full', sizes[size], className)} />
}

// Badge skeleton
export function SkeletonBadge({ className = '' }) {
  return <Skeleton className={clsx('h-5 w-16 rounded-full', className)} />
}

// Button skeleton
export function SkeletonButton({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  }
  return <Skeleton className={clsx('rounded-lg', sizes[size], className)} />
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`cyber-card animate-pulse ${className}`}>
      <div className="space-y-3">
        <SkeletonLine width="60%" height="1.5rem" />
        <SkeletonLine width="80%" />
        <SkeletonLine width="40%" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-gray-800/50 rounded">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${100 / cols}%`} height="1rem" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3 bg-gray-900/50 rounded">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <SkeletonLine
              key={colIndex}
              width={`${100 / cols}%`}
              height="1rem"
              className="opacity-70"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cyber-card animate-pulse">
          <SkeletonLine width="3rem" height="2rem" className="mb-2" />
          <SkeletonLine width="70%" height="0.875rem" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ items = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="cyber-card animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <SkeletonLine width="50%" height="1rem" />
              <SkeletonLine width="30%" height="0.75rem" />
            </div>
            <SkeletonLine width="4rem" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <SkeletonLine width="200px" height="2rem" className="mb-2" />
        <SkeletonLine width="300px" height="1rem" />
      </div>

      {/* Stats */}
      <SkeletonStats count={4} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 cyber-card">
          <SkeletonLine width="150px" height="1.25rem" className="mb-4" />
          <SkeletonLine width="100%" height="200px" />
        </div>
        <div className="cyber-card">
          <SkeletonLine width="120px" height="1.25rem" className="mb-4" />
          <SkeletonList items={5} />
        </div>
      </div>
    </div>
  )
}

// Chart skeleton
export function SkeletonChart({ height = 'h-64', className = '' }) {
  return (
    <div className={clsx('cyber-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine width="120px" height="1.25rem" />
        <div className="flex gap-2">
          <SkeletonButton size="sm" />
          <SkeletonButton size="sm" />
        </div>
      </div>
      <Skeleton className={clsx('w-full', height)} />
    </div>
  )
}

// Detail panel skeleton (for side panels)
export function SkeletonDetailPanel({ className = '' }) {
  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <SkeletonAvatar size="lg" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" height="1.5rem" />
          <SkeletonLine width="40%" height="1rem" />
          <div className="flex gap-2 mt-2">
            <SkeletonBadge />
            <SkeletonBadge />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <SkeletonLine width="100px" height="1rem" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="90%" />
        <SkeletonLine width="75%" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="cyber-card p-3">
            <SkeletonLine width="2rem" height="1.5rem" className="mb-1" />
            <SkeletonLine width="80%" height="0.75rem" />
          </div>
        ))}
      </div>

      {/* Related items */}
      <div>
        <SkeletonLine width="120px" height="1rem" className="mb-3" />
        <SkeletonList items={3} />
      </div>
    </div>
  )
}

// Page skeleton with filters
export function SkeletonPage({ className = '' }) {
  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <SkeletonLine width="180px" height="1.75rem" className="mb-2" />
          <SkeletonLine width="280px" height="1rem" />
        </div>
        <SkeletonButton />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Content */}
      <SkeletonTable rows={8} cols={6} />
    </div>
  )
}

// Actor card skeleton
export function SkeletonActorCard({ className = '' }) {
  return (
    <div className={clsx('cyber-card p-4', className)}>
      <div className="flex items-start gap-3 mb-3">
        <SkeletonAvatar size="md" />
        <div className="flex-1">
          <SkeletonLine width="70%" height="1.25rem" className="mb-1" />
          <SkeletonLine width="50%" height="0.875rem" />
        </div>
        <SkeletonBadge />
      </div>
      <div className="space-y-2 mb-3">
        <SkeletonLine width="100%" />
        <SkeletonLine width="80%" />
      </div>
      <div className="flex gap-2">
        <SkeletonBadge />
        <SkeletonBadge />
        <SkeletonBadge />
      </div>
    </div>
  )
}

// Grid of actor cards
export function SkeletonActorGrid({ count = 6, className = '' }) {
  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonActorCard key={i} />
      ))}
    </div>
  )
}

export default {
  Base: Skeleton,
  Line: SkeletonLine,
  Avatar: SkeletonAvatar,
  Badge: SkeletonBadge,
  Button: SkeletonButton,
  Card: SkeletonCard,
  Table: SkeletonTable,
  Stats: SkeletonStats,
  List: SkeletonList,
  Chart: SkeletonChart,
  DetailPanel: SkeletonDetailPanel,
  Page: SkeletonPage,
  ActorCard: SkeletonActorCard,
  ActorGrid: SkeletonActorGrid,
  Dashboard: SkeletonDashboard,
}
