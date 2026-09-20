/**
 * Unit tests for the landing module.
 *
 * The landing page is public and is the first thing a visitor sees, so the rule
 * these tests protect is: show what the database holds, or show nothing. Never a
 * placeholder figure that could be mistaken for real data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const results = {}

vi.mock('../client', () => {
  const makeQuery = (table) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      not: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: (resolve, reject) => {
        const outcome = results[table]
        if (outcome instanceof Error) return Promise.reject(outcome).then(resolve, reject)
        return Promise.resolve(outcome || { data: [], error: null }).then(resolve, reject)
      },
    }
    return query
  }
  return { supabase: { from: vi.fn((table) => makeQuery(table)) } }
})

const getOverview = vi.fn()
vi.mock('../dashboard', () => ({ dashboard: { getOverview: () => getOverview() } }))

import { landing } from '../landing'

describe('landing module', () => {
  beforeEach(() => {
    for (const key of Object.keys(results)) delete results[key]
    getOverview.mockReset()
    getOverview.mockResolvedValue({
      totalActors: 4510,
      incidents30d: 974,
      kevTotal: 1825,
      iocTotal: 568510,
    })
  })

  it('returns the live counts for the stat cards', async () => {
    const snapshot = await landing.getSnapshot()

    expect(snapshot.stats.totalActors).toBe(4510)
    expect(snapshot.stats.iocTotal).toBe(568510)
  })

  it('flattens the incident actor for display', async () => {
    results.incidents = {
      data: [
        {
          id: 'i1',
          victim_name: 'Quy Nhon University',
          victim_sector: 'education',
          victim_country: null,
          discovered_date: '2026-09-19',
          threat_actor: { name: 'vexy' },
        },
      ],
      error: null,
    }

    const { incidents } = await landing.getSnapshot()

    expect(incidents[0]).toMatchObject({
      victim: 'Quy Nhon University',
      actor: 'vexy',
      sector: 'education',
      country: null,
    })
  })

  it('names the affected product from the KEV description', async () => {
    results.vulnerabilities = {
      data: [
        {
          cve_id: 'CVE-2025-39964',
          kev_date: '2026-09-18',
          epss_score: null,
          description: 'Linux Kernel contains a race condition vulnerability which allows access',
          ransomware_use: null,
          ransomware_campaign_use: true,
        },
      ],
      error: null,
    }

    const { kev } = await landing.getSnapshot()

    expect(kev[0].subject).toBe('Linux Kernel')
    expect(kev[0].ransomware).toBe(true)
    expect(kev[0].epss).toBeNull()
  })

  it('returns an empty section rather than inventing rows when a query fails', async () => {
    results.threat_actors = { data: null, error: { message: 'boom' } }
    results.incidents = new Error('network')

    const snapshot = await landing.getSnapshot()

    expect(snapshot.escalating).toEqual([])
    expect(snapshot.incidents).toEqual([])
    // The sections that did load are unaffected
    expect(snapshot.stats.totalActors).toBe(4510)
  })

  it('leaves stats null when the overview fails, so no figure is shown', async () => {
    getOverview.mockRejectedValue(new Error('timeout'))

    const snapshot = await landing.getSnapshot()

    expect(snapshot.stats).toBeNull()
  })
})
