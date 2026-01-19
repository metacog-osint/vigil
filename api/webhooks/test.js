/**
 * Webhook Test API
 *
 * Sends a test payload to the specified webhook URL
 * to verify configuration is correct.
 */
import { validateApiKey, jsonResponse, errorResponse } from '../_lib/auth.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  // Only allow POST
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Validate API key or session
  const auth = await validateApiKey(request)
  if (!auth) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body = await request.json()
    const { url, type = 'generic', headers: customHeaders = {} } = body

    if (!url) {
      return errorResponse('Webhook URL is required', 400)
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return errorResponse('Invalid webhook URL', 400)
    }

    // Build test payload based on webhook type
    const testPayload = buildTestPayload(type)

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Vigil-Webhook/1.0',
      'X-Vigil-Event': 'test',
      'X-Vigil-Delivery': `test-${Date.now()}`,
      ...customHeaders,
    }

    // Send the test webhook
    const startTime = Date.now()
    let response
    let responseBody
    let error = null

    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      // Try to read response body
      try {
        responseBody = await response.text()
        // Try to parse as JSON
        try {
          responseBody = JSON.parse(responseBody)
        } catch {
          // Keep as text
        }
      } catch {
        responseBody = null
      }
    } catch (fetchError) {
      error = fetchError.message || 'Connection failed'
    }

    const duration = Date.now() - startTime

    // Build result
    const result = {
      success: !error && response?.ok,
      url,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      request: {
        method: 'POST',
        headers: Object.keys(headers),
        payload_type: type,
      },
      response: error ? null : {
        status: response?.status,
        statusText: response?.statusText,
        body: responseBody,
      },
      error,
    }

    return jsonResponse(result)

  } catch (err) {
    console.error('Webhook test error:', err)
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
