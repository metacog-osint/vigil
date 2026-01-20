/**
 * NoteEditor Component
 *
 * Add and view notes on entities for collaboration.
 */
import { useState, useEffect } from 'react'
import { createNote, getNotes, updateNote, deleteNote } from '../../lib/notes'
import { useAuth } from '../../hooks/useAuth'

export function NoteEditor({ entityType, entityId, entityName, className = '' }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')

  // Load notes
  useEffect(() => {
    loadNotes()
  }, [entityType, entityId])

  async function loadNotes() {
    setLoading(true)
    try {
      const data = await getNotes(entityType, entityId)
      setNotes(data)
    } finally {
      setLoading(false)
    }
  }

  // Create note
  async function handleCreate() {
    if (!newNote.trim() || !user) return

    setSaving(true)
    try {
      await createNote(entityType, entityId, newNote.trim())
      setNewNote('')
      await loadNotes()
    } catch (error) {
      console.error('Error creating note:', error)
    } finally {
      setSaving(false)
    }
  }

  // Update note
  async function handleUpdate(noteId) {
    if (!editContent.trim()) return

    setSaving(true)
    try {
      await updateNote(noteId, editContent.trim())
      setEditingId(null)
      setEditContent('')
      await loadNotes()
    } catch (error) {
      console.error('Error updating note:', error)
    } finally {
      setSaving(false)
    }
  }

  // Delete note
  async function handleDelete(noteId) {
    if (!confirm('Delete this note?')) return

    try {
      await deleteNote(noteId)
      await loadNotes()
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  // Start editing
  function startEditing(note) {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  // Format date
  function formatDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <h3 className="text-sm font-medium text-gray-300">
          Notes {notes.length > 0 && `(${notes.length})`}
        </h3>
      </div>

      {/* New note input */}
      {user ? (
        <div className="space-y-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-cyan-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{newNote.length}/500 characters</span>
            <button
              onClick={handleCreate}
              disabled={!newNote.trim() || saving || newNote.length > 500}
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">Sign in to add notes</p>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 bg-gray-800/50 rounded-lg animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 group"
            >
              {/* Note header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {formatDate(note.updated_at || note.created_at)}
                  {note.updated_at !== note.created_at && ' (edited)'}
                </span>

                {/* Actions - only show for own notes */}
                {user?.id === note.user_id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditing(note)}
                      className="p-1 text-gray-500 hover:text-white"
                      title="Edit"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                      title="Delete"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Note content */}
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm resize-none focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      disabled={saving}
                      className="px-2 py-0.5 bg-cyan-500 text-white text-xs rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditContent('')
                      }}
                      className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>
              )}

              {/* Team visibility indicator */}
              {note.is_team_visible && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Visible to team
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NoteEditor
