/**
 * Investigation Card Component
 */
import { formatDistanceToNow } from 'date-fns'
import { CATEGORIES, PRIORITIES } from '../../lib/investigations'
import { StatusBadge, PRIORITY_COLORS } from './InvestigationConstants.jsx'

export default function InvestigationCard({ investigation, isSelected, onClick }) {
  const priorityColors = PRIORITY_COLORS[investigation.priority] || PRIORITY_COLORS.medium

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50'
          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-medium text-white truncate pr-2">{investigation.title}</h3>
        <StatusBadge status={investigation.status} small />
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {investigation.category && (
          <span className="mr-2">{CATEGORIES.find(c => c.value === investigation.category)?.label}</span>
        )}
        {investigation.entry_count} entries
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {formatDistanceToNow(new Date(investigation.updated_at), { addSuffix: true })}
        </span>
        {investigation.priority && (
          <span className={`px-1.5 py-0.5 rounded ${priorityColors.text} ${priorityColors.bg}`}>
            {PRIORITIES.find(p => p.value === investigation.priority)?.label}
          </span>
        )}
      </div>
    </button>
  )
}
