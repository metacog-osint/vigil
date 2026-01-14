/**
 * Vulnerabilities API Endpoint
 * GET /api/v1/vulnerabilities - List vulnerabilities with filtering
 * GET /api/v1/vulnerabilities?id=<uuid> - Get by ID
 * GET /api/v1/vulnerabilities?cve=<cve-id> - Get by CVE ID
 */

import { validateApiKey, hasScope, logRequest, errorResponse, jsonResponse, supabase } from '../lib/auth.js'

export const config = {
  runtime: 'edge'
}

export default async function handler(request) {
  const startTime = Date.now()

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }
    })
  }

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return errorResponse('Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'read')) {
    return errorResponse('Insufficient permissions', 403)
  }

  if (!['team', 'enterprise'].includes(auth.tier)) {
    return errorResponse('API access requires Team plan or higher', 403)
  }

  const url = new URL(request.url)
  const params = url.searchParams

  try {
    // Single vulnerability lookup by ID
    const vulnId = params.get('id')
    if (vulnId) {
      const { data, error } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('id', vulnId)
        .single()

      if (error || !data) {
        return errorResponse('Vulnerability not found', 404)
      }

      const response = jsonResponse({ data })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // CVE lookup
    const cve = params.get('cve')
    if (cve) {
      const { data, error } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('cve_id', cve.toUpperCase())
        .single()

      if (error || !data) {
        return errorResponse('CVE not found', 404)
      }

      const response = jsonResponse({ data })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List vulnerabilities
    let query = supabase
      .from('vulnerabilities')
      .select('*', { count: 'exact' })

    // Filters
    const search = params.get('search')
    if (search) {
      query = query.or(`cve_id.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const kevOnly = params.get('kev_only')
    if (kevOnly === 'true') {
      query = query.eq('is_kev', true)
    }

    const minCvss = params.get('min_cvss')
    if (minCvss) {
      query = query.gte('cvss_score', parseFloat(minCvss))
    }

    const maxCvss = params.get('max_cvss')
    if (maxCvss) {
      query = query.lte('cvss_score', parseFloat(maxCvss))
    }

    const severity = params.get('severity')
    if (severity) {
      // Map severity to CVSS ranges
      const severityRanges = {
        critical: [9.0, 10.0],
        high: [7.0, 8.9],
        medium: [4.0, 6.9],
        low: [0.1, 3.9]
      }
      const range = severityRanges[severity.toLowerCase()]
      if (range) {
        query = query.gte('cvss_score', range[0]).lte('cvss_score', range[1])
      }
    }

    const vendor = params.get('vendor')
    if (vendor) {
      query = query.ilike('vendor', `%${vendor}%`)
    }

    const product = params.get('product')
    if (product) {
      query = query.ilike('product', `%${product}%`)
    }

    const hasExploit = params.get('has_exploit')
    if (hasExploit === 'true') {
      query = query.eq('has_public_exploit', true)
    }

    // Date range
    const dateFrom = params.get('date_from')
    if (dateFrom) {
      query = query.gte('published_date', dateFrom)
    }

    const dateTo = params.get('date_to')
    if (dateTo) {
      query = query.lte('published_date', dateTo)
    }

    // Pagination
    const page = parseInt(params.get('page') || '1')
    const limit = Math.min(parseInt(params.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const sortBy = params.get('sort_by') || 'published_date'
    const sortOrder = params.get('sort_order') === 'asc' ? true : false

    query = query
      .order(sortBy, { ascending: sortOrder })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error.message, 500)
    }

    const response = jsonResponse({
      data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    })

    await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
    return response

  } catch (err) {
    console.error('API Error:', err)
    return errorResponse('Internal server error', 500)
  }
}
