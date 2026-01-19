/**
 * CORS Configuration
 * Restricted CORS to allowed origins only
 */

const ALLOWED_ORIGINS = [
  'https://vigil.theintelligence.company',
  'https://www.vigil.theintelligence.company',
  // Development environments
  process.env.NODE_ENV === 'development' && 'http://localhost:5173',
  process.env.NODE_ENV === 'development' && 'http://localhost:3000',
  // Vercel preview deployments
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
].filter(Boolean)

/**
 * Get CORS headers for a given origin
 * @param {string} origin - Request origin
 * @returns {Object} - CORS headers
 */
export function getCorsHeaders(origin) {
  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    if (allowed === origin) return true
    // Allow Vercel preview URLs
    if (origin?.includes('.vercel.app')) return true
    return false
  })

  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Handle CORS preflight request
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Preflight response or null
 */
export function handleCorsPreflightRequest(request) {
  if (request.method !== 'OPTIONS') {
    return null
  }

  const origin = request.headers.get('origin') || ''
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  })
}

export default { getCorsHeaders, handleCorsPreflightRequest }
