// Event type badge component for unified events timeline
import { clsx } from 'clsx'

const EVENT_TYPE_CONFIG = {
  ransomware: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    label: 'Ransomware',
    shortLabel: 'RANSOM',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  alert: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    label: 'Alert',
    shortLabel: 'ALERT',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  vulnerability: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    label: 'Vulnerability',
    shortLabel: 'KEV',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  ioc: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    label: 'IOC',
    shortLabel: 'IOC',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  malware: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400',
    label: 'Malware',
    shortLabel: 'MALWARE',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
  breach: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    label: 'Breach',
    shortLabel: 'BREACH',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
        />
      </svg>
    ),
  },
}

export function EventTypeBadge({
  type,
  showLabel = true,
  showIcon = true,
  useShortLabel = false,
  size = 'sm',
  className = '',
}) {
  const config = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.ioc

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }

  const label = useShortLabel ? config.shortLabel : config.label

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded border font-medium whitespace-nowrap',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && config.icon}
      {showLabel && <span>{label}</span>}
    </span>
  )
}

export function EventTypeDot({ type, className = '' }) {
  const config = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.ioc

  return (
    <span
      className={clsx(
        'inline-block w-2.5 h-2.5 rounded-full',
        config.bg.replace('/20', ''),
        className
      )}
      title={config.label}
    />
  )
}

export function getEventTypeConfig(type) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.ioc
}

export const EVENT_TYPES = Object.keys(EVENT_TYPE_CONFIG)

export default EventTypeBadge
