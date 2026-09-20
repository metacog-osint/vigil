/**
 * Unit tests for the dashboard module.
 *
 * The rule these tests protect: a count the database did not return is null,
 * never 0. supabase-js resolves rather than throws, so a failed count arrives
 * as { count: undefined, error } - and `|| 0` would turn that absence into
 * "0 KEV Vulnerabilities", a figure the database never gave us. The landing
 * page and the dashboard both render null as an em dash.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Each from() call in getOverview is answered in order from this queue.
const queue = []

vi.mock('../client', () => {
  const makeQuery = () => {
    const outcome = queue.shift() ?? { count: 0, error: null }
    const query = {
      select: vi.fn(() => query),
      gte: vi.fn(() => query),
      not: vi.fn(() => query),
      then: (resolve, reject) => Promise.resolve(outcome).then(resolve, reject),
    }
    return query
  }
  return { supabase: { from: vi.fn(() => makeQuery()) } }
})

import { dashboard } from '../dashboard'

const ok = (n) => ({ count: n, error: null })
// What supabase-js actually hands back on a 500: it resolves, with no count.
const failed = { count: undefined, error: { message: 'statement timeout' } }

describe('dashboard.getOverview', () => {
  beforeEach(() => {
    queue.length = 0
  })

  it('returns the counts the database gave', async () => {
    queue.push(ok(4510), ok(974), ok(39499), ok(1825), ok(568510))
    const stats = await dashboard.getOverview()
    expect(stats).toEqual({
      totalActors: 4510,
      incidents30d: 974,
      incidentsTotal: 39499,
      kevTotal: 1825,
      iocTotal: 568510,
    })
  })

  it('reports a failed count as null rather than 0', async () => {
    // The KEV count is the one that 500s in practice.
    queue.push(ok(4510), ok(974), ok(39499), failed, ok(568510))
    const stats = await dashboard.getOverview()
    expect(stats.kevTotal).toBeNull()
    expect(stats.kevTotal).not.toBe(0)
    // One failure must not take the other figures down with it.
    expect(stats.totalActors).toBe(4510)
    expect(stats.iocTotal).toBe(568510)
  })

  it('reports a missing count as null even when no error is set', async () => {
    queue.push(ok(4510), ok(974), ok(39499), { count: null, error: null }, ok(568510))
    const stats = await dashboard.getOverview()
    expect(stats.kevTotal).toBeNull()
  })

  it('preserves a genuine zero', async () => {
    // A real 0 is a fact and must survive - it is only absence that becomes null.
    queue.push(ok(4510), ok(0), ok(39499), ok(1825), ok(568510))
    const stats = await dashboard.getOverview()
    expect(stats.incidents30d).toBe(0)
  })

  it('does not expose the mislabelled legacy aliases', async () => {
    queue.push(ok(4510), ok(974), ok(39499), ok(1825), ok(568510))
    const stats = await dashboard.getOverview()
    // incidents24h held 30-day data and newKEV7d held the all-time total.
    expect(stats).not.toHaveProperty('incidents24h')
    expect(stats).not.toHaveProperty('newKEV7d')
  })
})
