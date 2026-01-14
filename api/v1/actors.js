/**
 * Threat Actors API Endpoint
 * GET /api/v1/actors - List all actors with filtering
 * GET /api/v1/actors?id=<uuid> - Get single actor
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

  // Only allow GET
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
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

  const url = new URL(request.url)
  const params = url.searchParams

  try {
    // Single actor lookup
    const actorId = params.get('id')
    if (actorId) {
      const { data, error } = await supabase
        .from('threat_actors')
        .select('*')
        .eq('id', actorId)
        .single()

      if (error || !data) {
        return errorResponse('Actor not found', 404)
      }

      const response = jsonResponse({ data })
      await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
      return response
    }

    // List actors with filtering
    let query = supabase
      .from('threat_actors')
      .select('*', { count: 'exact' })

    // Apply filters
    const trendStatus = params.get('trend_status')
    if (trendStatus) {
      query = query.eq('trend_status', trendStatus.toUpperCase())
    }

    const search = params.get('search')
    if (search) {
      query = query.or(`name.ilike.%${search}%,aliases.cs.{${search}}`)
    }

    const country = params.get('country')
    if (country) {
      query = query.contains('attributed_countries', [country])
    }

    const sector = params.get('sector')
    if (sector) {
      query = query.contains('target_sectors', [sector])
    }

    // Pagination
    const page = parseInt(params.get('page') || '1')
    const limit = Math.min(parseInt(params.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Sorting
    const sortBy = params.get('sort_by') || 'last_seen'
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
