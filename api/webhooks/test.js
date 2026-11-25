/**
 * Webhook Test API
 *
 * Sends a test payload to the signed-in user's webhook URL to check it is
 * set up: https only, private and internal hosts refused, no
 * redirects followed, and the reply body is never passed back, so the
 * endpoint cannot be used to read pages the caller can't reach.
 */
import { jsonResponse, errorResponse, checkRateLimit } from '../_lib/auth.js'
import { verifyRequest } from '../_lib/supabase-auth.js'
import { checkOutboundUrl } from '../_lib/outboundUrl.js'

export const config = {
  runtime: 'edge',
}

const TEST_LIMIT_PER_MINUTE = 5
const BLOCKED_HEADERS = new Set(['host', 'content-length', 'content-type', 'connection', 'transfer-encoding', 'cookie'])

function cleanHeaders(custom) {
  const out = {}
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return out
  for (const [name, value] of Object.entries(custom).slice(0, 5)) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(name)) continue
    if (BLOCKED_HEADERS.has(name.toLowerCase()) || name.toLowerCase().startsWith('x-vigil-')) continue
    out[name] = value.slice(0, 1024)
  }
  return out
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // The settings page sends the user's Supabase session token.
  const { user, error: authError } = await verifyRequest(request)
  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  const rate = await checkRateLimit(`webhook-test:${user.id}`, TEST_LIMIT_PER_MINUTE)
  if (!rate.allowed) {
    return errorResponse('Too many webhook tests. Try again in a minute.', 429, { 'Retry-After': '60' })
  }

  try {
    const body = await request.json()
    const { url, type = 'generic', headers: customHeaders = {} } = body || {}

    const checked = checkOutboundUrl(url)
    if (!checked.ok) {
      return errorResponse(checked.reason, 400)
    }

    const payloadType = ['slack', 'discord', 'teams'].includes(type) ? type : 'generic'
    const testPayload = buildTestPayload(payloadType)

    const headers = {
      ...cleanHeaders(customHeaders),
      'Content-Type': 'application/json',
      'User-Agent': 'Vigil-Webhook/1.0',
      'X-Vigil-Event': 'test',
      'X-Vigil-Delivery': `test-${Date.now()}`,
    }

    const startTime = Date.now()
    let response
    let error = null

    try {
      response = await fetch(checked.url.href, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      })
      // Drain without reading it into the reply.
      try {
        await response.body?.cancel()
      } catch {
        // ignore
      }
    } catch (fetchError) {
      error = fetchError?.name === 'TimeoutError' ? 'Timed out after 10 seconds' : 'Connection failed'
    }

    const redirected = !error && response && response.status >= 300 && response.status < 400
    if (redirected) error = 'The webhook answered with a redirect, which Vigil does not follow'

    return jsonResponse({
      success: !error && !!response?.ok,
      url: checked.url.origin + checked.url.pathname,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      request: {
        method: 'POST',
        headers: Object.keys(headers),
        payload_type: payloadType,
      },
      response: response && !error ? { status: response.status, statusText: response.statusText } : null,
      error,
    })
  } catch (err) {
    console.error('Webhook test error:', err?.message)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * Build test payload based on webhook type
 */
function buildTestPayload(type) {
  const basePayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    source: 'vigil',
    data: {
      message: 'This is a test webhook delivery from Vigil',
      test_id: `test-${Date.now()}`,
    },
  }

  switch (type) {
    case 'slack':
      return {
        text: '🧪 *Vigil Webhook Test*\nThis is a test message to verify your Slack webhook integration.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🧪 *Vigil Webhook Test*\n\nThis is a test message to verify your Slack webhook integration is working correctly.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent at: ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      }

    case 'discord':
      return {
        content: '🧪 **Vigil Webhook Test**',
        embeds: [
          {
            title: 'Test Message',
            description: 'This is a test message to verify your Discord webhook integration is working correctly.',
            color: 0x00d4ff, // Cyan
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Vigil Threat Intelligence',
            },
          },
        ],
      }

    case 'teams':
      return {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '00d4ff',
        summary: 'Vigil Webhook Test',
        sections: [
          {
            activityTitle: '🧪 Vigil Webhook Test',
            activitySubtitle: new Date().toISOString(),
            text: 'This is a test message to verify your Microsoft Teams webhook integration is working correctly.',
          },
        ],
      }

    default:
      return basePayload
  }
}
