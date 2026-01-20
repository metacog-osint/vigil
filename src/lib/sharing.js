/**
 * Sharing Library
 *
 * Handles creation and management of share links for entities.
 */
import { supabase } from './supabase/client'

const BASE_URL = 'https://vigil.theintelligence.company'

/**
 * Generate a random token for share links
 */
function generateToken(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

/**
 * Create a share link for an entity
 * @param {string} entityType - Type of entity (actor, incident, cve, ioc)
 * @param {string} entityId - Entity ID
 * @param {Object} options - Share options
 * @returns {Object} Share link data
 */
export async function createShareLink(entityType, entityId, options = {}) {
  const { expiresInDays = null } = options

  const token = generateToken(12)
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('share_links')
    .insert({
      created_by: user?.id,
      entity_type: entityType,
      entity_id: entityId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating share link:', error)
    throw error
  }

  return {
    ...data,
    url: `${BASE_URL}/s/${token}`,
    shortUrl: `/s/${token}`,
  }
}

/**
 * Get share links for an entity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {Array} Share links
 */
export async function getShareLinks(entityType, entityId) {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (error && !error.message?.includes('does not exist')) {
    console.error('Error fetching share links:', error)
    return []
  }

  return (data || []).map((link) => ({
    ...link,
    url: `${BASE_URL}/s/${link.token}`,
    shortUrl: `/s/${link.token}`,
    isExpired: link.expires_at && new Date(link.expires_at) < new Date(),
  }))
}

/**
 * Get share link by token
 * @param {string} token - Share token
 * @returns {Object|null} Share link data or null
 */
export async function getShareLinkByToken(token) {
  const { data, error } = await supabase.from('share_links').select('*').eq('token', token).single()

  if (error) {
    console.error('Error fetching share link:', error)
    return null
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ...data, isExpired: true }
  }

  // Increment view count
  await supabase
    .from('share_links')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', data.id)

  return data
}

/**
 * Delete a share link
 * @param {string} linkId - Share link ID
 */
export async function deleteShareLink(linkId) {
  const { error } = await supabase.from('share_links').delete().eq('id', linkId)

  if (error) {
    console.error('Error deleting share link:', error)
    throw error
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {boolean} Success
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

export default {
  createShareLink,
  getShareLinks,
  getShareLinkByToken,
  deleteShareLink,
  copyToClipboard,
}
