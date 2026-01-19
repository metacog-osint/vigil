/**
 * Supabase Auth Verification for API Routes
 * Verifies JWT tokens from Supabase Auth
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Create admin client for token verification
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Extract bearer token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Verify Supabase JWT token
 * @param {string} token - Supabase JWT token from client
 * @returns {Promise<object|null>} - User object or null if invalid
 */
export async function verifySupabaseToken(token) {
  if (!token) {
    return null
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('Supabase token verification failed:', error?.message)
      return null
    }

    return user
  } catch (error) {
    console.error('Supabase token verification error:', error.message)
    return null
  }
}

/**
 * Middleware helper to verify auth and return user context
 * @param {Request} request - Incoming request
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function verifyRequest(request) {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return { user: null, error: 'Missing authorization header' }
  }

  const user = await verifySupabaseToken(token)
  if (!user) {
    return { user: null, error: 'Invalid or expired token' }
  }

  return { user, error: null }
}

export { supabase }
