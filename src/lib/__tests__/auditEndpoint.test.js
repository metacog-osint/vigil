// @vitest-environment node
/**
 * POST /api/audit (finding audit_log_trust, migration 171). The rule under test:
 * the subject of an audit entry does not write its own record. Who acted comes
 * from the verified token, where from from the request, and nothing in the body
 * can say otherwise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../api/_lib/supabase-auth.js', () => ({
  verifyRequest: vi.fn(),
}))
vi.mock('../../../api/_lib/audit.js', () => ({
  logAuditEvent: vi.fn(),
}))
vi.mock('../../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}))

const { verifyRequest } = await import('../../../api/_lib/supabase-auth.js')
const { logAuditEvent } = await import('../../../api/_lib/audit.js')
const { checkRateLimit } = await import('../../../api/_lib/rateLimit.js')
const { default: handler, parseAuditBody } = await import('../../../api/audit.js')

function post(body, headers = {}) {
  return new Request('https://vigil.theintelligence.company/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('parseAuditBody', () => {
  it('keeps the event fields and drops identity and client fields', () => {
    const { entry } = parseAuditBody({
      eventType: 'export.csv',
      action: 'export',
      resourceType: 'incidents',
      metadata: { count: 3 },
      userId: 'someone-else',
      userEmail: 'x@example.com',
      ipAddress: '10.0.0.1',
      userAgent: 'forged',
      teamId: 'another-team',
    })
    expect(entry).toEqual({
      eventType: 'export.csv',
      eventCategory: 'export',
      action: 'export',
      resourceType: 'incidents',
      resourceId: null,
      resourceName: null,
      description: null,
      details: { count: 3 },
      status: 'success',
      errorMessage: null,
    })
  })

  it('refuses an event type that is not category.action', () => {
    expect(parseAuditBody({ eventType: 'DROP TABLE' }).error).toMatch(/eventType/)
    expect(parseAuditBody({}).error).toMatch(/eventType/)
  })

  it('refuses an unknown status and oversized metadata', () => {
    expect(parseAuditBody({ eventType: 'a.b', status: 'fine' }).error).toMatch(/status/)
    const big = { blob: 'x'.repeat(5000) }
    expect(parseAuditBody({ eventType: 'a.b', metadata: big }).error).toMatch(/too large/)
  })
})

describe('POST /api/audit', () => {
  beforeEach(() => {
    vi.mocked(verifyRequest).mockReset()
    vi.mocked(logAuditEvent).mockReset()
    vi.mocked(checkRateLimit).mockClear()
  })

  it('writes the entry under the verified user, whatever the body says', async () => {
    vi.mocked(verifyRequest).mockResolvedValue({
      user: { id: 'u-verified', email: 'analyst@example.com' },
      error: null,
    })
    vi.mocked(logAuditEvent).mockResolvedValue({ success: true, id: 'a1' })

    const res = await handler(post({ eventType: 'entity.viewed', userId: 'u-forged' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'a1' })

    const call = vi.mocked(logAuditEvent).mock.calls[0][0]
    expect(call.userId).toBe('u-verified')
    expect(call.userEmail).toBe('analyst@example.com')
    expect(call.request).toBeInstanceOf(Request)
    expect(call).not.toHaveProperty('teamId')
  })

  it('writes nothing without a valid token', async () => {
    vi.mocked(verifyRequest).mockResolvedValue({ user: null, error: 'Invalid or expired token' })
    const res = await handler(post({ eventType: 'entity.viewed' }))
    expect(res.status).toBe(401)
    expect(logAuditEvent).not.toHaveBeenCalled()
  })

  it('writes nothing for a malformed body', async () => {
    vi.mocked(verifyRequest).mockResolvedValue({ user: { id: 'u' }, error: null })
    expect((await handler(post('not json'))).status).toBe(400)
    expect((await handler(post({ eventType: 'nope' }))).status).toBe(400)
    expect(logAuditEvent).not.toHaveBeenCalled()
  })

  it('says so when the write fails, rather than reporting success', async () => {
    vi.mocked(verifyRequest).mockResolvedValue({ user: { id: 'u' }, error: null })
    vi.mocked(logAuditEvent).mockResolvedValue({ success: false, error: 'denied' })
    expect((await handler(post({ eventType: 'entity.viewed' }))).status).toBe(502)
  })

  it('accepts POST only', async () => {
    const res = await handler(
      new Request('https://vigil.theintelligence.company/api/audit', { method: 'GET' })
    )
    expect(res.status).toBe(405)
  })
})
