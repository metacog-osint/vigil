/**
 * Time display helpers (src/lib/time.js). Without the shared module (as here) they fall back to the
 * runtime's own locale, so these check the day and the parts rather than one locale's exact wording.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { fmt, fmtDate, fmtTime } from '../time'

afterEach(() => {
  delete window.TicTime
})

describe('fmt / fmtDate', () => {
  it('shows a bare calendar day as that day, not the day before', () => {
    const s = fmtDate('2026-10-27', { year: true })
    expect(s).toMatch(/\b27\b/)
    expect(s).not.toMatch(/\b26\b/)
    expect(s).toMatch(/2026/)
  })

  it('ignores the clock for a bare calendar day', () => {
    expect(fmt('2026-10-27')).toBe(fmtDate('2026-10-27'))
  })

  it('gives a weekday alone for a bare day when asked', () => {
    // 27 Oct 2026 is a Tuesday
    expect(fmtDate('2026-10-27', { weekday: true, date: false })).toMatch(/Tue/)
  })

  it('shows a missing or unreadable value as a dash', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt(undefined)).toBe('—')
    expect(fmt('')).toBe('—')
    expect(fmt('not a date')).toBe('—')
    expect(fmtDate('2026-13-45x')).toBe('—')
  })

  it('formats a timestamp through the shared module when it is loaded', () => {
    window.TicTime = {
      format: (d, o) => `T:${d.toISOString()}:${o.time === false ? 'date' : 'full'}`,
      zone: () => 'UTC',
    }
    expect(fmt('2026-10-27T14:05:00Z')).toBe('T:2026-10-27T14:05:00.000Z:full')
    expect(fmtDate('2026-10-27T14:05:00Z')).toBe('T:2026-10-27T14:05:00.000Z:date')
  })

  it('uses day-month order for a bare day when the viewer reads Zulu', () => {
    window.TicTime = { format: () => 'unused', zone: () => 'UTC' }
    expect(fmtDate('2026-10-27', { year: true })).toBe('27 Oct 2026')
  })

  it('names the zone on a clock time without the module', () => {
    expect(fmtTime('2026-10-27T14:05:00Z')).toMatch(/\d{1,2}:05/)
  })
})
