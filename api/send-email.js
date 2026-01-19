/**
 * Send Email API Endpoint
 * Securely sends emails via Resend API without exposing API key to frontend
 *
 * POST /api/send-email
 * Body: { to, subject, html, text, template?, data? }
 * Headers: Authorization: Bearer <firebase-id-token>
 */

import { verifyRequest } from './_lib/supabase-auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from './_lib/cors.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@vigil.theintelligence.company'
const FROM_NAME = 'Vigil Alerts'

// Rate limit: 10 emails per minute per user
const rateLimitMap = new Map()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

function checkRateLimit(userId) {
  const now = Date.now()
  const userKey = `email:${userId}`
  const userRequests = rateLimitMap.get(userKey) || []

  // Clean old requests
  const validRequests = userRequests.filter((time) => now - time < RATE_WINDOW_MS)

  if (validRequests.length >= RATE_LIMIT) {
    return false
  }

  validRequests.push(now)
  rateLimitMap.set(userKey, validRequests)
  return true
}

export default async function handler(request) {
  const origin = request.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(request)
  if (preflightResponse) {
    return preflightResponse
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Verify Firebase token
  const { user, error: authError } = await verifyRequest(request)
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Check rate limit
  if (!checkRateLimit(user.uid)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 10 emails per minute.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders,
      },
    })
  }

  // Check API key configured
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const body = await request.json()
    const { to, subject, html, text } = body

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, and html or text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Validate email format
    const emails = Array.isArray(to) ? to : [to]
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: `Invalid email address: ${email}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
    }

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: emails,
        subject,
        html,
        text,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', data)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error) {
    console.error('Email send error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
