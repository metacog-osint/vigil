/**
 * Vigil's one-line daily summary, for The Intelligence Company's home page
 * (GET /api/summary). The hub shows `brief` beside its Noisefloor and
 * Watchfloor lines, with `day` and `built_at`, and keeps a static line when this
 * fails. A pure function of database rows, so it is tested without a network.
 *
 * WHAT IT COUNTS
 *
 * Leak-site claims by `discovered_date`, the count Vigil's own dashboard uses,
 * read from incidents_commercial (160) as anon, as /api/feed does: only claims a
 * sellable source reported, and only group names threat_actors_commercial lists.
 * Anon also matters for a second reason: the public policy hides rows whose
 * data_quality is 'placeholder', which are not victims at all (077, 103).
 *
 * A claim is the group's own word. The brief says "claims" and says they are
 * unverified; it never says anyone was attacked.
 *
 * WHICH DAY
 *
 * `discovered_date` is the date RansomLook first saw the post, as RansomLook
 * dates it. Measured 31 Oct 2026: of 4,991 RansomLook rows since June, 101 carry
 * a date later than the UTC day they were inserted, and every one was inserted
 * in the 22:15 or 23:15 UTC run. RansomLook's dates run one to two hours ahead
 * of UTC, which fits Central European time. So `day` is RansomLook's calendar
 * day, not a strict UTC day, and `day_basis` says so.
 *
 * A day is summarised only once its ingestion can be shown complete: a
 * successful RansomLook run after the day ended (UTC, which is after it ended in
 * RansomLook's zone too), and no gap longer than MAX_GAP_HOURS between
 * successful runs from shortly before the day began. Each run fetches the 100
 * most recent posts (`added + skipped` = 100 in sync_log). The busiest day in
 * the 60 days to 31 Oct was 83 claims, so 12 hours holds at most about 42
 * posts and nothing can have scrolled out of the window. If yesterday cannot
 * be shown complete, the day before is tried, back to LOOKBACK_DAYS.
 *
 * ABSENCE AND ZERO
 *
 * A failed count is null and there is no summary. A count of zero is not
 * published either: a successful fetch proves Vigil's fetch worked, not that
 * RansomLook's crawler did, so "no claims" could be an outage upstream. The
 * hub keeps its static line rather than reading a quiet day into a gap.
 */

export const SITE = 'https://vigil.theintelligence.company'
export const METHOD = 'vigil-summary-1'
export const MAX_GAP_HOURS = 12
export const LOOKBACK_DAYS = 3
/** RansomLook's day starts this many hours before the UTC day (CET/CEST). */
export const LEAD_HOURS = 2
export const MAX_BRIEF = 200

const HOUR_MS = 3600000
const DAY_MS = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SOURCE = {
  publisher: 'RansomLook',
  url: 'https://www.ransomlook.io/',
  licence: 'CC BY 4.0',
}
export const ATTRIBUTION =
  'Vigil, The Intelligence Company. Leak-site claims: RansomLook (CC BY 4.0).'
export const DAY_BASIS =
  'Claims by the date RansomLook first saw them on a leak site, as RansomLook dates them ' +
  '(measured at one to two hours ahead of UTC).'

const utc = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z')
const startOf = (day) => Date.parse(`${day}T00:00:00Z`)
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)

/** "30 Oct 2026". Built by hand: en-GB in newer ICU spells September "Sept". */
export function plainDate(day) {
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

const plural = (n, one, many = `${one}s`) =>
  `${Number(n).toLocaleString('en-US')} ${n === 1 ? one : many}`

/** The earliest completed_at the day check can need, for the sync_log query. */
export function runsSince(now = new Date()) {
  const earliest = startOf(isoDay(now.getTime() - LOOKBACK_DAYS * DAY_MS))
  return utc(earliest - (LEAD_HOURS + MAX_GAP_HOURS) * HOUR_MS)
}

/**
 * Whether `day`'s claims are all in: a successful run after the day ended, and
 * no gap over MAX_GAP_HOURS between successful runs from LEAD_HOURS before the
 * day began. Returns the first run after the day ended, or null.
 */
export function confirmedAt(day, runTimes) {
  const begin = startOf(day) - LEAD_HOURS * HOUR_MS
  const end = startOf(day) + DAY_MS
  const maxGap = MAX_GAP_HOURS * HOUR_MS
  const runs = runTimes
    .map((t) => Date.parse(t))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const after = runs.find((t) => t >= end)
  if (after == null) return null
  const seq = runs.filter((t) => t >= begin - maxGap && t <= after)
  if (!seq.length || seq[0] > begin) return null
  for (let i = 1; i < seq.length; i++) if (seq[i] - seq[i - 1] > maxGap) return null
  return utc(after)
}

/** The most recent day, from yesterday (UTC) back, whose ingestion is confirmed. */
export function latestConfirmedDay(runTimes, now = new Date()) {
  for (let k = 1; k <= LOOKBACK_DAYS; k++) {
    const day = isoDay(now.getTime() - k * DAY_MS)
    const at = confirmedAt(day, runTimes)
    if (at) return { day, confirmedAt: at }
  }
  return null
}

/** Claims per group, and the group(s) with the most. Rows are { actor_id }. */
export function tallyGroups(rows) {
  const counts = new Map()
  let unattributed = 0
  for (const r of rows) {
    if (!r.actor_id) unattributed++
    else counts.set(r.actor_id, (counts.get(r.actor_id) || 0) + 1)
  }
  const most = counts.size ? Math.max(...counts.values()) : 0
  const leaders = [...counts].filter(([, n]) => n === most).map(([id]) => id)
  return { counts, unattributed, most, leaders }
}

function leaderClause(names, most) {
  if (names.length === 1) return `; ${names[0]} posted the most (${most})`
  if (names.length === 2) return `; ${names[0]} and ${names[1]} posted the most (${most} each)`
  return `; ${names.length} groups tied for the most (${most} each)`
}

/**
 * @param {object} p
 * @param {string} p.day            YYYY-MM-DD, from latestConfirmedDay
 * @param {string} p.confirmedAt    first successful run after the day ended
 * @param {number|null} p.claims    the database's exact count for the day; null if the count failed
 * @param {Array} p.rows            { actor_id } for the day's claims, as returned
 * @param {object} p.names          actor_id -> name, from threat_actors_commercial
 * @param {Date} [now]
 * @returns {object|null} null when nothing true can be said
 */
export function buildSummary(
  { day, confirmedAt: ingestAt, claims, rows = [], names = {} },
  now = new Date()
) {
  if (typeof claims !== 'number' || !Number.isFinite(claims)) return null
  if (claims <= 0) return null

  // Group figures only from the whole day. A tally of a truncated page is not a count.
  const whole = rows.length === claims
  const t = whole ? tallyGroups(rows) : null
  const groups = t ? t.counts.size : null
  const unattributed = t ? t.unattributed : null

  // Name the leaders only if every one of them has a listable name. Naming the
  // runner-up because the leader's name came from a restricted source would be false.
  let top = null
  if (t && groups > 0 && t.leaders.every((id) => names[id])) {
    top = {
      claims: t.most,
      groups: t.leaders
        .map((id) => ({ name: names[id], url: `${SITE}/actors/${id}` }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }

  const head = `Ransomware leak sites showed ${plural(claims, 'new victim claim')} on ${plainDate(day)}`
  const tailNote = '. Claims are unverified.'
  let from = ''
  let lead = ''
  if (groups > 0) {
    const none = unattributed ? ` and ${unattributed} with no group recorded` : ''
    if (groups === 1 && !unattributed && top) from = `, all from ${top.groups[0].name}`
    else from = `, from ${plural(groups, 'group')}${none}`
    if (top && groups > 1)
      lead = leaderClause(
        top.groups.map((g) => g.name),
        top.claims
      )
  }
  let brief = head + from + lead + tailNote
  if (brief.length > MAX_BRIEF) brief = head + from + tailNote
  if (brief.length > MAX_BRIEF) brief = head + tailNote

  return {
    built_at: utc(now),
    day,
    brief,
    claims,
    groups,
    unattributed,
    top,
    day_basis: DAY_BASIS,
    ingest_confirmed_at: ingestAt,
    link: `${SITE}/incidents`,
    source: SOURCE,
    attribution: ATTRIBUTION,
    method: METHOD,
  }
}
