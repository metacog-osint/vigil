import { clsx } from 'clsx'

export default function TrendBadge({ status, showLabel = true, size = 'sm' }) {
  const getConfig = () => {
    switch (status) {
      case 'ESCALATING':
        return {
          color: 'bg-red-900/50 text-red-400 border-red-800',
          icon: '↑',
          label: 'Escalating',
        }
      case 'DECLINING':
        return {
          color: 'bg-green-900/50 text-green-400 border-green-800',
          icon: '↓',
          label: 'Declining',
        }
      case 'STABLE':
      default:
        return {
          color: 'bg-gray-800/50 text-gray-400 border-gray-700',
          icon: '→',
          label: 'Stable',
        }
    }
  }

  const config = getConfig()
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border font-medium',
        config.color,
        sizeClasses
      )}
    >
      <span className="font-bold">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

// Compact version for tables
export function TrendIndicator({ status }) {
  const getColor = () => {
    switch (status) {
      case 'ESCALATING':
        return 'text-red-400'
      case 'DECLINING':
        return 'text-green-400'
      default:
        return 'text-gray-500'
    }
  }

  const getIcon = () => {
    switch (status) {
      case 'ESCALATING':
        return '▲'
      case 'DECLINING':
        return '▼'
      default:
        return '●'
    }
  }

  return (
    <span className={clsx('text-xs font-bold', getColor())} title={status || 'STABLE'}>
      {getIcon()}
    </span>
  )
}
