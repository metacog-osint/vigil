/**
 * The Upper Midwest watch pack's query layer.
 *
 * What matters: each lane places an organization by its own field, every
 * figure is a database count, nothing totals people affected, and leak-site
 * claims are only ever matched by an exact name or by their own text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import { upperMidwest, placedIn, UPPER_MIDWEST_CODES } from '../upperMidwest'

const METHODS = ['select', 'order', 'range', 'eq', 'like', 'ilike', 'in', 'or', 'gte', 'limit']

/** A chainable stub that records its calls and resolves to `result`. */
function stubQuery(result) {
  const chain = { calls: [] }
  for (const m of METHODS) {
    chain[m] = vi.fn((...args) => {
      chain.calls.push([m, ...args])
      return chain
    })
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rules carried from disclosures.js', () => {
  it('has no method that totals people affected', () => {
    const summing = Object.keys(upperMidwest).filter((m) =>
      /total(People|Affected|Persons)|affected/i.test(m)
    )
    expect(summing).toEqual([])
  })

  it('counts with head: true, never by reading rows', async () => {
    const chains = []
    supabase.from.mockImplementation(() => {
      const c = stubQuery({ count: 7, error: null })
      chains.push(c)
      return c
    })

    const { data } = await upperMidwest.getCounts({ now: new Date('2026-11-20T00:00:00Z') })

    expect(data).toHaveLength(5)
    expect(data[0]).toMatchObject({ state: 'MN', hhs: 7, hhsYear: 7, sec: 7, claimsText: 7 })
    for (const c of chains) {
      const select = c.calls.find((x) => x[0] === 'select')
      expect(select[2]).toEqual({ count: 'exact', head: true })
    }
  })

  it('keeps a count the database did not return as null', async () => {
    supabase.from.mockImplementation(() => stubQuery({ count: null, error: { message: 'x' } }))
    const { data } = await upperMidwest.getCounts()
    expect(data[0].hhs).toBeNull()
  })
})

describe('placement by each lane’s own field', () => {
  it('places HHS by business_location equal to the code, SEC by ", ST"', async () => {
    const chains = []
    supabase.from.mockImplementation(() => {
      const c = stubQuery({ count: 1, error: null })
      chains.push(c)
      return c
    })
    await upperMidwest.getCounts({ now: new Date('2026-11-20T00:00:00Z') })

    const mn = chains.slice(0, 4)
    expect(mn[0].calls).toContainEqual(['eq', 'source', 'hhs-ocr'])
    expect(mn[0].calls).toContainEqual(['eq', 'business_location', 'MN'])
    expect(mn[1].calls).toContainEqual(['gte', 'filed_date', '2025-11-20'])
    expect(mn[2].calls).toContainEqual(['eq', 'source', 'sec-edgar'])
    expect(mn[2].calls).toContainEqual(['like', 'business_location', '%, MN'])
    expect(mn[3].calls).toContainEqual(['ilike', 'raw_data->>description', '%Minnesota%'])
  })

  it('never uses a state AG registry’s own state', async () => {
    const c = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(c)
    await upperMidwest.getFilings({ lane: 'hhs-ocr' })
    expect(c.calls.some((x) => x[1] === 'state')).toBe(false)
    expect(c.calls).toContainEqual(['in', 'business_location', UPPER_MIDWEST_CODES])
  })

  it('pages SEC filings with an or() of ", ST" suffixes', async () => {
    const c = stubQuery({
      data: [{ id: 1, source: 'sec-edgar', business_location: 'Eau Claire, WI' }],
      count: 1,
      error: null,
    })
    supabase.from.mockReturnValue(c)
    const res = await upperMidwest.getFilings({ lane: 'sec-edgar', state: 'WI' })
    expect(c.calls).toContainEqual(['or', 'business_location.like."*, WI"'])
    expect(res.count).toBe(1)
    expect(res.data[0].placed_in).toBe('WI')
  })

  it('returns nothing for a state outside the five', async () => {
    const res = await upperMidwest.getFilings({ state: 'CA' })
    expect(res).toEqual({ data: [], count: 0, error: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('reads the state from each lane’s field', () => {
    expect(placedIn({ source: 'hhs-ocr', business_location: 'ND' })).toBe('ND')
    expect(placedIn({ source: 'sec-edgar', business_location: 'Minneapolis, MN' })).toBe('MN')
    expect(placedIn({ source: 'sec-edgar', business_location: 'Chicago, IL' })).toBeNull()
  })
})

describe('leak-site claims', () => {
  it('matches by exact name only, in chunks, and names the filing it matched', async () => {
    const names = Array.from({ length: 45 }, (_, i) => ({
      company_name: `Org ${i}`,
      source: 'hhs-ocr',
      business_location: 'SD',
    }))
    const nameChains = []
    supabase.from.mockImplementation((table) => {
      if (table === 'victim_disclosures') {
        const c = stubQuery({ data: names, error: null })
        return c
      }
      const c = stubQuery({
        data: nameChains.length === 0 ? [{ id: 'a', victim_name: 'Org 3' }] : [],
        error: null,
      })
      nameChains.push(c)
      return c
    })

    const { data } = await upperMidwest.getClaimsSameName({ state: 'SD' })

    expect(nameChains).toHaveLength(2) // 45 names, 40 a request
    expect(nameChains[0].calls.find((x) => x[0] === 'in')[2]).toHaveLength(40)
    expect(nameChains[0].calls.some((x) => x[0] === 'ilike')).toBe(false)
    expect(data).toEqual([
      { id: 'a', victim_name: 'Org 3', matched: [{ source: 'hhs-ocr', state: 'SD' }] },
    ])
  })

  it('lists a claim whose text names two states once, with both', async () => {
    supabase.from.mockImplementation(() =>
      stubQuery({
        data: [{ id: 'x', victim_name: 'V', discovered_date: '2026-10-01' }],
        error: null,
      })
    )
    const { data } = await upperMidwest.getClaimsNamingState()
    expect(data).toHaveLength(1)
    expect(data[0].states_named).toEqual(UPPER_MIDWEST_CODES)
  })

  it('reports an error instead of an empty list', async () => {
    supabase.from.mockImplementation(() => stubQuery({ data: null, error: { message: 'denied' } }))
    const res = await upperMidwest.getClaimsNamingState({ state: 'MN' })
    expect(res.data).toBeNull()
    expect(res.error.message).toBe('denied')
  })
})
