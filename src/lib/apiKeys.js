/**
 * API Key Management Module
 * Handles generation, validation, and management of API keys
 */

import { supabase } from './supabase'

// Generate a random API key
function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'vgl_' // Vigil prefix
  let key = ''

  // Generate 32 random characters
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
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
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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
    const allowedFields = ['name', 'scopes', 'is_active', 'expires_at', 'rate_limit_per_minute', 'rate_limit_per_day']
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
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId)

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
    const requestsToday = requests.filter(r =>
      new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length
    const avgResponseTime = requests.length > 0
      ? requests.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / requests.length
      : 0

    // Top endpoints
    const endpointCounts = {}
    requests.forEach(r => {
      endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] || 0) + 1
    })
    const topEndpoints = Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }))

    // Daily requests chart data
    const dailyData = {}
    requests.forEach(r => {
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

    // Update last used
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (data.request_count || 0) + 1,
      })
      .eq('id', data.id)

    return data
  },
}

export default apiKeys
