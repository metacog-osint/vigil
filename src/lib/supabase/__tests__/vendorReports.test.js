/**
 * The vendor-research query layer.
 *
 * The first test asserts an absence: nothing here writes an attribution.
 * Migration 139 measured 279 vendor titles and found zero attributions a
 * parser could read, and the module's one write is a ruling on a proposed
 * link, through rule_vendor_actor_link (migration 156).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import { vendorReports, VENDOR_SOURCES, LINK_VERDICTS } from '../vendorReports'

function stubQuery(result) {
  const chain = {}
  for (const method of ['select', 'eq', 'not', 'order', 'range', 'ilike', 'in', 'limit']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('nothing here writes an attribution', () => {
  it('has no method that sets, applies or infers one', () => {
    expect(Object.keys(vendorReports).filter((k) => /attribut|country|infer/i.test(k))).toEqual([])
  })

  it('rules on a link through the function, and never sends who decided', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null })

    await vendorReports.ruleLink({
      reportId: 'r-1',
      actorId: 'a-1',
      verdict: 'rejected',
      rationale: 'A phrase, not a group.',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('rule_vendor_actor_link', {
      p_report_id: 'r-1',
      p_actor_id: 'a-1',
      p_verdict: 'rejected',
      p_rationale: 'A phrase, not a group.',
    })
    const params = supabase.rpc.mock.calls[0][1]
    expect(Object.keys(params).some((k) => /decided|user|by/i.test(k))).toBe(false)
  })

  it('offers the same three rulings record_verdict does', () => {
    expect(Object.keys(LINK_VERDICTS)).toEqual(['confirmed', 'rejected', 'deferred'])
  })
})

describe('getReports', () => {
  it('pages newest first with a database count', async () => {
    const chain = stubQuery({ data: [], count: 377, error: null })
    supabase.from.mockReturnValue(chain)

    const { data } = await vendorReports.getReports({ page: 2, pageSize: 25 })

    expect(chain.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' })
    expect(chain.range).toHaveBeenCalledWith(50, 74)
    expect(data.total).toBe(377)
  })

  it('keeps only linked reports through an inner join when asked', async () => {
    const chain = stubQuery({ data: [], count: 23, error: null })
    supabase.from.mockReturnValue(chain)

    await vendorReports.getReports({ linkedOnly: true })
    expect(chain.select.mock.calls[0][0]).toMatch(/vendor_report_actors!inner/)

    await vendorReports.getReports({ linkedOnly: false })
    expect(chain.select.mock.calls[1][0]).not.toMatch(/!inner/)
  })

  it('filters by vendor and title', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await vendorReports.getReports({ source: 'talos', search: '  Lazarus ' })

    expect(chain.eq).toHaveBeenCalledWith('source', 'talos')
    expect(chain.ilike).toHaveBeenCalledWith('title', '%Lazarus%')
  })

  it('passes a failure through rather than an empty page', async () => {
    supabase.from.mockReturnValue(stubQuery({ data: null, count: null, error: { message: 'x' } }))
    const { data, error } = await vendorReports.getReports()
    expect(data).toBeNull()
    expect(error.message).toBe('x')
  })
})

describe('getOverview', () => {
  it('counts in the database and reports a failed count as null', async () => {
    const counts = {
      vendor_reports: 377,
      vendor_report_actors: 27,
      data_quality_findings: 12,
    }
    supabase.from.mockImplementation((table) =>
      stubQuery(
        table === 'data_quality_findings'
          ? { count: null, error: { message: 'denied' } }
          : { count: counts[table], error: null }
      )
    )

    const { data } = await vendorReports.getOverview()

    expect(data.reports).toBe(377)
    expect(data.links).toBe(27)
    expect(data.questionsOpen).toBeNull()
    expect(Object.keys(data.bySource)).toEqual(Object.keys(VENDOR_SOURCES))
    for (const call of supabase.from.mock.results) {
      const select = call.value.select.mock.calls[0]
      expect(select[1]).toEqual({ count: 'exact', head: true })
    }
  })
})

describe('getLatestRulings', () => {
  it('keeps the newest ruling per link, deferrals included', async () => {
    supabase.from.mockReturnValue(
      stubQuery({
        data: [
          {
            report_id: 'r',
            actor_id: 'a',
            verdict: 'deferred',
            decided_at: '2026-10-27T01:00:00Z',
          },
          {
            report_id: 'r',
            actor_id: 'a',
            verdict: 'confirmed',
            decided_at: '2026-10-26T01:00:00Z',
          },
        ],
        error: null,
      })
    )

    const { data } = await vendorReports.getLatestRulings(['r'])

    expect(data['r:a'].verdict).toBe('deferred')
  })

  it('asks for nothing when there are no reports', async () => {
    const { data } = await vendorReports.getLatestRulings([])
    expect(data).toEqual({})
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('getOpenQuestions', () => {
  it('keys the open attribution questions by the report url they ask about', async () => {
    const chain = stubQuery({
      data: [{ id: 'f-1', subject: 'https://x/report', details: { phrase: 'China-nexus' } }],
      error: null,
    })
    supabase.from.mockReturnValue(chain)

    const { data } = await vendorReports.getOpenQuestions(['https://x/report'])

    expect(chain.eq).toHaveBeenCalledWith('check_name', 'vendor_attribution_candidate')
    expect(chain.eq).toHaveBeenCalledWith('status', 'open')
    expect(data['https://x/report']).toEqual({ id: 'f-1', phrase: 'China-nexus' })
  })
})
