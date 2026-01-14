/**
 * IOCs API Endpoint
 * GET /api/v1/iocs - List IOCs with filtering
 * GET /api/v1/iocs?id=<uuid> - Get single IOC
 * GET /api/v1/iocs?value=<ioc> - Lookup by IOC value
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
    // Single IOC lookup by ID
    const iocId = params.get('id')
    if (iocId) {
      const { data, error } = await supabase
        .from('iocs')
        .select(`
          *,
          threat_actor:threat_actors(id, name)
        `)
        .eq('id', iocId)
        .single()

      if (error || !data) {
        return errorResponse('IOC not found', 404)
      }

      const response = jsonResponse({ data })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // IOC value lookup
    const value = params.get('value')
    if (value) {
      const { data, error } = await supabase
        .from('iocs')
        .select(`
          *,
          threat_actor:threat_actors(id, name)
        `)
        .eq('value', value)

      if (error) {
        return errorResponse(error.message, 500)
      }

      const response = jsonResponse({
        data,
        found: data.length > 0
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

    // Filters
    const type = params.get('type')
    if (type) {
      query = query.eq('type', type)
    }

    const actorId = params.get('actor_id')
    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    const source = params.get('source')
    if (source) {
      query = query.eq('source', source)
    }

    const malwareFamily = params.get('malware_family')
    if (malwareFamily) {
      query = query.ilike('malware_family', `%${malwareFamily}%`)
    }

    const minConfidence = params.get('min_confidence')
    if (minConfidence) {
      query = query.gte('confidence', parseInt(minConfidence))
    }

    // Date range
    const dateFrom = params.get('date_from')
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    const dateTo = params.get('date_to')
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Pagination
    const page = parseInt(params.get('page') || '1')
    const limit = Math.min(parseInt(params.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const sortBy = params.get('sort_by') || 'created_at'
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
