/**
 * The dashboard contradicted itself, so these are the assertions that say it
 * cannot again: the figures shown beside each other must be the same figure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../client'
import { comparableWindows, dateDaysAgo, tally, RECENT_WINDOW_DAYS } from '../counts'
import { trendAnalysis } from '../trendAnalysis'

/**
 * A query whose count depends on the window it was asked for, keyed by the
 * date passed to .gte('discovered_date', ...). This is what makes the
 * contradiction test real: ask for the wrong window, get the wrong number.
 */
function windowAwareQuery(countsByWindow) {
  let from = null
  const result = () => Promise.resolve({ count: countsByWindow[from] ?? 0, error: null })
  const q = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn((column, value) => {
      if (column === 'discovered_date') from = value
      return q
    }),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => result()),
    then: (resolve) => result().then(resolve),
  }
  return q
}

/** A query object whose count() resolves to whatever the test says. */
function queryReturning(result) {
  const q = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  }
  return q
}

describe('counting windows', () => {
  describe('dateDaysAgo', () => {
    it('returns a date, never a timestamp', () => {
      // discovered_date is a date column, so a window against it is a date.
      // PostgREST would truncate a timestamp to the same value anyway; this
      // is about the code saying what it means.
      expect(dateDaysAgo(30)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('counts back the number of days asked for', () => {
      const a = new Date(`${dateDaysAgo(0)}T00:00:00Z`)
      const b = new Date(`${dateDaysAgo(7)}T00:00:00Z`)
      expect((a - b) / 86400000).toBe(7)
    })
  })

  describe('comparableWindows', () => {
    it('makes both windows the same length', () => {
      const { current, previous } = comparableWindows(7)
      const currentStart = new Date(`${current.from}T00:00:00Z`)
      const previousStart = new Date(`${previous.from}T00:00:00Z`)
      const previousEnd = new Date(`${previous.to}T00:00:00Z`)

      // The whole fault: a calendar-week-to-date current window measured
      // against a full previous week. On a Sunday that was one day against
      // seven, reported as a 94% fall.
      expect((previousEnd - previousStart) / 86400000).toBe(7)
      expect(previousEnd.getTime()).toBe(currentStart.getTime())
    })

    it('hands the previous window off exactly where the current one starts', () => {
      const { current, previous } = comparableWindows(14)
      expect(previous.to).toBe(current.from)
    })
  })

  describe('tally', () => {
    it('reports a failed count as absence, not as zero', () => {
      expect(tally({ count: undefined, error: { message: 'nope' } })).toBeNull()
      expect(tally({ count: 0, error: null })).toBe(0)
      expect(tally({ count: 212, error: null })).toBe(212)
    })
  })
})

describe('the dashboard does not contradict itself', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the same number of incidents in both places', async () => {
    // The count depends on the window actually asked for, so two callers
    // reading different windows get different numbers and this fails. A
    // mock that ignores the window would pass even with the bug present.
    const countsByWindow = {
      [dateDaysAgo(RECENT_WINDOW_DAYS)]: 212,
      [dateDaysAgo(RECENT_WINDOW_DAYS * 2)]: 198,
      [dateDaysAgo(0)]: 14, // what the calendar-week-to-date bug counted
    }

    supabase.from.mockImplementation(() => windowAwareQuery(countsByWindow))

    const [weekOverWeek, changeSummary] = await Promise.all([
      trendAnalysis.calculateWeekOverWeek(),
      trendAnalysis.getChangeSummary(RECENT_WINDOW_DAYS),
    ])

    expect(weekOverWeek.currentWeek.incidents_total).toBe(212)
    expect(weekOverWeek.currentWeek.incidents_total).toBe(changeSummary.newIncidents)
    expect(weekOverWeek.windowDays).toBe(changeSummary.sinceDays)
    // The shape of the original fault: today's 14 against a full week's 198.
    expect(weekOverWeek.currentWeek.incidents_total).not.toBe(14)
  })

  it('does not report a change when a count could not be read', async () => {
    supabase.from.mockImplementation(() =>
      queryReturning({ count: undefined, error: { message: 'timeout' } })
    )

    const result = await trendAnalysis.calculateWeekOverWeek()

    expect(result.currentWeek.incidents_total).toBeNull()
    // Not 0%. A comparison that could not be made is not a flat week.
    expect(result.incidentChange).toBeNull()
  })

  it('states the change against a window of the same length', async () => {
    let call = 0
    // current window 100, previous window 200 -> a genuine 50% fall
    supabase.from.mockImplementation(() =>
      queryReturning({ count: call++ === 0 ? 100 : 200, error: null })
    )

    const result = await trendAnalysis.calculateWeekOverWeek()

    expect(result.currentWeek.incidents_total).toBe(100)
    expect(result.previousWeek.incidents_total).toBe(200)
    expect(result.incidentChange).toBe(-50)
  })
})
