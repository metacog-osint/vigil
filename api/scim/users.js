/**
 * SCIM 2.0 User Provisioning Endpoint
 *
 * Implements System for Cross-domain Identity Management
 * for enterprise SSO integration (Okta, Azure AD, etc.)
 *
 * Endpoints:
 *   GET    /api/scim/users          - List users
 *   GET    /api/scim/users/:id      - Get user
 *   POST   /api/scim/users          - Create user
 *   PUT    /api/scim/users/:id      - Replace user
 *   PATCH  /api/scim/users/:id      - Update user
 *   DELETE /api/scim/users/:id      - Deactivate user
 */

import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// SCIM Schema URIs
const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
const ENTERPRISE_SCHEMA = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse'

/**
 * Convert internal user to SCIM format
 */
function toScimUser(user) {
  return {
    schemas: [USER_SCHEMA, ENTERPRISE_SCHEMA],
    id: user.id,
    externalId: user.external_id || user.id,
    userName: user.email,
    name: {
      formatted: user.display_name || user.email,
      givenName: user.first_name || '',
      familyName: user.last_name || ''
    },
    displayName: user.display_name || user.email,
    emails: [{
      value: user.email,
      type: 'work',
      primary: true
    }],
    active: user.status !== 'deactivated',
    groups: user.groups || [],
    [ENTERPRISE_SCHEMA]: {
      department: user.department || '',
      organization: user.organization_id || ''
    },
    meta: {
      resourceType: 'User',
      created: user.created_at,
      lastModified: user.updated_at,
      location: `/api/scim/users/${user.id}`
    }
  }
}

/**
 * Convert SCIM user to internal format
 */
function fromScimUser(scimUser) {
  return {
    email: scimUser.userName || scimUser.emails?.[0]?.value,
    display_name: scimUser.displayName || scimUser.name?.formatted,
    first_name: scimUser.name?.givenName,
    last_name: scimUser.name?.familyName,
    external_id: scimUser.externalId,
    status: scimUser.active === false ? 'deactivated' : 'active',
    department: scimUser[ENTERPRISE_SCHEMA]?.department,
    organization_id: scimUser[ENTERPRISE_SCHEMA]?.organization
  }
}

/**
 * Validate SCIM bearer token using constant-time comparison
 * to prevent timing attacks
 */
function validateScimToken(req) {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.substring(7)
  const expectedToken = process.env.SCIM_SECRET_TOKEN

  // Bail early if expected token is not configured
  if (!expectedToken) {
    console.error('SCIM_SECRET_TOKEN not configured')
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    const tokenBuffer = Buffer.from(token, 'utf8')
    const expectedBuffer = Buffer.from(expectedToken, 'utf8')

    // Pad to same length to avoid length-based timing leaks
    if (tokenBuffer.length !== expectedBuffer.length) {
      // Compare against expected anyway to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer)
      return false
    }

    return timingSafeEqual(tokenBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  // CORS headers for SCIM
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Content-Type', 'application/scim+json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Validate SCIM token
  if (!validateScimToken(req)) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Invalid or missing SCIM token'
    })
  }

  const { id } = req.query
  const path = req.url

  try {
    // List Users: GET /api/scim/users
    if (req.method === 'GET' && !id) {
      const startIndex = parseInt(req.query.startIndex) || 1
      const count = Math.min(parseInt(req.query.count) || 100, 100)
      const filter = req.query.filter

      let query = supabase
        .from('scim_users')
        .select('*', { count: 'exact' })

      // Parse SCIM filter (basic support)
      if (filter) {
        // Support: userName eq "email@example.com"
        const match = filter.match(/userName\s+eq\s+"([^"]+)"/)
        if (match) {
          query = query.eq('email', match[1])
        }
      }

      query = query.range(startIndex - 1, startIndex - 1 + count - 1)

      const { data: users, count: totalCount, error } = await query

      if (error) throw error

      return res.status(200).json({
        schemas: [LIST_SCHEMA],
        totalResults: totalCount || 0,
        startIndex,
        itemsPerPage: users?.length || 0,
        Resources: (users || []).map(toScimUser)
      })
    }

    // Get User: GET /api/scim/users/:id
    if (req.method === 'GET' && id) {
      const { data: user, error } = await supabase
        .from('scim_users')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !user) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: `User ${id} not found`
        })
      }

      return res.status(200).json(toScimUser(user))
    }

    // Create User: POST /api/scim/users
    if (req.method === 'POST') {
      const scimUser = req.body
      const userData = fromScimUser(scimUser)

      // Check if user already exists
      const { data: existing } = await supabase
        .from('scim_users')
        .select('id')
        .eq('email', userData.email)
        .single()

      if (existing) {
        return res.status(409).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '409',
          detail: 'User already exists'
        })
      }

      const { data: user, error } = await supabase
        .from('scim_users')
        .insert(userData)
        .select()
        .single()

      if (error) throw error

      return res.status(201).json(toScimUser(user))
    }

    // Replace User: PUT /api/scim/users/:id
    if (req.method === 'PUT' && id) {
      const scimUser = req.body
      const userData = fromScimUser(scimUser)

      const { data: user, error } = await supabase
        .from('scim_users')
        .update({ ...userData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error || !user) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: `User ${id} not found`
        })
      }

      return res.status(200).json(toScimUser(user))
    }

    // Patch User: PATCH /api/scim/users/:id
    if (req.method === 'PATCH' && id) {
      const { Operations } = req.body
      const updates = {}

      for (const op of Operations || []) {
        if (op.op === 'replace') {
          if (op.path === 'active') {
            updates.status = op.value ? 'active' : 'deactivated'
          } else if (op.path === 'userName') {
            updates.email = op.value
          } else if (op.path === 'name.givenName') {
            updates.first_name = op.value
          } else if (op.path === 'name.familyName') {
            updates.last_name = op.value
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        // No updates, just return current user
        const { data: user } = await supabase
          .from('scim_users')
          .select('*')
          .eq('id', id)
          .single()
        return res.status(200).json(toScimUser(user))
      }

      updates.updated_at = new Date().toISOString()

      const { data: user, error } = await supabase
        .from('scim_users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error || !user) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: `User ${id} not found`
        })
      }

      return res.status(200).json(toScimUser(user))
    }

    // Delete User: DELETE /api/scim/users/:id
    if (req.method === 'DELETE' && id) {
      // Soft delete - set status to deactivated
      const { error } = await supabase
        .from('scim_users')
        .update({ status: 'deactivated', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      return res.status(204).end()
    }

    return res.status(405).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '405',
      detail: 'Method not allowed'
    })

  } catch (error) {
    console.error('SCIM error:', error)
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: error.message
    })
  }
}
