import { describe, it, expect } from 'vitest'
import { parisToUtc, toIncident } from '../ransomlook.js'

// RansomLook's discovery times are Central European time with no zone (migration 203).
describe('parisToUtc', () => {
  it('reads a winter time as CET (UTC+1)', () => {
    expect(parisToUtc('2026-11-27 17:26:22.286794')).toBe('2026-11-27T16:26:22.000Z')
  })

  it('reads a summer time as CEST (UTC+2)', () => {
    expect(parisToUtc('2026-07-01 12:00:00')).toBe('2026-07-01T10:00:00.000Z')
  })

  it('moves a post seen just after Paris midnight to the UTC day before', () => {
    expect(parisToUtc('2026-11-22 00:30:00')).toBe('2026-11-21T23:30:00.000Z')
  })

  it('takes the offset in force on each side of a clock change', () => {
    // Clocks went forward at 02:00 CET on 29 Mar 2026 and back at 03:00 CEST on 25 Oct 2026.
    expect(parisToUtc('2026-03-29 01:30:00')).toBe('2026-03-29T00:30:00.000Z')
    expect(parisToUtc('2026-03-29 03:30:00')).toBe('2026-03-29T01:30:00.000Z')
    expect(parisToUtc('2026-10-25 04:00:00')).toBe('2026-10-25T03:00:00.000Z')
  })

  it('accepts minutes without seconds and refuses anything else', () => {
    expect(parisToUtc('2026-11-27 09:05')).toBe('2026-11-27T08:05:00.000Z')
    expect(parisToUtc('2026-11-27')).toBeNull()
    expect(parisToUtc('2026-11-27T09:05:00Z')).toBeNull()
    expect(parisToUtc(null)).toBeNull()
    expect(parisToUtc('')).toBeNull()
  })
})

describe('toIncident keeps both forms of the discovery time', () => {
  it('stores the local text, the UTC instant, and leaves discovered_date as RansomLook dates it', () => {
    const rec = toIncident({ post_title: 'Acme', group_name: 'lockbit', discovered: '2026-11-22 00:30:00.1' }, {})
    expect(rec.discovered_local).toBe('2026-11-22 00:30:00.1')
    expect(rec.discovered_at).toBe('2026-11-21T23:30:00.000Z')
    expect(rec.discovered_date).toBe('2026-11-22')
  })

  it('writes nulls when RansomLook gives no time', () => {
    const rec = toIncident({ post_title: 'Acme', group_name: 'lockbit' }, {})
    expect(rec.discovered_local).toBeNull()
    expect(rec.discovered_at).toBeNull()
  })
})
