/**
 * Notes Library
 *
 * CRUD operations for entity notes and collaboration.
 */
import { supabase } from './supabase/client'

/**
 * Create a note on an entity
 * @param {string} entityType - Type of entity (actor, incident, cve, ioc)
 * @param {string} entityId - Entity ID
 * @param {string} content - Note content
 * @param {Object} options - Note options
 * @returns {Object} Created note
 */
export async function createNote(entityType, entityId, content, options = {}) {
  const { teamId = null, isTeamVisible = true } = options

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Must be logged in to create notes')
  }

  const { data, error } = await supabase
    .from('entity_notes')
    .insert({
      user_id: user.id,
      team_id: teamId,
      entity_type: entityType,
      entity_id: entityId,
      content,
      is_team_visible: isTeamVisible,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating note:', error)
    throw error
  }

  return data
}

/**
 * Get notes for an entity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {Array} Notes
 */
export async function getNotes(entityType, entityId) {
  const { data: { user } } = await supabase.auth.getUser()

  // Build query - user can see their own notes and team visible notes
  let query = supabase
    .from('entity_notes')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  // If logged in, filter appropriately
  if (user) {
    query = query.or(`user_id.eq.${user.id},is_team_visible.eq.true`)
  }

  const { data, error } = await query

  if (error && !error.message?.includes('does not exist')) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data || []
}

/**
 * Update a note
 * @param {string} noteId - Note ID
 * @param {string} content - New content
 * @returns {Object} Updated note
 */
export async function updateNote(noteId, content) {
  const { data, error } = await supabase
    .from('entity_notes')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (error) {
    console.error('Error updating note:', error)
    throw error
  }

  return data
}

/**
 * Delete a note
 * @param {string} noteId - Note ID
 */
export async function deleteNote(noteId) {
  const { error } = await supabase
    .from('entity_notes')
    .delete()
    .eq('id', noteId)

  if (error) {
    console.error('Error deleting note:', error)
    throw error
  }
}

/**
 * Get all notes by the current user
 * @param {number} limit - Max notes to fetch
 * @returns {Array} User's notes
 */
export async function getMyNotes(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('entity_notes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error && !error.message?.includes('does not exist')) {
    console.error('Error fetching user notes:', error)
    return []
  }

  return data || []
}

/**
 * Get team notes
 * @param {string} teamId - Team ID
 * @param {number} limit - Max notes to fetch
 * @returns {Array} Team notes
 */
export async function getTeamNotes(teamId, limit = 50) {
  const { data, error } = await supabase
    .from('entity_notes')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_team_visible', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error && !error.message?.includes('does not exist')) {
    console.error('Error fetching team notes:', error)
    return []
  }

  return data || []
}

/**
 * Search notes
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Array} Matching notes
 */
export async function searchNotes(query, limit = 20) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('entity_notes')
    .select('*')
    .or(`user_id.eq.${user.id},is_team_visible.eq.true`)
    .ilike('content', `%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error && !error.message?.includes('does not exist')) {
    console.error('Error searching notes:', error)
    return []
  }

  return data || []
}

export default {
  createNote,
  getNotes,
  updateNote,
  deleteNote,
  getMyNotes,
  getTeamNotes,
  searchNotes,
}
