/**
 * Asset Constants and Badge Components
 */

// Criticality badge component
export function CriticalityBadge({ criticality }) {
  const colors = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/20 text-green-400',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[criticality] || colors.medium}`}>
      {criticality?.charAt(0).toUpperCase() + criticality?.slice(1) || 'Medium'}
    </span>
  )
}

// Match status badge component
export function MatchStatusBadge({ status }) {
  const colors = {
    new: 'bg-red-500/20 text-red-400',
    acknowledged: 'bg-yellow-500/20 text-yellow-400',
    investigating: 'bg-blue-500/20 text-blue-400',
    resolved: 'bg-green-500/20 text-green-400',
    false_positive: 'bg-gray-500/20 text-gray-400',
  }

  const labels = {
    new: 'New',
    acknowledged: 'Ack',
    investigating: 'Investigating',
    resolved: 'Resolved',
    false_positive: 'False Positive',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[status] || colors.new}`}>
      {labels[status] || status}
    </span>
  )
}
