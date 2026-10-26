/**
 * The ransom-payments query layer.
 *
 * The first test asserts an absence, as disclosures.test.js does: nothing
 * returns one total of ransom paid. The deposit sums to about USD 1.016
 * billion and two thirds of it is "Unlabeled". The obvious next commit adds a
 * `totalUsd`, and this is the test it has to get past.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import {
  ransomPayments,
  summarise,
  RANSOM_PAYMENTS_SOURCE,
  RANSOMWHERE_CITATION,
  UNLABELED_FAMILY,
} from '../ransomPayments'

const META = { snapshot_version: '1.1.0', snapshot_published: '2024-10-27' }

function row(family, usd, payments, addresses, first, last, extra = {}) {
  return {
    family_name: family,
    total_usd: usd,
    payment_count: payments,
    unique_addresses: addresses,
    first_payment: first,
    last_payment: last,
    metadata: { ...META, attributed: family !== UNLABELED_FAMILY, ...extra },
  }
}

// The shape of the live rows, in the order the query asks for them.
const ROWS = [
  row(UNLABELED_FAMILY, 682_000_000, 9000, 6000, '2012-03-09', '2024-08-19'),
  row('Conti', 180_000_000, 900, 700, '2020-05-01', '2022-06-01'),
  row('Ryuk', 150_000_000, 400, 300, '2018-08-01', '2021-02-01'),
  row('Locky', 4_000_000, 2000, 1500, '2016-02-01', '2017-12-01'),
]

function stubQuery(result) {
  const chain = {}
  for (const method of ['select', 'eq', 'order', 'limit']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('there is no single total', () => {
  it('returns no figure that adds attributed and unlabeled together', () => {
    const summary = summarise(ROWS, ROWS.length)
    const totals = Object.keys(summary).filter((k) => /total|grand|overall|allUsd|sumUsd/i.test(k))
    expect(totals).toEqual([])
    expect(Object.keys(ransomPayments)).toEqual(['getPayments'])
  })

  it('keeps Unlabeled apart from the named families', () => {
    const s = summarise(ROWS, ROWS.length)
    expect(s.attributedUsd).toBe(334_000_000)
    expect(s.unlabeledUsd).toBe(682_000_000)
    expect(s.namedFamilies).toBe(3)
    expect(s.familiesHeld).toBe(4)
  })

  it('states the unlabeled share, which is the reason for the rule', () => {
    const s = summarise(ROWS, ROWS.length)
    expect(s.unlabeledShare).toBeCloseTo(682 / 1016, 5)
  })

  it('treats a row the import marked unattributed as Unlabeled, whatever its name', () => {
    const rows = [...ROWS.slice(1), row('unknown', 10, 1, 1, null, null, { attributed: false })]
    const s = summarise(rows, rows.length)
    expect(s.unlabeledUsd).toBe(10)
    expect(s.namedFamilies).toBe(3)
  })
})

describe('every figure from all the rows, or none', () => {
  it('nulls every sum when fewer rows came back than exist', () => {
    // A capped select is a smaller number that looks fine.
    const s = summarise(ROWS.slice(0, 3), 4)
    expect(s.complete).toBe(false)
    for (const key of [
      'attributedUsd',
      'attributedPayments',
      'attributedAddresses',
      'unlabeledUsd',
      'unlabeledShare',
      'namedFamilies',
    ]) {
      expect(s[key]).toBeNull()
    }
    expect(s.familiesHeld).toBe(4)
  })

  it('nulls every sum when the database count is missing', () => {
    expect(summarise(ROWS, null).attributedUsd).toBeNull()
  })

  it('asks the database for an exact count, from the one source', async () => {
    const chain = stubQuery({ data: ROWS, count: ROWS.length, error: null })
    supabase.from.mockReturnValue(chain)

    await ransomPayments.getPayments()

    expect(supabase.from).toHaveBeenCalledWith('ransomware_payments')
    expect(chain.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' })
    expect(chain.eq).toHaveBeenCalledWith('source', RANSOM_PAYMENTS_SOURCE)
  })

  it('never asks for BTC', async () => {
    const chain = stubQuery({ data: ROWS, count: ROWS.length, error: null })
    supabase.from.mockReturnValue(chain)

    await ransomPayments.getPayments()

    expect(chain.select.mock.calls[0][0]).not.toMatch(/btc/i)
  })
})

describe('the data has an age', () => {
  it('carries the snapshot version, publication date and payment range', () => {
    const { snapshot } = summarise(ROWS, ROWS.length)
    expect(snapshot).toMatchObject({
      version: '1.1.0',
      published: '2024-10-27',
      mixed: false,
      firstPayment: '2012-03-09',
      lastPayment: '2024-08-19',
    })
  })

  it('says so when rows come from two snapshots, rather than naming one', () => {
    const rows = [
      ...ROWS,
      row('Dropped', 1, 1, 1, '2015-01-01', '2015-02-01', { snapshot_version: '1.0.0' }),
    ]
    const { snapshot } = summarise(rows, rows.length)
    expect(snapshot.mixed).toBe(true)
    expect(snapshot.version).toBeNull()
    expect(snapshot.versions.sort()).toEqual(['1.0.0', '1.1.0'])
  })
})

describe('getPayments', () => {
  it('returns the named families most money first, and Unlabeled apart', async () => {
    supabase.from.mockReturnValue(stubQuery({ data: ROWS, count: ROWS.length, error: null }))

    const { data, error } = await ransomPayments.getPayments()

    expect(error).toBeNull()
    expect(data.families.map((f) => f.name)).toEqual(['Conti', 'Ryuk', 'Locky'])
    expect(data.unlabeled).toMatchObject({ name: UNLABELED_FAMILY, usd: 682_000_000 })
  })

  it('passes a failure through rather than an empty list', async () => {
    supabase.from.mockReturnValue(
      stubQuery({ data: null, count: null, error: { message: 'boom' } })
    )

    const { data, error } = await ransomPayments.getPayments()

    expect(data).toBeNull()
    expect(error.message).toBe('boom')
  })
})

describe('attribution', () => {
  it('cites the deposit, its licence and what Vigil changed', () => {
    expect(RANSOMWHERE_CITATION).toMatchObject({
      doi: '10.5281/zenodo.6512122',
      licence: 'CC BY 4.0',
    })
    expect(RANSOMWHERE_CITATION.changes).toMatch(/aggregated/i)
  })
})
