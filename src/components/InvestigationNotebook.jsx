/**
 * InvestigationNotebook Component
 * Rich investigation notebook with markdown notes, activity timeline, and checklists
 */

import { useState, useEffect, useCallback } from 'react'
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  FolderIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import { TimeAgo } from './common'
import { supabase } from '../lib/supabase'
import { sanitizeMarkdown } from '../lib/sanitize'

// Activity type icons and colors
const ACTIVITY_TYPES = {
  created: { icon: PlusIcon, color: 'text-green-400', label: 'Created' },
  updated: { icon: PencilIcon, color: 'text-blue-400', label: 'Updated' },
  status_change: { icon: ExclamationTriangleIcon, color: 'text-yellow-400', label: 'Status Changed' },
  entity_added: { icon: LinkIcon, color: 'text-cyan-400', label: 'Entity Added' },
  entity_removed: { icon: TrashIcon, color: 'text-red-400', label: 'Entity Removed' },
  note_added: { icon: DocumentTextIcon, color: 'text-purple-400', label: 'Note Added' },
  comment: { icon: ChatBubbleLeftRightIcon, color: 'text-gray-400', label: 'Comment' },
  priority_change: { icon: ExclamationTriangleIcon, color: 'text-orange-400', label: 'Priority Changed' },
  assignment_change: { icon: UserCircleIcon, color: 'text-indigo-400', label: 'Assigned' },
}

// Priority levels
const PRIORITIES = {
  critical: { color: 'bg-red-500', label: 'Critical' },
  high: { color: 'bg-orange-500', label: 'High' },
  medium: { color: 'bg-yellow-500', label: 'Medium' },
  low: { color: 'bg-green-500', label: 'Low' },
}

// Simple markdown renderer (basic)
function renderMarkdown(text) {
  if (!text) return ''

  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-700 px-1 rounded text-cyan-400">$1</code>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br />')
}

// Activity Item Component
function ActivityItem({ activity }) {
  const config = ACTIVITY_TYPES[activity.activity_type] || ACTIVITY_TYPES.updated
  const Icon = config.icon

  return (
    <div className="flex gap-3 py-2">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300">
          {activity.description}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          <TimeAgo date={activity.created_at} />
        </p>
      </div>
    </div>
  )
}

// Checklist Item Component
function ChecklistItem({ item, onToggle, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-2 hover:bg-gray-800/50 rounded group">
      <button
        onClick={() => onToggle(item)}
        className={`flex-shrink-0 ${item.is_completed ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
      >
        {item.is_completed ? (
          <CheckCircleSolidIcon className="w-5 h-5" />
        ) : (
          <CheckCircleIcon className="w-5 h-5" />
        )}
      </button>
      <span className={`flex-1 text-sm ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
        {item.content}
      </span>
      <button
        onClick={() => onRemove(item.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// Comment Component
function CommentItem({ comment, onReply }) {
  return (
    <div className="flex gap-3 py-3">
      <UserCircleIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">User</span>
          <span className="text-xs text-gray-500">
            <TimeAgo date={comment.created_at} />
          </span>
          {comment.is_edited && (
            <span className="text-xs text-gray-500">(edited)</span>
          )}
        </div>
        <p className="text-sm text-gray-300 mt-1">
          {comment.content}
        </p>
        <button
          onClick={() => onReply?.(comment)}
          className="text-xs text-cyan-400 hover:text-cyan-300 mt-1"
        >
          Reply
        </button>
      </div>
    </div>
  )
}

// Linked Entity Component
function LinkedEntity({ entity, onRemove }) {
  const typeColors = {
    actor: 'bg-purple-500/20 text-purple-400',
    incident: 'bg-orange-500/20 text-orange-400',
    ioc: 'bg-cyan-500/20 text-cyan-400',
    vulnerability: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded ${typeColors[entity.entity_type] || 'bg-gray-700 text-gray-300'}`}>
      <LinkIcon className="w-3 h-3" />
      <span className="text-xs font-medium truncate">{entity.entity_type}: {entity.display_name || entity.entity_id}</span>
      {onRemove && (
        <button
          onClick={() => onRemove(entity.id)}
          className="hover:text-red-400"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Main InvestigationNotebook Component
export default function InvestigationNotebook({
  investigation,
  onUpdate,
  onClose,
  readOnly = false,
}) {
  const [activeTab, setActiveTab] = useState('notes')
  const [notes, setNotes] = useState(investigation?.notes_markdown || '')
  const [isEditing, setIsEditing] = useState(false)
  const [activities, setActivities] = useState([])
  const [checklist, setChecklist] = useState([])
  const [comments, setComments] = useState([])
  const [entities, setEntities] = useState([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)

  // Load related data
  useEffect(() => {
    if (!investigation?.id) return

    const loadData = async () => {
      setLoading(true)

      try {
        // Load activities
        const { data: activityData } = await supabase
          .from('investigation_activities')
          .select('*')
          .eq('investigation_id', investigation.id)
          .order('created_at', { ascending: false })
          .limit(50)

        setActivities(activityData || [])

        // Load checklist
        const { data: checklistData } = await supabase
          .from('investigation_checklist')
          .select('*')
          .eq('investigation_id', investigation.id)
          .order('sort_order', { ascending: true })

        setChecklist(checklistData || [])

        // Load comments
        const { data: commentData } = await supabase
          .from('investigation_comments')
          .select('*')
          .eq('investigation_id', investigation.id)
          .order('created_at', { ascending: true })

        setComments(commentData || [])

        // Load linked entities
        const { data: entityData } = await supabase
          .from('investigation_entities')
          .select('*')
          .eq('investigation_id', investigation.id)

        setEntities(entityData || [])
      } catch (error) {
        console.error('Error loading investigation data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [investigation?.id])

  // Save notes
  const saveNotes = useCallback(async () => {
    if (!investigation?.id) return

    const { error } = await supabase
      .from('investigations')
      .update({
        notes_markdown: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', investigation.id)

    if (!error) {
      setIsEditing(false)
      onUpdate?.({ ...investigation, notes_markdown: notes })
    }
  }, [investigation, notes, onUpdate])

  // Add checklist item
  const addChecklistItem = async () => {
    if (!newChecklistItem.trim() || !investigation?.id) return

    const { data, error } = await supabase
      .from('investigation_checklist')
      .insert({
        investigation_id: investigation.id,
        content: newChecklistItem.trim(),
        sort_order: checklist.length,
      })
      .select()
      .single()

    if (!error && data) {
      setChecklist([...checklist, data])
      setNewChecklistItem('')
    }
  }

  // Toggle checklist item
  const toggleChecklistItem = async (item) => {
    const { error } = await supabase
      .from('investigation_checklist')
      .update({
        is_completed: !item.is_completed,
        completed_at: !item.is_completed ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (!error) {
      setChecklist(checklist.map(c =>
        c.id === item.id ? { ...c, is_completed: !c.is_completed } : c
      ))
    }
  }

  // Remove checklist item
  const removeChecklistItem = async (id) => {
    const { error } = await supabase
      .from('investigation_checklist')
      .delete()
      .eq('id', id)

    if (!error) {
      setChecklist(checklist.filter(c => c.id !== id))
    }
  }

  // Add comment
  const addComment = async () => {
    if (!newComment.trim() || !investigation?.id) return

    const { data, error } = await supabase
      .from('investigation_comments')
      .insert({
        investigation_id: investigation.id,
        content: newComment.trim(),
        user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single()

    if (!error && data) {
      setComments([...comments, data])
      setNewComment('')
    }
  }

  const completedCount = checklist.filter(c => c.is_completed).length
  const totalCount = checklist.length

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <FolderIcon className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-white">{investigation?.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITIES[investigation?.priority]?.color || 'bg-gray-600'} bg-opacity-20`}>
                {investigation?.priority || 'Medium'}
              </span>
              <span className="text-xs text-gray-500">
                Status: {investigation?.status}
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {[
          { id: 'notes', label: 'Notes', icon: DocumentTextIcon },
          { id: 'activity', label: 'Activity', icon: ClockIcon },
          { id: 'checklist', label: `Checklist (${completedCount}/${totalCount})`, icon: CheckCircleIcon },
          { id: 'comments', label: `Comments (${comments.length})`, icon: ChatBubbleLeftRightIcon },
          { id: 'entities', label: `Entities (${entities.length})`, icon: LinkIcon },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading...
          </div>
        ) : (
          <>
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="cyber-input w-full h-80 font-mono text-sm"
                      placeholder="Enter notes in Markdown format..."
                    />
                    <div className="flex gap-2">
                      <button onClick={saveNotes} className="cyber-button-primary">
                        Save
                      </button>
                      <button onClick={() => setIsEditing(false)} className="cyber-button">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {!readOnly && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit Notes
                      </button>
                    )}
                    <div
                      className="prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(renderMarkdown(notes)) || '<p class="text-gray-500">No notes yet. Click Edit to add notes.</p>' }}
                    />
                  </>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-2">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No activity yet</p>
                ) : (
                  activities.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))
                )}
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                {!readOnly && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                      placeholder="Add checklist item..."
                      className="cyber-input flex-1"
                    />
                    <button onClick={addChecklistItem} className="cyber-button">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {checklist.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No checklist items yet</p>
                ) : (
                  <div className="space-y-1">
                    {checklist.map(item => (
                      <ChecklistItem
                        key={item.id}
                        item={item}
                        onToggle={toggleChecklistItem}
                        onRemove={readOnly ? null : removeChecklistItem}
                      />
                    ))}
                  </div>
                )}

                {totalCount > 0 && (
                  <div className="text-sm text-gray-400">
                    Progress: {Math.round((completedCount / totalCount) * 100)}% complete
                  </div>
                )}
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No comments yet</p>
                ) : (
                  <div className="space-y-2 divide-y divide-gray-700">
                    {comments.map(comment => (
                      <CommentItem key={comment.id} comment={comment} />
                    ))}
                  </div>
                )}

                {!readOnly && (
                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addComment()}
                      placeholder="Add a comment..."
                      className="cyber-input flex-1"
                    />
                    <button onClick={addComment} className="cyber-button">
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Entities Tab */}
            {activeTab === 'entities' && (
              <div className="space-y-4">
                {entities.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No linked entities</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {entities.map(entity => (
                      <LinkedEntity key={entity.id} entity={entity} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export { ActivityItem, ChecklistItem, CommentItem, LinkedEntity, ACTIVITY_TYPES, PRIORITIES }
