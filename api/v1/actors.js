/**
 * Threat Actors API Endpoint
 * GET /api/v1/actors - List all actors with filtering
 * GET /api/v1/actors?id=<uuid> - Get single actor
 */

import { validateApiKey, hasScope, logRequest, errorResponse, jsonResponse, supabase, checkRateLimit, getRateLimitHeaders, getRotationWarningHeaders } from '../_lib/auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_lib/cors.js'
import {
  validateSortField,
  validateSortOrder,
  validatePagination,
  isValidUUID,
  validateTrendStatus,
  sanitizeSearch,
} from '../_lib/validators.js'

export const config = {
  runtime: 'edge'
}

export default async function handler(request) {
  const startTime = Date.now()
  const origin = request.headers.get('origin') || ''

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(request)
  if (preflightResponse) return preflightResponse

  // Only allow GET
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405, getCorsHeaders(origin))
  }

  // Validate API key
  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return errorResponse('Invalid or missing API key', 401)
  }

  // Check scope
  if (!hasScope(auth.scopes, 'read')) {
    return errorResponse('Insufficient permissions', 403)
  }

  // Check tier - API access requires team+
  if (!['team', 'enterprise'].includes(auth.tier)) {
    return errorResponse('API access requires Team plan or higher', 403)
  }

  // Enforce rate limits (distributed via Redis when available)
  const rateLimit = await checkRateLimit(auth.keyId, auth.rateLimits.perMinute)
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateLimit.resetIn),
        ...getRateLimitHeaders(rateLimit),
        ...getCorsHeaders(origin)
      }
    })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  try {
    // Single actor lookup
    const actorId = params.get('id')
    if (actorId) {
      // Validate UUID format
      if (!isValidUUID(actorId)) {
        return errorResponse('Invalid actor ID format', 400, getCorsHeaders(origin))
      }

      const { data, error } = await supabase
        .from('threat_actors')
        .select('*')
        .eq('id', actorId)
        .single()

      if (error || !data) {
        return errorResponse('Actor not found', 404, getCorsHeaders(origin))
      }

      const response = jsonResponse({ data }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List actors with filtering
    let query = supabase
      .from('threat_actors')
      .select('*', { count: 'exact' })

    // Apply validated filters
    const trendStatus = validateTrendStatus(params.get('trend_status'))
    if (trendStatus) {
      query = query.eq('trend_status', trendStatus)
    }

    const search = sanitizeSearch(params.get('search'))
    if (search) {
      query = query.or(`name.ilike.%${search}%,aliases.cs.{${search}}`)
    }

    const country = sanitizeSearch(params.get('country'))
    if (country) {
      query = query.contains('attributed_countries', [country])
    }

    const sector = sanitizeSearch(params.get('sector'))
    if (sector) {
      query = query.contains('target_sectors', [sector])
    }

    // Validated pagination
    const { page, limit, offset } = validatePagination(
      params.get('page'),
      params.get('limit')
    )

    // Validated sorting
    const sortBy = validateSortField('actors', params.get('sort_by'))
    const sortOrder = validateSortOrder(params.get('sort_order'))

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      // Don't expose internal error details
      console.error('Database error:', error)
      return errorResponse('Failed to fetch actors', 500, getCorsHeaders(origin))
    }

    const response = jsonResponse({
      data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    }, 200, {
      ...getCorsHeaders(origin),
      ...getRotationWarningHeaders(auth)
    })

    await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
    return response

  } catch (err) {
    console.error('API Error:', err)
    return errorResponse('Internal server error', 500, getCorsHeaders(origin))
  }
}
