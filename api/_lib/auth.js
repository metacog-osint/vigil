/**
 * API Authentication Middleware
 * Validates API keys and enforces rate limits
 */

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getRateLimitHeaders, checkDailyRateLimit } from './rateLimit.js'

// Re-export rate limiting functions for backward compatibility
export { checkRateLimit, getRateLimitHeaders, checkDailyRateLimit }

// Initialize Supabase client with service role key for API access
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Hash an API key using SHA-256
 */
async function hashKey(key) {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate API key and return user context
 * Supports key rotation with grace period
 * @param {string} authHeader - Authorization header value
 * @returns {object|null} - { userId, tier, scopes, keyId, isRotated?, gracePeriodEnds? } or null if invalid
 */
export async function validateApiKey(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const key = authHeader.substring(7)
  if (!key.startsWith('vgl_')) {
    return null
  }

  const keyHash = await hashKey(key)

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select(`
      id,
      user_id,
      scopes,
      rate_limit_per_minute,
      rate_limit_per_day,
      is_active,
      expires_at,
      rotated_at,
      rotation_expires_at,
      replaced_by
    `)
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKey || !apiKey.is_active) {
    return null
  }

  // Check standard expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null
  }

  // Check if key is rotated and past grace period
  const isRotated = !!apiKey.rotated_at
  if (isRotated) {
    if (!apiKey.rotation_expires_at || new Date(apiKey.rotation_expires_at) < new Date()) {
      // Grace period expired, key is no longer valid
      return null
    }
  }

  // Get user's subscription tier
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier, status')
    .eq('user_id', apiKey.user_id)
    .single()

  const tier = subscription?.status === 'active' ? subscription.tier : 'free'

  // Update last used timestamp
  await supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      request_count: supabase.rpc('increment', { row_id: apiKey.id })
    })
    .eq('id', apiKey.id)

  const result = {
    userId: apiKey.user_id,
    tier,
    scopes: apiKey.scopes || ['read'],
    keyId: apiKey.id,
    rateLimits: {
      perMinute: apiKey.rate_limit_per_minute || 60,
      perDay: apiKey.rate_limit_per_day || 10000
    }
  }

  // Add rotation info if this is a rotated key
  if (isRotated) {
    result.isRotated = true
    result.gracePeriodEnds = apiKey.rotation_expires_at
    result.newKeyId = apiKey.replaced_by
  }

  return result
}

/**
 * Get headers to warn about rotated key usage
 * @param {object} auth - Auth context from validateApiKey
 * @returns {object} - Headers to merge into response
 */
export function getRotationWarningHeaders(auth) {
  if (!auth?.isRotated) {
    return {}
  }

  const expiresAt = new Date(auth.gracePeriodEnds)
  const now = new Date()
  const hoursRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60))

  return {
    'X-API-Key-Deprecated': 'true',
    'X-API-Key-Expires': auth.gracePeriodEnds,
    'Warning': `199 - "This API key has been rotated and will expire in ${hoursRemaining} hours. Please use your new key."`
  }
}

/**
 * Check if user has required scope
 */
export function hasScope(scopes, required) {
  return scopes.includes(required) || scopes.includes('admin')
}

/**
 * Log API request
 */
export async function logRequest(context, request, response) {
  try {
    await supabase.from('api_request_log').insert({
      api_key_id: context.keyId,
      user_id: context.userId,
      endpoint: new URL(request.url).pathname,
      method: request.method,
      status_code: response.status,
      response_time_ms: context.responseTime || 0,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent')
    })
  } catch (err) {
    console.error('Error logging API request:', err)
  }
}

/**
 * Standard error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Object} customHeaders - Optional custom headers (e.g., CORS)
 */
export function errorResponse(message, status = 400, customHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...customHeaders,
    }
  })
}

/**
 * Standard success response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} customHeaders - Optional custom headers (e.g., CORS)
 */
export function jsonResponse(data, status = 200, customHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...customHeaders,
    }
  })
}

export { supabase }
