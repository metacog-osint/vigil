/**
 * Display helpers. These run in CI on Node 20 as well as in browsers, and
 * Intl currency formatting has differed between them (see usd()).
 */
import { describe, it, expect } from 'vitest'
import { figure, usd } from '../format'

describe('figure', () => {
  it('shows a missing count as a dash, never 0', () => {
    expect(figure(null)).toBe('—')
    expect(figure(undefined)).toBe('—')
    expect(figure(0)).toBe('0')
  })
})

describe('usd', () => {
  it('drops a trailing .0 in compact form on every engine', () => {
    expect(usd(334_000_000, { compact: true })).toBe('$334M')
    expect(usd(334_097_348.15, { compact: true })).toBe('$334.1M')
    expect(usd(1_500, { compact: true })).toBe('$1.5K')
  })

  it('shows whole dollars in full form', () => {
    expect(usd(101_512_345.67)).toBe('$101,512,346')
    expect(usd(0)).toBe('$0')
  })

  it('shows a sum Vigil could not make as a dash, never $0', () => {
    expect(usd(null)).toBe('—')
    expect(usd(undefined, { compact: true })).toBe('—')
    expect(usd(Number.NaN)).toBe('—')
  })
})
