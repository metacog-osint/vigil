// @vitest-environment node
/**
 * /api/send-email mails only the caller's own confirmed address
 * from server templates, and /api/webhooks/test sends only to public https
 * hosts and never hands back what the far end replied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'placeholder-not-a-key'
})
vi.mock('../../../api/_lib/supabase-auth.js', () => ({ verifyRequest: vi.fn() }))
// auth.js builds a service-role client at import; the endpoint only needs its helpers.
vi.mock('../../../api/_lib/auth.js', async () => {
  const rate = await import('../../../api/_lib/rateLimit.js')
  const respond = (data, status) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  return {
    checkRateLimit: rate.checkRateLimit,
    jsonResponse: (data, status = 200) => respond(data, status),
    errorResponse: (message, status = 400) => respond({ error: message }, status),
  }
})

import { verifyRequest } from '../../../api/_lib/supabase-auth.js'
import { checkOutboundUrl } from '../../../api/_lib/outboundUrl.js'
import sendEmail, { recipientFor, TEMPLATES } from '../../../api/send-email.js'
import webhookTest from '../../../api/webhooks/test.js'

const post = (url, body) =>
  new Request(url, {
    method: 'POST',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('checkOutboundUrl', () => {
  it.each([
    'https://hooks.slack.com/services/T/B/x',
    'https://discord.com/api/webhooks/1/abc',
    'https://example.com:8443/hook',
    'https://8.8.8.8/hook',
    'https://[2606:4700::1111]/hook',
  ])('allows %s', (u) => {
    expect(checkOutboundUrl(u).ok).toBe(true)
  })

  it.each([
    'http://example.com/hook',
    'ftp://example.com/',
    'https://user:pw@example.com/',
    'https://example.com:22/',
    'https://localhost/',
    'https://api.localhost/',
    'https://printer.local/',
    'https://metadata.google.internal/',
    'https://intranet/',
    'https://127.0.0.1/',
    'https://2130706433/',
    'https://0x7f.1/',
    'https://10.1.2.3/',
    'https://172.20.0.1/',
    'https://192.168.1.1/',
    'https://169.254.169.254/latest/meta-data/',
    'https://100.64.0.1/',
    'https://0.0.0.0/',
    'https://[::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:a9fe:a9fe]/',
    'https://[fd00::1]/',
    'https://[fe80::1]/',
    'not a url',
    '',
    42,
  ])('refuses %s', (u) => {
    expect(checkOutboundUrl(u).ok).toBe(false)
  })
})

describe('/api/send-email', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    verifyRequest.mockReset()
  })

  it('sends only to a confirmed address of the caller', () => {
    expect(recipientFor({ email: 'a@b.co', email_confirmed_at: '2026-01-01' })).toBe('a@b.co')
    expect(recipientFor({ email: 'a@b.co', email_confirmed_at: null })).toBeNull()
    expect(recipientFor({ email: '', email_confirmed_at: '2026-01-01' })).toBeNull()
  })

  it('has only server-side templates', () => {
    expect(Object.keys(TEMPLATES)).toEqual(['test'])
  })

  it('ignores a client-chosen recipient, subject and body', async () => {
    verifyRequest.mockResolvedValue({
      user: { id: 'u1', email: 'me@example.com', email_confirmed_at: '2026-01-01' },
      error: null,
    })
    const res = await sendEmail(
      post('https://vigil.test/api/send-email', {
        to: 'victim@example.org',
        subject: 'Reset your password',
        html: '<a href="https://evil.example">x</a>',
      })
    )
    expect(res.status).toBe(400)
  })

  it('sends the server template to the caller even when the body names someone else', async () => {
    verifyRequest.mockResolvedValue({
      user: { id: 'u3', email: 'me@example.com', email_confirmed_at: '2026-01-01' },
      error: null,
    })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'm1' }), { status: 200 }))
    const res = await sendEmail(
      post('https://vigil.test/api/send-email', {
        template: 'test',
        to: 'victim@example.org',
        subject: 'Reset your password',
        html: '<a href="https://evil.example">x</a>',
      })
    )
    expect(res.status).toBe(200)
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(sent.to).toEqual(['me@example.com'])
    expect(sent.subject).toBe('Vigil: test email')
    expect(sent.html).not.toContain('evil.example')
  })

  it('refuses an account with no confirmed address', async () => {
    verifyRequest.mockResolvedValue({ user: { id: 'u2', email: 'x@example.com' }, error: null })
    const res = await sendEmail(post('https://vigil.test/api/send-email', { template: 'test' }))
    expect(res.status).toBe(403)
  })
})

describe('/api/webhooks/test', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    verifyRequest.mockReset()
  })

  it('needs a signed-in session', async () => {
    verifyRequest.mockResolvedValue({ user: null, error: 'Missing authorization header' })
    const res = await webhookTest(
      post('https://vigil.test/api/webhooks/test', { url: 'https://example.com/' })
    )
    expect(res.status).toBe(401)
  })

  it('refuses a private host before sending anything', async () => {
    verifyRequest.mockResolvedValue({ user: { id: 'w1' }, error: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await webhookTest(
      post('https://vigil.test/api/webhooks/test', {
        url: 'https://169.254.169.254/latest/meta-data/',
      })
    )
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports the status but never the reply body, and does not follow redirects', async () => {
    verifyRequest.mockResolvedValue({ user: { id: 'w2' }, error: null })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('secret page contents', { status: 200, statusText: 'OK' }))
    const res = await webhookTest(
      post('https://vigil.test/api/webhooks/test', {
        url: 'https://example.com/hook?token=abc',
        type: 'slack',
        headers: { Host: 'internal', 'X-Token': 'v' },
      })
    )
    const out = await res.json()
    expect(res.status).toBe(200)
    expect(out.success).toBe(true)
    expect(out.response).toEqual({ status: 200, statusText: 'OK' })
    expect(JSON.stringify(out)).not.toContain('secret page contents')
    expect(out.url).toBe('https://example.com/hook')
    const [, init] = fetchSpy.mock.calls[0]
    expect(init.redirect).toBe('manual')
    expect(init.headers.Host).toBeUndefined()
    expect(init.headers['X-Token']).toBe('v')
  })

  it('treats a redirect as a failure', async () => {
    verifyRequest.mockResolvedValue({ user: { id: 'w3' }, error: null })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } })
    )
    const out = await (
      await webhookTest(
        post('https://vigil.test/api/webhooks/test', { url: 'https://example.com/hook' })
      )
    ).json()
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/redirect/)
  })
})
