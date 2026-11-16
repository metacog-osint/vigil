/**
 * Audit API endpoint: the only way the browser writes to audit_log
 *
 * POST /api/audit
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { eventType, eventCategory?, action?, resourceType?, resourceId?,
 *         resourceName?, description?, metadata?, status?, errorMessage? }
 *
 * Until migration 171 the browser inserted into audit_log itself, under an RLS
 * policy that let a signed-in user write any entry carrying their own user_id.
 * The subject of an entry could therefore write their own record: self-report,
 * not evidence (finding audit_log_trust, confirmed by Tom 16 Nov 2026).
 *
 * Now the browser posts here. Who acted, from where and with what client is
 * taken from the verified token and the request, never from the body:
 * user_id and user_email from the token, ip_address and user_agent from the
 * request headers. The row is written with the service key through
 * api/_lib/audit.js, and 171 removes the browser's own insert right.
 *
 * team_id is not accepted from the body. A team admin can read entries that
 * carry their team's id (121's policy), so a client-supplied team_id would let
 * a user place entries in another team's log. Nothing in the app sends one
 * today; a caller that needs it should resolve membership server side first.
 */

import { verifyRequest } from './_lib/supabase-auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from './_lib/cors.js'
import { logAuditEvent } from './_lib/audit.js'
import { checkRateLimit } from './_lib/rateLimit.js'

export const config = { runtime: 'edge' }

const STATUSES = new Set(['success', 'failure', 'blocked'])
const MAX_TEXT = 500
const MAX_METADATA_BYTES = 4000

/** A trimmed string no longer than max, or null. */
function text(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t ? t.slice(0, max) : null
}

/**
 * The fields of an audit entry the browser may state, cleaned. Returns
 * { entry } or { error }. Identity and client fields are never read here.
 */
export function parseAuditBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object' }
  }
  const eventType = text(body.eventType, 100)
  if (!eventType || !/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(eventType)) {
    return { error: 'eventType must look like "category.action"' }
  }
  const status = body.status == null ? 'success' : body.status
  if (!STATUSES.has(status)) {
    return { error: 'status must be success, failure or blocked' }
  }
  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {}
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    return { error: 'metadata is too large' }
  }
  return {
    entry: {
      eventType,
      eventCategory: text(body.eventCategory, 50) || eventType.split('.')[0],
      action: text(body.action, 50) || 'read',
      resourceType: text(body.resourceType, 100),
      resourceId: text(body.resourceId, 200),
      resourceName: text(body.resourceName, 300),
      description: text(body.description),
      details: metadata,
      status,
      errorMessage: text(body.errorMessage),
    },
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

export default async function handler(request) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || '')

  const preflight = handleCorsPreflightRequest(request)
  if (preflight) return preflight

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const { user, error: authError } = await verifyRequest(request)
  if (authError) return json({ error: authError }, 401, corsHeaders)

  const rate = await checkRateLimit(`audit:${user.id}`, 60)
  if (!rate.allowed) return json({ error: 'Rate limit exceeded' }, 429, corsHeaders)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400, corsHeaders)
  }

  const { entry, error } = parseAuditBody(body)
  if (error) return json({ error }, 400, corsHeaders)

  const result = await logAuditEvent({
    ...entry,
    userId: user.id,
    userEmail: user.email || null,
    request,
  })

  if (!result.success) {
    return json({ error: 'The audit entry was not recorded' }, 502, corsHeaders)
  }
  return json({ id: result.id }, 201, corsHeaders)
}
