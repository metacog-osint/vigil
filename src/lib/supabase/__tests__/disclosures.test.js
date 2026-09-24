/**
 * The disclosures query layer.
 *
 * The test that matters most here is the one asserting an absence: there is no
 * method that returns a single total of people affected, because Washington
 * counts its own residents and Oregon counts everyone worldwide. A method that
 * added them would produce 1.45 billion "people affected", and nobody reading
 * it would know the number was meaningless.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import { disclosures, DISCLOSURE_SOURCES, COUNT_SCOPES } from '../disclosures'

/** A chainable stub that resolves to whatever the test hands it. */
function stubQuery(result) {
  const chain = {}
  for (const method of ['select', 'order', 'range', 'eq', 'neq', 'not', 'ilike', 'gte', 'lte']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the count that means two different things', () => {
  it('does not expose any method that totals people affected', () => {
    const methods = Object.keys(disclosures)
    const summing = methods.filter((m) => /total(People|Affected|Persons)/i.test(m))
    expect(summing).toEqual([])
  })

  it('keeps the two state counts in separate fields', async () => {
    supabase.from.mockReturnValue(
      stubQuery({
        data: [
          {
            state: 'WA',
            notices: 1872,
            residents_affected: '49341395',
            people_affected_worldwide: null,
          },
          {
            state: 'OR',
            notices: 1639,
            residents_affected: null,
            people_affected_worldwide: '1397860427',
          },
        ],
        error: null,
      })
    )

    const { data } = await disclosures.totalsByState()
    const wa = data.find((r) => r.state === 'WA')
    const or = data.find((r) => r.state === 'OR')

    expect(wa.residents_affected).toBe(49341395)
    expect(wa.people_affected_worldwide).toBeNull()
    expect(or.people_affected_worldwide).toBe(1397860427)
    expect(or.residents_affected).toBeNull()
  })

  it('labels each state with the scope that makes its count readable', async () => {
    supabase.from.mockReturnValue(
      stubQuery({
        data: [
          { state: 'WA', residents_affected: '49341395', people_affected_worldwide: null },
          { state: 'OR', residents_affected: null, people_affected_worldwide: '1397860427' },
          { state: 'CA', residents_affected: null, people_affected_worldwide: null },
        ],
        error: null,
      })
    )

    const { data } = await disclosures.totalsByState()
    expect(data.find((r) => r.state === 'WA').scope).toBe('state_residents')
    expect(data.find((r) => r.state === 'OR').scope).toBe('total')
    expect(data.find((r) => r.state === 'CA').scope).toBeNull()
  })

  it('describes both scopes, so neither can be rendered bare', () => {
    expect(COUNT_SCOPES.state_residents.label).toMatch(/residents/i)
    expect(COUNT_SCOPES.total.label).toMatch(/worldwide/i)
    for (const scope of Object.values(COUNT_SCOPES)) {
      expect(scope.note.length).toBeGreaterThan(20)
    }
  })

  it('reads a bigint string as a number, and an unreadable one as null', async () => {
    supabase.from.mockReturnValue(
      stubQuery({
        data: [
          { state: 'WA', residents_affected: 'not a number', people_affected_worldwide: null },
        ],
        error: null,
      })
    )

    const { data } = await disclosures.totalsByState()
    expect(data[0].residents_affected).toBeNull()
  })
})

describe('getAll', () => {
  it('returns the matching total rather than the length of the page', async () => {
    supabase.from.mockReturnValue(stubQuery({ data: [{ id: 1 }], count: 8895, error: null }))

    const { data, count } = await disclosures.getAll({ limit: 1 })
    expect(data).toHaveLength(1)
    expect(count).toBe(8895)
  })

  it('reports a count the database did not return as null, never as zero', async () => {
    supabase.from.mockReturnValue(stubQuery({ data: [], count: null, error: null }))

    const { count } = await disclosures.getAll()
    expect(count).toBeNull()
  })

  it('passes the filters through', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await disclosures.getAll({ source: 'wa-ag', state: 'WA', search: 'acme', from: '2026-01-01' })

    expect(chain.eq).toHaveBeenCalledWith('source', 'wa-ag')
    expect(chain.eq).toHaveBeenCalledWith('state', 'WA')
    expect(chain.ilike).toHaveBeenCalledWith('company_name', '%acme%')
    expect(chain.gte).toHaveBeenCalledWith('filed_date', '2026-01-01')
  })
})

describe('getCoverage', () => {
  /**
   * These must be database counts, not a tally of returned rows. PostgREST
   * caps a plain select() at 1,000, and counting client-side reported "1,000
   * filings held" against a real 8,896 — and "0 carry a count" against 3,255,
   * because the first thousand rows were all Californian and California
   * publishes no counts. Both were rendered as fact.
   */
  it('asks the database to count, and never reads rows to do it', async () => {
    const chain = stubQuery({ count: 8896, error: null })
    supabase.from.mockReturnValue(chain)

    await disclosures.getCoverage()

    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    for (const call of chain.select.mock.calls) {
      expect(call[1]).toMatchObject({ head: true })
    }
  })

  it('returns each figure the database counted', async () => {
    supabase.from.mockReturnValue(stubQuery({ count: 42, error: null }))

    const { data } = await disclosures.getCoverage()
    expect(data).toEqual({
      total: 42,
      reviewed: 42,
      withCount: 42,
      withDataTypes: 42,
      withIncidentDate: 42,
    })
  })

  it('reports a figure the database could not return as null, not as zero', async () => {
    supabase.from.mockReturnValue(stubQuery({ count: null, error: { message: 'nope' } }))

    const { data } = await disclosures.getCoverage()
    expect(data.total).toBeNull()
    expect(data.withCount).toBeNull()
  })

  it('excludes an unreviewed filing from the ruled-on figure', async () => {
    const chain = stubQuery({ count: 16, error: null })
    supabase.from.mockReturnValue(chain)

    await disclosures.getCoverage()

    expect(chain.neq).toHaveBeenCalledWith('match_status', 'unreviewed')
  })
})

describe('countsBySource', () => {
  it('counts each registry in the database rather than tallying rows', async () => {
    const chain = stubQuery({ count: 5302, error: null })
    supabase.from.mockReturnValue(chain)

    const { data } = await disclosures.countsBySource()

    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(data.every((row) => row.notices === 5302)).toBe(true)
  })

  it('surfaces the error rather than reporting a short count', async () => {
    supabase.from.mockReturnValue(stubQuery({ count: null, error: { message: 'nope' } }))

    const { data, error } = await disclosures.countsBySource()
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})

describe('the registries', () => {
  it('records what each one does and does not count', () => {
    expect(DISCLOSURE_SOURCES['wa-ag'].countScope).toBe('state_residents')
    expect(DISCLOSURE_SOURCES['or-ag'].countScope).toBe('total')
    // California publishes no count at all, and SEC filings are not about a state.
    expect(DISCLOSURE_SOURCES['ca-ag'].countScope).toBeNull()
    expect(DISCLOSURE_SOURCES['sec-edgar'].countScope).toBeNull()
  })

  it('names the authority for every registry, so a filing can be attributed', () => {
    for (const meta of Object.values(DISCLOSURE_SOURCES)) {
      expect(meta.authority).toBeTruthy()
      expect(meta.label).toBeTruthy()
    }
  })
})
