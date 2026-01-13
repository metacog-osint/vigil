// Loading skeleton components for perceived performance

export function SkeletonLine({ width = '100%', height = '1rem', className = '' }) {
  return (
    <div
      className={`animate-pulse bg-gray-700 rounded ${className}`}
      style={{ width, height }}
    />
  )
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

export default {
  Line: SkeletonLine,
  Card: SkeletonCard,
  Table: SkeletonTable,
  Stats: SkeletonStats,
  List: SkeletonList,
  Dashboard: SkeletonDashboard,
}
