// "New" indicator component for recently added items
import { clsx } from 'clsx'

// Default threshold: items added within the last 24 hours are "new"
const DEFAULT_NEW_THRESHOLD_HOURS = 24

export function isNew(dateString, thresholdHours = DEFAULT_NEW_THRESHOLD_HOURS) {
  if (!dateString) return false
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours <= thresholdHours
}

export function NewBadge({
  date,
  thresholdHours = DEFAULT_NEW_THRESHOLD_HOURS,
  className = '',
  showOnlyIfNew = true,
}) {
  const isNewItem = isNew(date, thresholdHours)

  if (showOnlyIfNew && !isNewItem) {
    return null
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium',
        'bg-green-500/20 border border-green-500/50 text-green-400',
        'animate-pulse',
        className
      )}
    >
      NEW
    </span>
  )
}

export function NewDot({
  date,
  thresholdHours = DEFAULT_NEW_THRESHOLD_HOURS,
  className = '',
  showOnlyIfNew = true,
}) {
  const isNewItem = isNew(date, thresholdHours)

  if (showOnlyIfNew && !isNewItem) {
    return null
  }

  return (
    <span
      className={clsx(
        'inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse',
        className
      )}
      title="Recently added"
    />
  )
}

export function NewIndicator({
  date,
  thresholdHours = DEFAULT_NEW_THRESHOLD_HOURS,
  variant = 'badge', // 'badge' | 'dot' | 'glow'
  className = '',
}) {
  const isNewItem = isNew(date, thresholdHours)

  if (!isNewItem) {
    return null
  }

  switch (variant) {
    case 'dot':
      return <NewDot date={date} thresholdHours={thresholdHours} className={className} />
    case 'glow':
      return (
        <div className={clsx('absolute -top-1 -right-1', className)}>
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
      )
    case 'badge':
    default:
      return <NewBadge date={date} thresholdHours={thresholdHours} className={className} />
  }
}

export default NewIndicator
