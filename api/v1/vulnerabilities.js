/**
 * Vulnerabilities API Endpoint
 * GET /api/v1/vulnerabilities - List vulnerabilities with filtering
 * GET /api/v1/vulnerabilities?id=<uuid> - Get by ID
 * GET /api/v1/vulnerabilities?cve=<cve-id> - Get by CVE ID
 */

import { validateApiKey, hasScope, logRequest, errorResponse, jsonResponse, supabase, checkRateLimit, getRateLimitHeaders, getRotationWarningHeaders } from '../_lib/auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_lib/cors.js'
import {
  validateSortField,
  validateSortOrder,
  validatePagination,
  isValidUUID,
  isValidCVE,
  sanitizeSearch,
  validateDateRange,
} from '../_lib/validators.js'

export const config = {
  runtime: 'edge'
}

// Valid severity values
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low']

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
    // Single vulnerability lookup by ID
    const vulnId = params.get('id')
    if (vulnId) {
      if (!isValidUUID(vulnId)) {
        return errorResponse('Invalid vulnerability ID format', 400, getCorsHeaders(origin))
      }

      const { data, error } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('id', vulnId)
        .single()

      if (error || !data) {
        return errorResponse('Vulnerability not found', 404, getCorsHeaders(origin))
      }

      const response = jsonResponse({ data }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // CVE lookup
    const cve = params.get('cve')
    if (cve) {
      if (!isValidCVE(cve)) {
        return errorResponse('Invalid CVE ID format', 400, getCorsHeaders(origin))
      }

      const { data, error } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('cve_id', cve.toUpperCase())
        .single()

      if (error || !data) {
        return errorResponse('CVE not found', 404, getCorsHeaders(origin))
      }

      const response = jsonResponse({ data }, 200, {
        ...getCorsHeaders(origin),
        ...getRotationWarningHeaders(auth)
      })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List vulnerabilities
    let query = supabase
      .from('vulnerabilities')
      .select('*', { count: 'exact' })

    // Validated filters
    const search = sanitizeSearch(params.get('search'))
    if (search) {
      query = query.or(`cve_id.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const kevOnly = params.get('kev_only')
    if (kevOnly === 'true') {
      query = query.eq('is_kev', true)
    }

    // Validate CVSS score range (0.0 - 10.0)
    const minCvss = parseFloat(params.get('min_cvss'))
    if (!isNaN(minCvss) && minCvss >= 0 && minCvss <= 10) {
      query = query.gte('cvss_score', minCvss)
    }

    const maxCvss = parseFloat(params.get('max_cvss'))
    if (!isNaN(maxCvss) && maxCvss >= 0 && maxCvss <= 10) {
      query = query.lte('cvss_score', maxCvss)
    }

    const severity = params.get('severity')?.toLowerCase()
    if (severity && VALID_SEVERITIES.includes(severity)) {
      // Map severity to CVSS ranges
      const severityRanges = {
        critical: [9.0, 10.0],
        high: [7.0, 8.9],
        medium: [4.0, 6.9],
        low: [0.1, 3.9]
      }
      const range = severityRanges[severity]
      if (range) {
        query = query.gte('cvss_score', range[0]).lte('cvss_score', range[1])
      }
    }

    const vendor = sanitizeSearch(params.get('vendor'))
    if (vendor) {
      query = query.ilike('vendor', `%${vendor}%`)
    }

    const product = sanitizeSearch(params.get('product'))
    if (product) {
      query = query.ilike('product', `%${product}%`)
    }

    const hasExploit = params.get('has_exploit')
    if (hasExploit === 'true') {
      query = query.eq('has_public_exploit', true)
    }

    // Validated date range
    const { start: dateFrom, end: dateTo } = validateDateRange(
      params.get('date_from'),
      params.get('date_to')
    )
    if (dateFrom) {
      query = query.gte('published_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('published_date', dateTo)
    }

    // Validated pagination
    const { page, limit, offset } = validatePagination(
      params.get('page'),
      params.get('limit')
    )

    // Validated sorting
    const sortBy = validateSortField('vulnerabilities', params.get('sort_by'))
    const sortOrder = validateSortOrder(params.get('sort_order'))

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to fetch vulnerabilities', 500, getCorsHeaders(origin))
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
