// Time display through The Intelligence Company's shared module (public/tic-time.js, v1.1): the viewer's
// own zone by default, always named; the Time button in the header picks Zulu, another zone, or a 12/24-hour
// clock (Tom, 27 Oct 2026). Data stays UTC.
const T = () => (typeof window !== 'undefined' && window.TicTime) || null

export function fmt(value, opts = {}) {
  if (value === null || value === undefined || value === '') return '\u2014'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '\u2014'
  const t = T()
  if (t) return t.format(d, opts)
  const o = {}
  if (opts.weekday) o.weekday = 'short'
  if (opts.date !== false) { o.month = 'short'; o.day = 'numeric'; if (opts.year) o.year = 'numeric' }
  if (opts.time !== false) {
    o.hour = 'numeric'; o.minute = '2-digit'
    if (opts.seconds) o.second = '2-digit'
    if (opts.zoneName !== false) o.timeZoneName = 'short'
  }
  return d.toLocaleString(undefined, o)
}

export const fmtDate = (value, opts = {}) => fmt(value, { ...opts, time: false })
export const fmtTime = (value, opts = {}) => fmt(value, { ...opts, date: false })
