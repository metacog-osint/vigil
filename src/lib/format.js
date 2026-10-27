/**
 * Display helpers for figures Vigil may or may not have.
 */

/**
 * A count the database did not return is shown as an em dash, never as 0.
 *
 * The query layer returns null when a count failed, and `|| 0` would turn
 * that absence into a figure Vigil cannot back. "0 incidents this week" and
 * "we could not read the incident count" are different claims, and only one
 * of them is ever true by accident.
 */
export function figure(n) {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

/**
 * US dollars, with the same rule: a sum Vigil could not make is a dash, not $0.
 *
 * `compact` is for headline figures ("$334.1M"). Tables use whole dollars, so
 * a reader comparing two families compares the figures the dataset holds.
 */
export function usd(n, { compact = false } = {}) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    // Both bounds explicit. The currency default minimum is 2, and engines
    // reconcile it with a smaller maximum differently: Node 20 renders
    // "$334.0M" where Node 24 and current browsers render "$334M".
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 0,
    ...(compact ? { notation: 'compact' } : {}),
  }).format(n)
}

/**
 * A calendar day such as a publication date, "2026-10-22".
 *
 * Parsed as a timestamp it is midnight UTC, which renders as the day before
 * anywhere west of UTC - Central time included. So a bare date is read as a
 * day and formatted in UTC. Anything missing or unreadable is a dash.
 */
export function calendarDay(value) {
  if (!value) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
