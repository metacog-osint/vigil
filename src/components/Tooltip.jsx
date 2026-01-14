import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

/**
 * Tooltip component that shows informational text on hover
 * Uses portal to avoid z-index and overflow issues
 */
export function Tooltip({
  children,
  content,
  source,
  position = 'top',
  className = '',
  delay = 300
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft
        setCoords(calculatePosition(rect, position, scrollTop, scrollLeft))
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  // Don't render tooltip if no content
  if (!content && !source) {
    return children
  }

  const tooltipContent = isVisible && (
    <div
      className={clsx(
        'fixed z-[9999] max-w-xs px-3 py-2 text-xs rounded-lg shadow-xl',
        'bg-gray-900 border border-gray-600 text-gray-200',
        'pointer-events-none'
      )}
      style={{
        top: coords.top,
        left: coords.left,
        transform: getTransform(position),
        animation: 'tooltip-fade-in 0.15s ease-out'
      }}
    >
      {content && <div className="leading-relaxed">{content}</div>}
      {source && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-gray-500 text-[10px]">
          Source: {source}
        </div>
      )}
    </div>
  )

  return (
    <>
      <span
        ref={triggerRef}
        className={clsx('cursor-help', className)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </span>
      {isVisible && createPortal(tooltipContent, document.body)}
    </>
  )
}

function calculatePosition(rect, position, scrollTop, scrollLeft) {
  const offset = 8
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  switch (position) {
    case 'top':
      return { top: rect.top - offset, left: centerX }
    case 'bottom':
      return { top: rect.bottom + offset, left: centerX }
    case 'left':
      return { top: centerY, left: rect.left - offset }
    case 'right':
      return { top: centerY, left: rect.right + offset }
    default:
      return { top: rect.top - offset, left: centerX }
  }
}

function getTransform(position) {
  switch (position) {
    case 'top': return 'translate(-50%, -100%)'
    case 'bottom': return 'translate(-50%, 0)'
    case 'left': return 'translate(-100%, -50%)'
    case 'right': return 'translate(0, -50%)'
    default: return 'translate(-50%, -100%)'
  }
}

// Predefined tooltips for common data fields
export const FIELD_TOOLTIPS = {
  actor_name: {
    content: 'Threat actor or group name. Click row to view full details including TTPs, CVEs, and IOCs.',
    source: 'RansomLook, MITRE ATT&CK, Malpedia, MISP Galaxy'
  },
  actor_type: {
    content: 'Classification: ransomware (encrypt & extort), APT (state-sponsored), cybercrime (financial), hacktivism (political), IAB (sell access), data extortion (steal only).',
    source: 'Curated taxonomy'
  },
  trend_status: {
    content: 'ESCALATING: >25% more incidents vs prior week. STABLE: ±25% change. DECLINING: >25% fewer incidents. Updated every 6 hours.',
    source: 'Calculated from ransomware.live'
  },
  incidents_7d: {
    content: 'Incidents attributed to this actor in the last 7 days.',
    source: 'ransomware.live'
  },
  incidents_prev_7d: {
    content: 'Incidents from days 8-14 ago. Used to calculate trend direction.',
    source: 'ransomware.live'
  },
  incident_velocity: {
    content: 'Average incidents per day (last 7 days). Higher = more active.',
    source: 'Calculated'
  },
  last_seen: {
    content: 'Most recent activity or incident attributed to this actor.',
    source: 'Multiple sources'
  },
  status: {
    content: 'active = currently operating. inactive = dormant. defunct = disbanded or arrested.',
    source: 'Curated'
  },
  aliases: {
    content: 'Alternative names used by different security vendors and reports.',
    source: 'MITRE ATT&CK, Malpedia, MISP Galaxy'
  },
  target_sectors: {
    content: 'Industries this actor has historically targeted.',
    source: 'Incident analysis'
  },
  cvss_score: {
    content: 'CVSS 0-10 severity. Critical: 9.0+, High: 7.0-8.9, Medium: 4.0-6.9, Low: <4.0',
    source: 'NVD'
  },
  kev: {
    content: 'CISA Known Exploited Vulnerabilities - confirmed active exploitation in the wild.',
    source: 'CISA KEV'
  },
  escalating_summary: {
    content: 'Actors with >25% increase in incidents compared to the previous 7-day period. Click to filter.',
    source: 'Calculated from ransomware.live'
  },
  stable_summary: {
    content: 'Actors with incident counts within ±25% of the previous 7-day period. Click to filter.',
    source: 'Calculated from ransomware.live'
  },
  declining_summary: {
    content: 'Actors with >25% decrease in incidents compared to the previous 7-day period. Click to filter.',
    source: 'Calculated from ransomware.live'
  }
}

/**
 * Sortable column header component
 */
export function SortableHeader({
  children,
  field,
  currentSort,
  onSort,
  tooltip,
  className = ''
}) {
  const isActive = currentSort?.field === field
  const direction = isActive ? currentSort.direction : null

  const handleClick = (e) => {
    e.stopPropagation()
    if (!isActive) {
      onSort({ field, direction: 'desc' })
    } else if (direction === 'desc') {
      onSort({ field, direction: 'asc' })
    } else {
      onSort(null) // Clear sort
    }
  }

  const header = (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-1.5 hover:text-white transition-colors group',
        'border-b border-transparent hover:border-gray-500',
        isActive ? 'text-cyan-400 border-cyan-400' : 'text-gray-400',
        className
      )}
    >
      <span className="font-medium">{children}</span>
      <span className={clsx(
        'text-xs transition-all',
        isActive ? 'opacity-100' : 'opacity-30 group-hover:opacity-70'
      )}>
        {isActive ? (direction === 'asc' ? '▲' : '▼') : '▼'}
      </span>
    </button>
  )

  if (tooltip) {
    return (
      <Tooltip content={tooltip.content} source={tooltip.source} position="top">
        {header}
      </Tooltip>
    )
  }

  return header
}
