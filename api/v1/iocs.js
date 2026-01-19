/**
 * IOCs API Endpoint
 * GET /api/v1/iocs - List IOCs with filtering
 * GET /api/v1/iocs?id=<uuid> - Get single IOC
 * GET /api/v1/iocs?value=<ioc> - Lookup by IOC value
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
  validateIOCType,
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
    // Single IOC lookup by ID
    const iocId = params.get('id')
    if (iocId) {
      if (!isValidUUID(iocId)) {
        return errorResponse('Invalid IOC ID format', 400, getCorsHeaders(origin))
      }

      const { data, error } = await supabase
        .from('iocs')
        .select(`
          *,
          threat_actor:threat_actors(id, name)
        `)
        .eq('id', iocId)
        .single()

      if (error || !data) {
        return errorResponse('IOC not found', 404, getCorsHeaders(origin))
      }

      const response = jsonResponse({ data }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // IOC value lookup (sanitize to prevent injection)
    const value = sanitizeSearch(params.get('value'))
    if (value) {
      const { data, error } = await supabase
        .from('iocs')
        .select(`
          *,
          threat_actor:threat_actors(id, name)
        `)
        .eq('value', value)

      if (error) {
        console.error('Database error:', error)
        return errorResponse('Failed to lookup IOC', 500, getCorsHeaders(origin))
      }

      const response = jsonResponse({
        data,
        found: data.length > 0
      }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })

      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List IOCs
    let query = supabase
      .from('iocs')
      .select(`
        *,
        threat_actor:threat_actors(id, name)
      `, { count: 'exact' })

    // Validated filters
    const type = validateIOCType(params.get('type'))
    if (type) {
      query = query.eq('type', type)
    }

    const actorId = params.get('actor_id')
    if (actorId) {
      if (!isValidUUID(actorId)) {
        return errorResponse('Invalid actor_id format', 400, getCorsHeaders(origin))
      }
      query = query.eq('actor_id', actorId)
    }

    const source = sanitizeSearch(params.get('source'))
    if (source) {
      query = query.eq('source', source)
    }

    const malwareFamily = sanitizeSearch(params.get('malware_family'))
    if (malwareFamily) {
      query = query.ilike('malware_family', `%${malwareFamily}%`)
    }

    const minConfidence = parseInt(params.get('min_confidence'))
    if (!isNaN(minConfidence) && minConfidence >= 0 && minConfidence <= 100) {
      query = query.gte('confidence', minConfidence)
    }

    // Validated date range
    const { start: dateFrom, end: dateTo } = validateDateRange(
      params.get('date_from'),
      params.get('date_to')
    )
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Validated pagination
    const { page, limit, offset } = validatePagination(
      params.get('page'),
      params.get('limit')
    )

    // Validated sorting
    const sortBy = validateSortField('iocs', params.get('sort_by'))
    const sortOrder = validateSortOrder(params.get('sort_order'))

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to fetch IOCs', 500, getCorsHeaders(origin))
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
