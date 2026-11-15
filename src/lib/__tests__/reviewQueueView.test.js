import { describe, expect, it } from 'vitest'
import {
  daysApart,
  kindCounts,
  orderForKind,
  sameCompanyCount,
  secCompany,
} from '../reviewQueueView'

const sec = (id, company, filed, claim) => ({
  id,
  check_name: 'sec_disclosure_candidate',
  subject: `${company} filed 8-K Item 1.05 on ${filed}`,
  details: { filed, claim_discovered: claim },
})

describe('daysApart', () => {
  it('measures an SEC candidate from its two dates', () => {
    expect(daysApart(sec('a', 'Stryker', '2026-04-01', '2026-07-01'))).toBe(91)
  })

  it('uses the figure a breach-notice candidate already carries', () => {
    expect(daysApart({ details: { nearest_days_apart: 11 } })).toBe(11)
  })

  it('is null, not zero, when a date is missing', () => {
    expect(daysApart({ details: { filed: '2026-04-01' } })).toBeNull()
  })
})

describe('grouping', () => {
  const list = [
    sec('1', 'Stryker', '2026-05-01', '2026-07-01'),
    sec('2', 'Acme', '2026-01-01', '2026-01-02'),
    sec('3', 'Stryker', '2026-04-01', '2026-07-01'),
    { id: '4', check_name: 'actor_alias_review', subject: 'a / b', details: {} },
  ]

  it('reads the company out of the subject', () => {
    expect(secCompany(list[0])).toBe('Stryker')
    expect(secCompany(list[3])).toBeNull()
  })

  it('puts an 8-K beside its amendment', () => {
    expect(orderForKind(list, 'sec_disclosure_candidate').map((f) => f.id)).toEqual(['2', '3', '1'])
  })

  it('counts other filings from the same company', () => {
    expect(sameCompanyCount(list[0], list)).toBe(1)
    expect(sameCompanyCount(list[1], list)).toBe(0)
  })

  it('orders breach-notice candidates nearest first, unknown last', () => {
    const b = (id, n) => ({
      id,
      check_name: 'breach_notice_candidate',
      details: { nearest_days_apart: n },
    })
    const out = orderForKind([b('x', 40), b('y'), b('z', 3)], 'breach_notice_candidate')
    expect(out.map((f) => f.id)).toEqual(['z', 'x', 'y'])
  })

  it('counts kinds, most numerous first', () => {
    expect(kindCounts(list)).toEqual([
      { kind: 'sec_disclosure_candidate', count: 3 },
      { kind: 'actor_alias_review', count: 1 },
    ])
  })

  it('with no kind chosen, keeps everything in its order', () => {
    expect(orderForKind(list, '').map((f) => f.id)).toEqual(['1', '2', '3', '4'])
  })
})
