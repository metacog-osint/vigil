/**
 * Investigation Detail Component
 */
import { useState } from 'react'
import { format } from 'date-fns'
import { investigations, ENTRY_TYPES, CATEGORIES, STATUSES } from '../../lib/investigations'
import { StatusBadge, TlpBadge } from './InvestigationConstants.jsx'
import EntryCard from './EntryCard.jsx'

export default function InvestigationDetail({ investigation, userId, onUpdate, onStatusChange, onDelete }) {
  const [newEntryType, setNewEntryType] = useState('note')
  const [newEntryContent, setNewEntryContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(investigation.title)
  const [editDescription, setEditDescription] = useState(investigation.description || '')
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Export functions
  const exportAsJson = () => {
    const exportData = {
      title: investigation.title,
      description: investigation.description,
      category: investigation.category,
      priority: investigation.priority,
      status: investigation.status,
      tlp: investigation.tlp,
      created_at: investigation.created_at,
      entries: investigation.entries?.map(e => ({
        type: e.entry_type,
        content: e.content,
        created_at: e.created_at,
      })) || [],
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `investigation-${investigation.id.slice(0, 8)}.json`)
    setShowExportMenu(false)
  }

  const exportAsMarkdown = () => {
    let md = `# ${investigation.title}\n\n`
    if (investigation.description) md += `${investigation.description}\n\n`
    md += `**Status:** ${investigation.status} | **Priority:** ${investigation.priority} | **TLP:** ${investigation.tlp?.toUpperCase() || 'AMBER'}\n\n`
    md += `---\n\n## Entries\n\n`

    for (const entry of investigation.entries || []) {
      const typeLabel = ENTRY_TYPES[entry.entry_type]?.label || entry.entry_type
      const date = format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')
      md += `### ${typeLabel} (${date})\n\n`
      md += `${entry.content?.text || entry.content?.title || entry.content?.event || JSON.stringify(entry.content)}\n\n`
    }

    const blob = new Blob([md], { type: 'text/markdown' })
    downloadBlob(blob, `investigation-${investigation.id.slice(0, 8)}.md`)
    setShowExportMenu(false)
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAddEntry = async () => {
    if (!newEntryContent.trim()) return

    try {
      await investigations.addEntry(investigation.id, userId, newEntryType, {
        text: newEntryContent,
      })
      setNewEntryContent('')
      onUpdate()
    } catch (err) {
      console.error('Error adding entry:', err)
    }
  }

  const handleSaveEdit = async () => {
    try {
      await investigations.update(investigation.id, userId, {
        title: editTitle,
        description: editDescription,
      })
      setIsEditing(false)
      onUpdate()
    } catch (err) {
      console.error('Error updating:', err)
    }
  }

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Delete this entry?')) return
    try {
      await investigations.deleteEntry(entryId)
      onUpdate()
    } catch (err) {
      console.error('Error deleting entry:', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-800/20 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between mb-2">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 text-xl font-bold bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
            />
          ) : (
            <h2 className="text-xl font-bold text-white">{investigation.title}</h2>
          )}
          <div className="flex items-center gap-2">
            <StatusBadge status={investigation.status} />
            <select
              value={investigation.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300 text-sm"
              rows={2}
              placeholder="Description..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 bg-cyan-600 text-white rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">{investigation.description || 'No description'}</p>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Edit
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                >
                  Export
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                    <button
                      onClick={exportAsJson}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={exportAsMarkdown}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Export Markdown
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={onDelete}
                className="text-gray-400 hover:text-red-400 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Created {format(new Date(investigation.created_at), 'MMM d, yyyy')}</span>
          {investigation.category && (
            <span>{CATEGORIES.find(c => c.value === investigation.category)?.label}</span>
          )}
          {investigation.tlp && (
            <TlpBadge tlp={investigation.tlp} />
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {investigation.entries?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No entries yet</p>
            <p className="text-sm">Add notes, findings, or link entities below</p>
          </div>
        ) : (
          investigation.entries?.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDeleteEntry(entry.id)}
            />
          ))
        )}
      </div>

      {/* Add Entry */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2 mb-2">
          {Object.entries(ENTRY_TYPES).map(([type, info]) => (
            <button
              key={type}
              onClick={() => setNewEntryType(type)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                newEntryType === type
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {info.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={newEntryContent}
            onChange={(e) => setNewEntryContent(e.target.value)}
            placeholder={`Add a ${ENTRY_TYPES[newEntryType]?.label.toLowerCase()}...`}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-cyan-500"
            rows={2}
          />
          <button
            onClick={handleAddEntry}
            disabled={!newEntryContent.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
