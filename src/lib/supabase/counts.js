/**
 * Counting windows, defined once.
 *
 * The dashboard contradicted itself: the week-over-week tile read "12
 * incidents this week, down 94%" beside "197 new incidents (7d)" and a
 * single group credited with 33 that week. All three counted the same
 * column. They disagreed because each decided for itself what a window was.
 *
 * The fault was a partial window compared against a whole one. The tile took
 * "this week" to mean the calendar week to date. On a Sunday that is one day,
 * measured against the seven before it, and the tile called the difference a
 * 94% fall: 14 incidents against 198, beside a rolling seven-day figure of
 * 212. A comparison is only a comparison if both windows are the same length.
 *
 * Windows are expressed as dates rather than timestamps. That is for saying
 * what is meant, not a fix: PostgREST coerces the literal to the column's
 * type, so a timestamp against `discovered_date` was already truncated to its
 * date and counted the same.
 *
 * A separate thing worth knowing before chasing another mismatch: the public
 * policies hide some incidents, so a count read through the API is smaller
 * than the same count read as service_role - 982 against 1,019 over 30 days
 * on 20 Sep. That gap is row visibility, not arithmetic.
 */

import { supabase } from './client'

/** The window every "recent incidents" figure on the dashboard means. */
export const RECENT_WINDOW_DAYS = 7

/**
 * A count that could not be read is null, not zero.
 *
 * supabase-js resolves rather than throws, so a failed count arrives as
 * { count: undefined, error }. Coercing that to 0 publishes a figure the
 * database never returned - "0 KEV Vulnerabilities" is a claim, and a wrong
 * one. Callers render null as an em dash.
 */
export function tally(result) {
  if (result?.error) return null
  return typeof result?.count === 'number' ? result.count : null
}

/**
 * A date column wants a date. `days` ago from today, UTC, as YYYY-MM-DD.
 */
export function dateDaysAgo(days) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

/**
 * Incidents discovered in [from, to). Returns null if the count failed.
 */
export async function countIncidents({ from, to = null }) {
  let query = supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .gte('discovered_date', from)

  if (to) query = query.lt('discovered_date', to)

  return tally(await query)
}

/**
 * The two windows the week-over-week comparison needs: the last `days` days,
 * and the `days` days before those. Equal length by construction.
 */
export function comparableWindows(days = RECENT_WINDOW_DAYS) {
  return {
    current: { from: dateDaysAgo(days) },
    previous: { from: dateDaysAgo(days * 2), to: dateDaysAgo(days) },
  }
}
