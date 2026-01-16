/**
 * Entry Card Component
 */
import { format } from 'date-fns'
import { ENTRY_TYPES } from '../../lib/investigations'
import { ENTRY_COLORS } from './InvestigationConstants.jsx'

export default function EntryCard({ entry, onDelete }) {
  const typeInfo = ENTRY_TYPES[entry.entry_type] || ENTRY_TYPES.note
  const entryColors = ENTRY_COLORS[entry.entry_type] || ENTRY_COLORS.note

  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded ${entryColors.bg} ${entryColors.text}`}>
          {typeInfo.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {format(new Date(entry.created_at), 'MMM d, h:mm a')}
          </span>
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap">
        {entry.content?.text || entry.content?.title || entry.content?.event || JSON.stringify(entry.content)}
      </div>
      {entry.content?.entity_name && (
        <div className="mt-2 text-xs text-cyan-400">
          Linked: {entry.content.entity_type} - {entry.content.entity_name}
        </div>
      )}
    </div>
  )
}
