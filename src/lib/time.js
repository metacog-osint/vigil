// Time display through The Intelligence Company's shared module (public/tic-time.js, v1.2): the viewer's
// own zone by default, always named; the Time button in the header picks Zulu, another zone, or a 12/24-hour
// clock (Tom, 27 Oct 2026). Data stays UTC.
//
// A bare calendar day ("2026-10-22", a DATE column or a chart's day key) is not a moment, so it is shown as
// that day in every zone. Parsed as a timestamp it would be midnight UTC: the day before anywhere west of UTC.
const T = () => (typeof window !== 'undefined' && window.TicTime) || null
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function calendarDay(m, opts) {
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (Number.isNaN(d.getTime())) return '—'
  const t = T()
  const o = { timeZone: 'UTC' }
  if (opts.weekday) o.weekday = 'short'
  if (opts.date !== false) {
    o.month = 'short'
    o.day = 'numeric'
    if (opts.year) o.year = 'numeric'
  }
  // Zulu readers get the module's day-month order ("27 Oct 2026"), as for timestamps.
  return d.toLocaleDateString(t && t.zone() === 'UTC' ? 'en-GB' : undefined, o)
}

export function fmt(value, opts = {}) {
  if (value === null || value === undefined || value === '') return '—'
  const day = typeof value === 'string' ? DAY.exec(value) : null
  if (day) return calendarDay(day, opts)
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const t = T()
  if (t) return t.format(d, opts)
  const o = {}
  if (opts.weekday) o.weekday = 'short'
  if (opts.date !== false) {
    o.month = 'short'
    o.day = 'numeric'
    if (opts.year) o.year = 'numeric'
  }
  if (opts.time !== false) {
    o.hour = 'numeric'
    o.minute = '2-digit'
    if (opts.seconds) o.second = '2-digit'
    if (opts.zoneName !== false) o.timeZoneName = 'short'
  }
  return d.toLocaleString(undefined, o)
}

export const fmtDate = (value, opts = {}) => fmt(value, { ...opts, time: false })
export const fmtTime = (value, opts = {}) => fmt(value, { ...opts, date: false })
