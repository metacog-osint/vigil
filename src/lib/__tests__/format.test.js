/**
 * Display helpers. These run in CI on Node 20 as well as in browsers, and
 * Intl currency formatting has differed between them (see usd()).
 */
import { describe, it, expect } from 'vitest'
import { figure, usd, calendarDay } from '../format'

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

describe('calendarDay', () => {
  it('reads a bare date as a day, not as midnight UTC shifted west', () => {
    // Central time is west of UTC; as a timestamp this would render Oct 21.
    expect(calendarDay('2026-10-22')).toBe('Oct 22, 2026')
  })

  it('formats a full timestamp by its UTC day', () => {
    expect(calendarDay('2026-10-27T01:00:00Z')).toBe('Oct 27, 2026')
  })

  it('shows a missing or unreadable date as a dash', () => {
    expect(calendarDay(null)).toBe('—')
    expect(calendarDay('not a date')).toBe('—')
  })
})
