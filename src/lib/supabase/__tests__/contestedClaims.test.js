/**
 * The contested-claims query layer.
 *
 * Two of these tests assert an absence, which is the point of the module:
 *
 *   there is no method that returns a single value for a contested claim,
 *   because picking one is what the table exists to record rather than do;
 *
 *   and every coverage figure is a database count with `head: true`, because
 *   counting client-side hits PostgREST's 1,000-row cap and this repository
 *   has already shipped that defect once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import {
  contestedClaims,
  EVIDENCE_TIERS,
  MEASUREMENTS,
  RESOLUTIONS,
  VERIFICATION_STATES,
} from '../contestedClaims'

/** A chainable stub that resolves to whatever the test hands it. */
function stubQuery(result) {
  const chain = {}
  for (const method of [
    'select',
    'order',
    'range',
    'eq',
    'neq',
    'not',
    'is',
    'gte',
    'lte',
    'maybeSingle',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the module refuses to resolve a claim', () => {
  it('exposes no method that returns one value for a contested claim', () => {
    const deciding = Object.keys(contestedClaims).filter((m) =>
      /best|preferred|resolve|winner|consensus|pick/i.test(m)
    )
    expect(deciding).toEqual([])
  })

  it('carries the human ruling through instead, untouched', async () => {
    supabase.from.mockReturnValue(
      stubQuery({
        data: [
          {
            claim_key: 'global_crypto_scam_losses_2025',
            resolution: 'present_both',
            handling:
              '"$14 billion measured, projected above $17 billion." Never present the projection alone.',
            decided_by: 'a person',
            values_recorded: 3,
            distinct_origins: 1,
          },
        ],
        count: 1,
        error: null,
      })
    )

    const { data } = await contestedClaims.getAll()
    expect(data[0].handling).toContain('Never present the projection alone')
    expect(data[0].decided_by).toBe('a person')
  })
})

describe('corroboration is counted as bodies, not citations', () => {
  it('asks the database for claims whose figures all trace to one origin', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await contestedClaims.getAll({ echoOnly: true })

    expect(chain.gte).toHaveBeenCalledWith('values_recorded', 2)
    expect(chain.eq).toHaveBeenCalledWith('distinct_origins', 1)
  })

  it('does not filter for echo when it was not asked to', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await contestedClaims.getAll()

    expect(chain.gte).not.toHaveBeenCalled()
  })

  it('reads values from the resolved view, so the tier belongs to the originator', async () => {
    supabase.from.mockReturnValue(stubQuery({ data: [], error: null }))

    await contestedClaims.getValues('sanctions_related_crypto_growth_2025')

    expect(supabase.from).toHaveBeenCalledWith('claim_values_resolved')
  })

  it('orders values so independent measurements come before repetitions', async () => {
    const chain = stubQuery({ data: [], error: null })
    supabase.from.mockReturnValue(chain)

    await contestedClaims.getValues('any_claim')

    expect(chain.order).toHaveBeenCalledWith('repetition_depth', { ascending: true })
  })
})

describe('every coverage figure is a database count', () => {
  it('never reads rows to produce a total', async () => {
    const chain = stubQuery({ count: 8, error: null })
    supabase.from.mockReturnValue(chain)

    await contestedClaims.getCoverage()

    for (const call of chain.select.mock.calls) {
      expect(call[1]).toMatchObject({ count: 'exact', head: true })
    }
  })

  it('counts evidence_publishers on its own key, which is not id', async () => {
    const chain = stubQuery({ count: 20, error: null })
    supabase.from.mockReturnValue(chain)

    await contestedClaims.getCoverage()

    const columns = chain.select.mock.calls.map((c) => c[0])
    expect(columns).toContain('publisher_id')
  })

  it('returns null rather than zero when a count fails', async () => {
    supabase.from.mockReturnValue(stubQuery({ count: null, error: { message: 'no' } }))

    const { data } = await contestedClaims.getCoverage()

    expect(data.claims).toBeNull()
    expect(data.verified).toBeNull()
  })
})

describe('the vocabulary a page renders', () => {
  it('describes all three tiers, and says an unclassified source is not tier 1', () => {
    expect(Object.keys(EVIDENCE_TIERS)).toEqual(['1', '2', '3'])
    for (const tier of Object.values(EVIDENCE_TIERS)) {
      expect(tier.note).toBeTruthy()
    }
  })

  it('separates a projection from a measurement', () => {
    expect(MEASUREMENTS.measured).toBeTruthy()
    expect(MEASUREMENTS.projected.note).toMatch(/forecast/i)
  })

  it('covers every resolution the check constraint allows', () => {
    expect(Object.keys(RESOLUTIONS).sort()).toEqual(
      [
        'do_not_quote',
        'prefer_one',
        'present_both',
        'present_range',
        'transcription_artefact',
        'unresolved',
      ].sort()
    )
  })

  it('covers every verification state the check constraint allows', () => {
    expect(Object.keys(VERIFICATION_STATES).sort()).toEqual(
      ['carried_forward', 'unconfirmed', 'verified'].sort()
    )
  })
})
