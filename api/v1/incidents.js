/**
 * Incidents API Endpoint
 * GET /api/v1/incidents - List incidents with filtering
 * GET /api/v1/incidents?id=<uuid> - Get single incident
 */

import { validateApiKey, hasScope, logRequest, errorResponse, jsonResponse, supabase, checkRateLimit, getRateLimitHeaders, getRotationWarningHeaders } from '../_lib/auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_lib/cors.js'
import {
  validateSortField,
  validateSortOrder,
  validatePagination,
  isValidUUID,
  sanitizeSearch,
  validateDateRange,
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

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405, getCorsHeaders(origin))
  }

  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return errorResponse('Invalid or missing API key', 401, getCorsHeaders(origin))
  }

  if (!hasScope(auth.scopes, 'read')) {
    return errorResponse('Insufficient permissions', 403, getCorsHeaders(origin))
  }

  if (!['team', 'enterprise'].includes(auth.tier)) {
    return errorResponse('API access requires Team plan or higher', 403, getCorsHeaders(origin))
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
    // Single incident lookup
    const incidentId = params.get('id')
    if (incidentId) {
      if (!isValidUUID(incidentId)) {
        return errorResponse('Invalid incident ID format', 400, getCorsHeaders(origin))
      }

      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          threat_actor:threat_actors(id, name, aliases)
        `)
        .eq('id', incidentId)
        .single()

      if (error || !data) {
        return errorResponse('Incident not found', 404, getCorsHeaders(origin))
      }

      const response = jsonResponse({ data }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List incidents
    let query = supabase
      .from('incidents')
      .select(`
        *,
        threat_actor:threat_actors(id, name, aliases)
      `, { count: 'exact' })

    // Validated filters
    const actorId = params.get('actor_id')
    if (actorId) {
      if (!isValidUUID(actorId)) {
        return errorResponse('Invalid actor_id format', 400, getCorsHeaders(origin))
      }
      query = query.eq('actor_id', actorId)
    }

    const search = sanitizeSearch(params.get('search'))
    if (search) {
      query = query.ilike('victim_name', `%${search}%`)
    }

    const sector = sanitizeSearch(params.get('sector'))
    if (sector) {
      query = query.eq('victim_sector', sector)
    }

    const country = sanitizeSearch(params.get('country'))
    if (country) {
      query = query.eq('victim_country', country)
    }

    const status = sanitizeSearch(params.get('status'))
    if (status) {
      query = query.eq('status', status)
    }

    // Validated date range
    const { start: dateFrom, end: dateTo } = validateDateRange(
      params.get('date_from'),
      params.get('date_to')
    )
    if (dateFrom) {
      query = query.gte('discovered_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('discovered_date', dateTo)
    }

    // Validated pagination
    const { page, limit, offset } = validatePagination(
      params.get('page'),
      params.get('limit')
    )

    // Validated sorting
    const sortBy = validateSortField('incidents', params.get('sort_by'))
    const sortOrder = validateSortOrder(params.get('sort_order'))

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to fetch incidents', 500, getCorsHeaders(origin))
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
