/**
 * Send Email API Endpoint
 *
 * POST /api/send-email
 * Body: { template, data? }
 * Headers: Authorization: Bearer <supabase-access-token>
 *
 * ideas#155: mail goes only to the caller's own confirmed address, the
 * subject and body come from the server templates below, and the shared
 * rate limit (Redis when configured) applies. The client cannot set `to`,
 * `subject` or `html`, so the endpoint cannot relay mail from Vigil's domain.
 */

import { verifyRequest } from './_lib/supabase-auth.js'
import { getCorsHeaders, handleCorsPreflightRequest } from './_lib/cors.js'
import { checkRateLimit, checkDailyRateLimit } from './_lib/rateLimit.js'

// Web-standard handler (Request in, Response out) requires the Edge runtime
export const config = { runtime: 'edge' }

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@vigil.theintelligence.company'
const FROM_NAME = 'Vigil Alerts'

export const EMAIL_LIMIT_PER_MINUTE = 3
export const EMAIL_LIMIT_PER_DAY = 20

export const TEMPLATES = {
  test: () => ({
    subject: 'Vigil: test email',
    text:
      'This is a test email from Vigil. Alert emails for your account will arrive at this address.\n\n' +
      'You asked for it from your Vigil settings. If you did not, you can ignore this message.',
    html:
      '<p>This is a test email from Vigil. Alert emails for your account will arrive at this address.</p>' +
      '<p>You asked for it from your Vigil settings. If you did not, you can ignore this message.</p>',
  }),
}

/** The one address mail may go to: the caller's own, once confirmed. */
export function recipientFor(user) {
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at)
  if (!email || !confirmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
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

  // Verify Supabase token
  const { user, error: authError } = await verifyRequest(request)
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const to = recipientFor(user)
  if (!to) {
    return new Response(JSON.stringify({ error: 'Your account has no confirmed email address' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const minute = await checkRateLimit(`email:${user.id}`, EMAIL_LIMIT_PER_MINUTE)
  const day = minute.allowed ? await checkDailyRateLimit(`email:${user.id}`, EMAIL_LIMIT_PER_DAY) : { allowed: false }
  if (!minute.allowed || !day.allowed) {
    return new Response(JSON.stringify({ error: 'Too many emails. Try again later.' }), {
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
    const body = await request.json().catch(() => ({}))
    const build = Object.prototype.hasOwnProperty.call(TEMPLATES, body?.template) ? TEMPLATES[body.template] : null
    if (!build) {
      return new Response(JSON.stringify({ error: `Unknown template. Known: ${Object.keys(TEMPLATES).join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const { subject, html, text } = build(body?.data)

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
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
