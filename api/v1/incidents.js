/**
 * Incidents API Endpoint
 * GET /api/v1/incidents - List incidents with filtering
 * GET /api/v1/incidents?id=<uuid> - Get single incident
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
    // Single incident lookup
    const incidentId = params.get('id')
    if (incidentId) {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          threat_actor:threat_actors(id, name, aliases)
        `)
        .eq('id', incidentId)
        .single()

      if (error || !data) {
        return errorResponse('Incident not found', 404)
      }

      const response = jsonResponse({ data })
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

    // Filters
    const actorId = params.get('actor_id')
    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    const search = params.get('search')
    if (search) {
      query = query.ilike('victim_name', `%${search}%`)
    }

    const sector = params.get('sector')
    if (sector) {
      query = query.eq('victim_sector', sector)
    }

    const country = params.get('country')
    if (country) {
      query = query.eq('victim_country', country)
    }

    const status = params.get('status')
    if (status) {
      query = query.eq('status', status)
    }

    // Date range
    const dateFrom = params.get('date_from')
    if (dateFrom) {
      query = query.gte('discovered_date', dateFrom)
    }

    const dateTo = params.get('date_to')
    if (dateTo) {
      query = query.lte('discovered_date', dateTo)
    }

    // Pagination
    const page = parseInt(params.get('page') || '1')
    const limit = Math.min(parseInt(params.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const sortBy = params.get('sort_by') || 'discovered_date'
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
