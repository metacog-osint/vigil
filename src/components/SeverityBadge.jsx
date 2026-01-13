// Severity badge component for CVSS scores and threat levels
import { clsx } from 'clsx'

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    label: 'Critical',
  },
  high: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    label: 'High',
  },
  medium: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    label: 'Medium',
  },
  low: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    label: 'Low',
  },
  info: {
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/50',
    text: 'text-gray-400',
    label: 'Info',
  },
}

export function classifyBySeverity(cvss) {
  if (cvss === null || cvss === undefined) return 'info'
  if (cvss >= 9.0) return 'critical'
  if (cvss >= 7.0) return 'high'
  if (cvss >= 4.0) return 'medium'
  return 'low'
}

export function SeverityBadge({
  score,
  severity,
  showLabel = false,
  showScore = true,
  size = 'sm',
  className = '',
}) {
  // If severity not provided, classify by score
  const level = severity || classifyBySeverity(score)
  const config = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.info

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border font-medium',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showScore && score !== null && score !== undefined && (
        <span className="font-mono">{Number(score).toFixed(1)}</span>
      )}
      {showLabel && <span>{config.label}</span>}
      {!showScore && !showLabel && <span>{config.label}</span>}
    </span>
  )
}

export function SeverityDot({ score, severity, className = '' }) {
  const level = severity || classifyBySeverity(score)
  const config = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.info

  return (
    <span
      className={clsx(
        'inline-block w-2 h-2 rounded-full',
        config.bg.replace('/20', ''),
        className
      )}
      title={config.label}
    />
  )
}

export function SeverityBar({ score, className = '' }) {
  const percentage = score ? (score / 10) * 100 : 0
  const level = classifyBySeverity(score)
  const config = SEVERITY_CONFIG[level]

  return (
    <div className={clsx('h-1.5 bg-gray-800 rounded-full overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all', config.text.replace('text-', 'bg-'))}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function EPSSBadge({ score, percentile, className = '' }) {
  if (score === null || score === undefined) return null

  const percentage = (score * 100).toFixed(2)
  const isHigh = score >= 0.1 // 10% or higher is considered elevated

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium',
        isHigh
          ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
          : 'bg-gray-500/20 border-gray-500/50 text-gray-400',
        className
      )}
      title={percentile ? `EPSS: ${percentage}% (${(percentile * 100).toFixed(0)}th percentile)` : `EPSS: ${percentage}%`}
    >
      <span>EPSS</span>
      <span className="font-mono">{percentage}%</span>
    </span>
  )
}

export default SeverityBadge
