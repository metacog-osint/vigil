/**
 * API Key Management Module
 * Handles generation, validation, and management of API keys
 */

import { supabase } from './supabase'

// Generate a cryptographically secure API key
function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'vgl_' // Vigil prefix
  let key = ''

  // Generate 32 random characters using crypto.getRandomValues
  const randomValues = new Uint32Array(32)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(randomValues[i] % chars.length)
  }

  return prefix + key
}

// Simple hash function for client-side (for display purposes only)
// Server should use proper crypto.createHash('sha256')
async function hashKey(key) {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * API Keys management functions
 */
export const apiKeys = {
  /**
   * Create a new API key
   * @param {string} userId - User ID
   * @param {string} name - Key name
   * @param {string[]} scopes - Permissions (read, write)
   * @param {Date} expiresAt - Optional expiration date
   * @returns {object} - { key, keyData } - key is only returned once
   */
  async create(userId, name, scopes = ['read'], expiresAt = null) {
    // Generate the key
    const key = generateKey()
    const keyHash = await hashKey(key)
    const keyPrefix = key.substring(0, 12) + '...'

    // Insert into database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error(`An API key named "${name}" already exists`)
      }
      throw error
    }

    // Return the full key only once - it cannot be retrieved later
    return {
      key,
      keyData: data,
    }
  },

  /**
   * Get all API keys for a user
   * @param {string} userId - User ID
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get a single API key by ID
   * @param {string} keyId - Key ID
   * @param {string} userId - User ID (for verification)
   */
  async getById(keyId, userId) {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update an API key
   * @param {string} keyId - Key ID
   * @param {string} userId - User ID
   * @param {object} updates - Fields to update
   */
  async update(keyId, userId, updates) {
    const allowedFields = [
      'name',
      'scopes',
      'is_active',
      'expires_at',
      'rate_limit_per_minute',
      'rate_limit_per_day',
    ]
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    )

    const { data, error } = await supabase
      .from('api_keys')
      .update(filteredUpdates)
      .eq('id', keyId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Revoke (deactivate) an API key
   * @param {string} keyId - Key ID
   * @param {string} userId - User ID
   */
  async revoke(keyId, userId) {
    return this.update(keyId, userId, { is_active: false })
  },

  /**
   * Delete an API key permanently
   * @param {string} keyId - Key ID
   * @param {string} userId - User ID
   */
  async delete(keyId, userId) {
    const { error } = await supabase.from('api_keys').delete().eq('id', keyId).eq('user_id', userId)

    if (error) throw error
    return true
  },

  /**
   * Get API key usage statistics
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   */
  async getUsageStats(userId, days = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error } = await supabase
      .from('api_request_log')
      .select('endpoint, status_code, response_time_ms, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())

    if (error) throw error

    // Calculate stats
    const requests = data || []
    const totalRequests = requests.length
    const requestsToday = requests.filter(
      (r) => new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length
    const avgResponseTime =
      requests.length > 0
        ? requests.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / requests.length
        : 0

    // Top endpoints
    const endpointCounts = {}
    requests.forEach((r) => {
      endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] || 0) + 1
    })
    const topEndpoints = Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }))

    // Daily requests chart data
    const dailyData = {}
    requests.forEach((r) => {
      const date = new Date(r.created_at).toISOString().split('T')[0]
      dailyData[date] = (dailyData[date] || 0) + 1
    })

    return {
      totalRequests,
      requestsToday,
      avgResponseTime: Math.round(avgResponseTime),
      topEndpoints,
      dailyData,
    }
  },

  /**
   * Validate an API key (for use in API routes)
   * @param {string} key - The full API key
   * @returns {object|null} - Key data if valid, null if invalid
   */
  async validate(key) {
    if (!key || !key.startsWith('vgl_')) {
      return null
    }

    const keyHash = await hashKey(key)

    const { data, error } = await supabase
      .from('api_keys')
      .select('*, user:user_subscriptions(tier, status)')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return null
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null
    }

    // Check if key is rotated and past grace period
    if (data.rotated_at && data.rotation_expires_at) {
      if (new Date(data.rotation_expires_at) < new Date()) {
        return null
      }
    }

    // Update last used
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (data.request_count || 0) + 1,
      })
      .eq('id', data.id)

    // Add flag if this is a rotated key
    if (data.rotated_at) {
      data.isRotatedKey = true
      data.gracePeriodEnds = data.rotation_expires_at
    }

    return data
  },

  /**
   * Rotate an API key
   * Creates a new key and marks the old one as rotated with a grace period
   * @param {string} keyId - The key to rotate
   * @param {string} userId - User ID
   * @param {number} gracePeriodHours - Hours the old key remains valid (default: 24)
   * @returns {object} - { newKey, oldKeyExpiresAt }
   */
  async rotate(keyId, userId, gracePeriodHours = 24) {
    // Get the old key first
    const oldKey = await this.getById(keyId, userId)
    if (!oldKey) {
      throw new Error('API key not found')
    }

    if (oldKey.rotated_at) {
      throw new Error('This key has already been rotated')
    }

    // Generate new key
    const newKey = generateKey()
    const newKeyHash = await hashKey(newKey)
    const newKeyPrefix = newKey.substring(0, 12) + '...'

    const gracePeriodEnd = new Date()
    gracePeriodEnd.setHours(gracePeriodEnd.getHours() + gracePeriodHours)

    // Create new key
    const { data: newKeyData, error: createError } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: `${oldKey.name} (rotated)`,
        key_hash: newKeyHash,
        key_prefix: newKeyPrefix,
        scopes: oldKey.scopes,
        rate_limit_per_minute: oldKey.rate_limit_per_minute,
        rate_limit_per_day: oldKey.rate_limit_per_day,
        replaces: keyId,
      })
      .select()
      .single()

    if (createError) {
      throw createError
    }

    // Mark old key as rotated
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({
        rotated_at: new Date().toISOString(),
        rotation_expires_at: gracePeriodEnd.toISOString(),
        replaced_by: newKeyData.id,
      })
      .eq('id', keyId)
      .eq('user_id', userId)

    if (updateError) {
      // Rollback new key creation
      await supabase.from('api_keys').delete().eq('id', newKeyData.id)
      throw updateError
    }

    return {
      newKey,
      newKeyData,
      oldKeyExpiresAt: gracePeriodEnd,
    }
  },

  /**
   * Get rotation status for a key
   * @param {string} keyId - Key ID
   * @param {string} userId - User ID
   */
  async getRotationStatus(keyId, userId) {
    const { data, error } = await supabase
      .from('api_key_rotation_status')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get all keys with their rotation relationships
   * @param {string} userId - User ID
   */
  async getAllWithRotation(userId) {
    const { data, error } = await supabase
      .from('api_key_rotation_status')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },
}

export default apiKeys
