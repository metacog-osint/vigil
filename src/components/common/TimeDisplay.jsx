// Improved time display components with tooltips and smart formatting
import { memo } from 'react'
import {
  formatDistanceToNow,
  format,
  isToday,
  isYesterday,
  isThisWeek,
  differenceInHours,
} from 'date-fns'
import { clsx } from 'clsx'

export function smartFormatDate(date) {
  if (!date) return 'Unknown'

  const d = new Date(date)
  const now = new Date()
  const hoursDiff = differenceInHours(now, d)

  // Within 24 hours: show relative time
  if (hoursDiff < 24) {
    return formatDistanceToNow(d, { addSuffix: true })
  }

  // Today: show "Today at HH:MM"
  if (isToday(d)) {
    return `Today at ${format(d, 'HH:mm')}`
  }

  // Yesterday: show "Yesterday at HH:MM"
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'HH:mm')}`
  }

  // This week: show day name
  if (isThisWeek(d)) {
    return format(d, 'EEEE') // Monday, Tuesday, etc.
  }

  // Otherwise: show date
  return format(d, 'MMM d, yyyy')
}

export const TimeAgo = memo(function TimeAgo({ date, className = '' }) {
  if (!date) {
    return <span className={clsx('text-gray-500', className)}>Unknown</span>
  }

  const d = new Date(date)
  const relativeTime = formatDistanceToNow(d, { addSuffix: true })
  const fullDate = format(d, 'PPpp') // "Apr 29, 2023 at 3:45 PM"

  return (
    <span className={clsx('cursor-help', className)} title={fullDate}>
      {relativeTime}
    </span>
  )
})

export const SmartTime = memo(function SmartTime({ date, className = '' }) {
  if (!date) {
    return <span className={clsx('text-gray-500', className)}>Unknown</span>
  }

  const d = new Date(date)
  const smartDate = smartFormatDate(d)
  const fullDate = format(d, 'PPpp')

  return (
    <span className={clsx('cursor-help', className)} title={fullDate}>
      {smartDate}
    </span>
  )
})

export const DateBadge = memo(function DateBadge({ date, className = '' }) {
  if (!date) return null

  const d = new Date(date)
  const now = new Date()
  const hoursDiff = differenceInHours(now, d)

  let colorClass = 'text-gray-400'
  if (hoursDiff < 1) {
    colorClass = 'text-green-400'
  } else if (hoursDiff < 24) {
    colorClass = 'text-blue-400'
  } else if (hoursDiff < 168) {
    // 7 days
    colorClass = 'text-gray-300'
  }

  return (
    <span className={clsx('text-xs font-medium', colorClass, className)} title={format(d, 'PPpp')}>
      {smartFormatDate(d)}
    </span>
  )
})

export const FullDate = memo(function FullDate({ date, className = '' }) {
  if (!date) {
    return <span className={clsx('text-gray-500', className)}>Unknown</span>
  }

  const d = new Date(date)

  return (
    <span className={clsx(className)}>
      {format(d, 'PPP')} {/* April 29, 2023 */}
    </span>
  )
})

export const Timestamp = memo(function Timestamp({ date, showTime = true, className = '' }) {
  if (!date) {
    return <span className={clsx('text-gray-500', className)}>Unknown</span>
  }

  const d = new Date(date)
  const formatString = showTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'

  return <span className={clsx('font-mono text-xs', className)}>{format(d, formatString)}</span>
})

export default {
  TimeAgo,
  SmartTime,
  DateBadge,
  FullDate,
  Timestamp,
  smartFormatDate,
}
