/**
 * Investigation Constants and Badge Components
 */
import { STATUSES, PRIORITIES } from '../../lib/investigations'

// Color lookup tables for Tailwind JIT compatibility
export const PRIORITY_COLORS = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400' },
}

export const ENTRY_COLORS = {
  note: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  finding: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  entity: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  evidence: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  action: { bg: 'bg-green-500/20', text: 'text-green-400' },
  timeline_event: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
}

export const TLP_COLORS = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400' },
  white: { bg: 'bg-gray-500/20', text: 'text-gray-300' },
}

export function StatusBadge({ status, small = false }) {
  const statusInfo = STATUSES.find((s) => s.value === status)
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    green: 'bg-green-500/20 text-green-400',
    gray: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <span
      className={`${small ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'} rounded ${colors[statusInfo?.color] || colors.gray}`}
    >
      {statusInfo?.label || status}
    </span>
  )
}

export function TlpBadge({ tlp }) {
  const colors = TLP_COLORS[tlp] || TLP_COLORS.white
  return (
    <span className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
      TLP:{tlp.toUpperCase()}
    </span>
  )
}
