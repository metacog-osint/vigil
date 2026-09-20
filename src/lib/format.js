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
