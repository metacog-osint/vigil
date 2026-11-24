/**
 * Vigil in The Intelligence Company's feed contract v2 (tic-feed/2), as GeoJSON.
 *
 * A pure function of database rows, so it is tested without a network. Every item is a
 * measurement (kind observation): groups whose claims are unusual for them, leak-site claims, KEV additions, CISA's
 * ADP ratings of exploitation active (176) and victim disclosures, plus one summary. Judged warnings wait for doctrine/indicators.json.
 *
 * Claims and group names come only from the *_commercial views (sources that permit
 * redistribution); Ransomware.live's terms forbid re-serving its raw data. See
 * doctrine/method.md. Items naming organizations carry us_person_data "organizations":
 * Vigil labels such data for readers bound by EO 12333 and does not strip it.
 */

import { countryPoint } from '../../doctrine/kit/js/tic-doctrine.js'

/** Vigil sector name -> CISA sector id. Must equal doctrine/ncf_map.json sector_map (a test checks). */
export const SECTOR_MAP = {
  healthcare: 'healthcare_and_public_health',
  technology: 'information_technology',
  finance: 'financial_services',
  education: 'government_services_and_facilities',
  government: 'government_services_and_facilities',
  manufacturing: 'critical_manufacturing',
  energy: 'energy',
  retail: 'commercial_facilities',
}

export const CONTRACT = 'tic-feed/2'
export const CONTRACT_REV = '2.1'
export const KIT_VERSION = '0.6.9'
export const SITE = 'https://vigil.theintelligence.company'
export const METHOD = 'vigil-feed-1.0'
export const EPSS_ALERT = 0.5
export const EPSS_CURRENT_DAYS = 3 // migration 159: an older score is stale
export const LANGUAGE_KEY =
  'https://github.com/metacog-osint/tic-doctrine/blob/main/docs/language-key.md'

const SRC = {
  ransomlook: {
    id: 'ransomlook',
    publisher: 'RansomLook',
    url: 'https://www.ransomlook.io/',
    licence: 'CC BY 4.0',
    grade: 'D3',
    independence_group: 'leak-sites',
    source_type: 'dataset',
    descriptor:
      "Crawler of ransomware leak sites; relays the criminals' own claims, published here as claimed.",
  },
  kev: {
    id: 'cisa-kev',
    publisher: 'CISA',
    title: 'Known Exploited Vulnerabilities catalog',
    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    licence: 'US public domain',
    grade: 'A1',
    independence_group: 'cisa',
    source_type: 'dataset',
    descriptor: 'Official US government listing of vulnerabilities exploited in the wild.',
  },
  // CISA's ADP SSVC assessment (migrations 176, 177). CISA too, so the same independence group as
  // KEV: the two never count as corroborating each other. Proposed A2 (Tom to confirm): the
  // most reliable source there is, but "active" is CISA's assessment of reliable public
  // evidence, not the catalog's confirmed listing.
  adp: {
    id: 'cisa-vulnrichment',
    publisher: 'CISA',
    title: 'Vulnrichment: CISA ADP SSVC assessments',
    url: 'https://github.com/cisagov/vulnrichment',
    licence: 'CC0-1.0',
    grade: 'A2',
    independence_group: 'cisa',
    source_type: 'dataset',
    descriptor:
      "CISA's SSVC assessment of a CVE (Exploitation, Automatable, Technical Impact) in its ADP container. Not the KEV catalog.",
  },
  epss: {
    id: 'first-epss',
    publisher: 'FIRST',
    title: 'Exploit Prediction Scoring System',
    url: 'https://www.first.org/epss/',
    licence: 'FIRST EPSS: free to use with attribution',
    grade: 'B2',
    independence_group: 'first',
    source_type: 'model',
    descriptor:
      "A model's probability of exploitation activity in the next 30 days, published daily.",
  },
  stateAg: {
    id: 'state-ag-notices',
    publisher: 'State attorneys general (CA, WA, OR)',
    licence: 'US state government public record',
    grade: 'A2',
    independence_group: 'victim-filings',
    source_type: 'official filing',
    descriptor: "Breach notices filed by the victim with the state's attorney general.",
  },
  sec: {
    id: 'sec-edgar',
    publisher: 'US Securities and Exchange Commission',
    url: 'https://www.sec.gov/edgar',
    licence: 'US public domain',
    grade: 'A2',
    independence_group: 'victim-filings',
    source_type: 'official filing',
    descriptor: 'Form 8-K Item 1.05 (material cybersecurity incident) filed by the victim company.',
  },
  misp: {
    id: 'misp-galaxy',
    publisher: 'MISP Project',
    title: 'MISP Galaxy threat-actor cluster',
    url: 'https://github.com/MISP/misp-galaxy',
    licence: 'CC0 1.0 Universal or 2-clause BSD',
    grade: 'C3',
    independence_group: 'misp',
    source_type: 'dataset',
    descriptor:
      'Community threat-actor catalog recording attributed country of origin where published.',
  },
  mitre: {
    id: 'mitre-attack',
    publisher: 'The MITRE Corporation',
    title: 'MITRE ATT&CK groups',
    url: 'https://attack.mitre.org/groups/',
    licence: 'MITRE ATT&CK terms of use (attribution required)',
    grade: 'C3',
    independence_group: 'mitre',
    source_type: 'dataset',
    descriptor:
      'ATT&CK group entries, recording an attributed country where the cited reporting gives one.',
  },
  vigil: {
    id: 'vigil',
    publisher: 'Vigil, The Intelligence Company',
    url: SITE,
    licence: 'Vigil terms of use',
    grade: 'B2',
    independence_group: 'vigil',
    source_type: 'derived',
    descriptor:
      "Vigil's own computation from the claims it holds (migration 179 surge rule: each group against its own 8 weeks before).",
  },
}
// actor_origins_commercial.origin_source -> the source record cited for it. An origin from any other source
// (or none) is left out of the feed rather than credited to the wrong publisher.
const ORIGIN_SRC = { 'misp-galaxy': SRC.misp, 'mitre-attack': SRC.mitre }
const REGULATOR = { 'ca-ag': 'California', 'wa-ag': 'Washington', 'or-ag': 'Oregon' }
// VG-IND-1 since migration 179: the last 7 complete UTC days against the group's own 8 weeks before
// (negative binomial, p < 0.01, at least 5 claims on at least 3 days). Until 179 it was 077's
// "more than 1.25x the week before", which flagged 17 groups a day (backtest in 179's header).
const BASE_GROUP = {
  id: 'vigil-actor-8wk',
  window: "the group's own 8 weeks before the last 7 complete UTC days",
  type: 'rolling',
  version: '179',
}
/** "6.3", "0.6", "12": a baseline mean for a title. */
const perWeek = (m) => {
  const n = Number(m) || 0
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}
const BASE_EPSS = {
  id: 'epss-0.5',
  window: 'current FIRST EPSS score against a fixed 0.5 threshold',
  type: 'fixed',
  version: '1',
}

const DAY_MS = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** How many days before today (UTC) each window starts. api/feed.js queries from these dates. */
export const WINDOW_DAYS = { claims: 2, kev: 7, adp: 7, disclosures: 7 }

/** The first UTC date (YYYY-MM-DD) each window includes. */
export function windowStarts(now = new Date()) {
  const back = (days) => new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10)
  return {
    claims: back(WINDOW_DAYS.claims),
    kev: back(WINDOW_DAYS.kev),
    adp: back(WINDOW_DAYS.adp),
    disclosures: back(WINDOW_DAYS.disclosures),
  }
}

const utc = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z')
const dayStart = (date) => `${String(date).slice(0, 10)}T00:00:00Z`
/** "4 Sep 2026", in UTC. Built by hand: en-GB in newer ICU spells September "Sept". */
const plain = (d) => {
  const t = new Date(d)
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}
const sectorsOf = (names) =>
  [
    ...new Set((names || []).map((n) => SECTOR_MAP[String(n || '').toLowerCase()]).filter(Boolean)),
  ].sort()
const withSources = (accessed, ...list) => list.map((s) => ({ ...s, accessed_at: accessed }))
const point = (cc) => {
  const p = countryPoint(cc)
  return p ? { type: 'Point', coordinates: [p[1], p[0]] } : null
}
const iso2 = (cc) => {
  const s = String(cc || '')
    .trim()
    .toUpperCase()
  return /^[A-Z]{2}$/.test(s) ? s : null
}
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties })

/**
 * Contract 2.1 for an item that exists from one dated moment: a claim, a KEV addition, an ADP assessment, a breach
 * notice. Its id is already its subject. `new` at the source's own date; a date-only source says so by precision.
 */
const onceAt = (id, at, precision = null) => ({
  subject_id: id,
  event_start: at,
  last_change: 'new',
  last_change_at: at,
  ...(precision ? { event_time_precision: precision } : {}),
})

/**
 * The seven complete UTC days a surge counts, from the last day. Day precision: event_end is that day's start and
 * covers the whole day. A surge's first flagged time is not stored, so a surge item states no last_change.
 */
const surgeWindow = (end) => ({
  event_start: dayStart(new Date(Date.parse(dayStart(end)) - 6 * DAY_MS).toISOString()),
  event_end: dayStart(end),
  event_time_precision: 'day',
})

/**
 * The total from a PostgREST Content-Range header sent under Prefer: count=exact: "0-299/450"
 * is 450, and a match of no rows reports a total of 0. Null when the header carries no
 * total ("0-86/*", or no header), never 0.
 */
export function countFromRange(header) {
  const m = /\/(\d+)$/.exec(String(header || ''))
  return m ? Number(m[1]) : null
}

/** A count the database gave, or null. */
const known = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : null)

const num = (n) => n.toLocaleString('en-US')

/**
 * One figure in the summary title, for rows the query caps. The figure is the database's
 * count, never the number of rows returned: a tally of a capped page once shipped "1,000
 * filings" against 8,896 (docs/SESSION_HANDOFF.md §2b). With no count, no figure.
 *
 * @param {object} f
 * @param {number|null} f.total  the database's count
 * @param {Array} f.rows         the rows the feed holds
 * @param {string[]} f.noun      [singular, plural]
 * @param {string} [f.scope]     what follows the noun, such as the window
 * @param {string} [f.detail]    a tally of the rows, so stated only when they are all of them
 * @param {function} f.part      k -> what to say when the feed holds only k of them
 */
function figure({ total, rows, noun: [one, many], scope, detail, part }) {
  const n = known(total)
  const tail = scope ? ` ${scope}` : ''
  if (n == null) return `count unavailable for ${many}${tail}`
  const head = `${num(n)} ${n === 1 ? one : many}${tail}`
  if (n === rows.length) return detail ? `${head} (${detail})` : head
  if (n > rows.length) return `${head} (${part(rows.length)})`
  return head
}

/** KEV descriptions read "<product> contains a <flaw>": the words before "contains" name the product. */
export function subjectOf(v) {
  if (v.vendor && v.product) return `${v.vendor} ${v.product}`
  const [before] = String(v.description || '').split(/\s+contains?\s+/i)
  const s = before.trim()
  return s.length > 60 ? s.slice(0, 57).trimEnd() + '…' : s || v.cve_id
}

/**
 * @param {object} rows
 * @param {Array} rows.actors      active groups whose claims are unusual for them (threat_actors.surge, 179):
 *   { id, name, surge_claims_7d, surge_days_7d, surge_baseline_mean, surge_p, surge_new_group,
 *   surge_window_end, origin_country?, origin_source? }; names from threat_actors_commercial,
 *   origins from actor_origins_commercial
 * @param {Array} rows.claims      incidents_commercial rows from the window
 * @param {object} rows.actorNames actor_id -> name, from threat_actors_commercial
 * @param {Array} rows.kev         vulnerabilities with kev_date in the window
 * @param {Array} rows.adp         cisa_ssvc rows (176, 177) rated active with assessed_at in the
 *   window, each with in_kev (true or false, from Vigil's copy of the KEV catalog) and the
 *   vulnerability's vendor, product and description where Vigil holds it
 * @param {Array} rows.disclosures victim_disclosures first seen in the window
 * @param {object} [rows.counts]   the database's exact counts behind each list
 *   ({ actors, claims, kev, adp, disclosures }); a missing or failed count is null
 * @param {Date} [now]
 */
/**
 * The feed's per-source `health` block, the shape Cordon's and Blackout's feeds carry: one entry per
 * source lane, `{ state, last_ok, checked_at, ... }`, read from feed_health (migrations 101, 153, 163).
 *
 * A lane is an item's first source id. COP's suite ledger files each item under its lane and ends it
 * only when that lane was read, which the kit decides as last_ok equal to checked_at and a state of
 * fresh or late (tic_doctrine.history.lanes_ok). So a source that failed, or stalled, ends nothing.
 *
 * Why it exists: from 22:15 UTC on 11 November 2026 RansomLook returned the same posts on every run
 * for 32.5 hours. Every run succeeded, and this feed read like a quiet day. A lane whose feed is
 * stalled (163: it runs, and has added nothing for longer than it does when working) has state
 * `stalled` and is not read.
 *
 * Each lane names the Vigil feeds (feed_health.feed_id) it rests on. `vigil` is Vigil's own
 * computation, the surge groups (179) and the summary: it rests on the claims and on the hourly trend
 * recompute, and is only as good as the worse of the two. The state attorney-general lanes all come
 * from one job.
 */
export const HEALTH_LANES = {
  ransomlook: ['ransomlook'],
  'cisa-kev': ['cisa-kev'],
  'cisa-vulnrichment': ['cisa-vulnrichment'],
  'sec-edgar': ['sec-edgar'],
  // Victim country. It has no items of its own, so this lane is how a collapse reaches COP (197).
  threatcluster: ['threatcluster'],
  'ca-ag': ['state-breach-notices'],
  'wa-ag': ['state-breach-notices'],
  'or-ag': ['state-breach-notices'],
  vigil: ['ransomlook', 'data-quality'],
}
export const HEALTH_FEEDS = [...new Set(Object.values(HEALTH_LANES).flat())]
const READ_STATES = new Set(['fresh', 'late'])
const STATE_RANK = { fresh: 0, late: 1, degraded: 2, stalled: 2, stale: 3, never: 4 }

/** "22:15 UTC on 11 Nov 2026". */
const clock = (d) => `${utc(d).slice(11, 16)} UTC on ${plain(d)}`

/** One Vigil feed's entry. A feed feed_health does not return reads `never`, not fine. */
export function feedEntry(row) {
  if (!row) return { state: 'never', last_ok: null, checked_at: null, last_status: null }
  // A feed already late or worse keeps that state; degraded only replaces a reading of fresh or late.
  const base = row.stalled === true ? 'stalled' : row.state || 'never'
  const state = row.below_floor === true && READ_STATES.has(base) ? 'degraded' : base
  const entry = {
    state,
    last_ok: row.last_success_at ? utc(row.last_success_at) : null,
    checked_at: row.last_attempt_at ? utc(row.last_attempt_at) : null,
    last_status: row.last_status ?? null,
  }
  // Only a feed watched for stalls says when it last brought something new: null means not watched.
  if (row.stalled === true || row.stalled === false) {
    entry.last_new = row.last_new_at ? utc(row.last_new_at) : null
    entry.stall_after_hours = row.stall_after_minutes / 60
  }
  if (state === 'stalled') {
    // 167: the count of new records began at new_counted_since. A feed with
    // nothing since then has not "never" added one; it has added none since.
    const since = row.last_new_at || row.new_counted_since
    entry.detail = since
      ? `Runs, but has added no record since ${clock(since)}, more than its ${entry.stall_after_hours}-hour limit`
      : 'Runs, but has never added a record'
  }
  if (state === 'degraded') {
    entry.last_rows = row.last_rows
    entry.min_rows = row.min_rows_per_run
    entry.detail = `Last run read ${row.last_rows} rows, under its floor of ${row.min_rows_per_run}`
  }
  return entry
}

const isRead = (e) => Boolean(e.last_ok) && e.last_ok === e.checked_at && READ_STATES.has(e.state)

/**
 * `health` from feed_health rows; null when they could not be read. Without the block the kit
 * counts every lane as read, which is how this feed behaved before 163; a block saying nothing was
 * read would be false, because the items it carries were read.
 */
export function healthBlock(rows) {
  if (!Array.isArray(rows)) return null
  const byId = Object.fromEntries(rows.map((r) => [r.feed_id, r]))
  const out = {}
  for (const [lane, feeds] of Object.entries(HEALTH_LANES)) {
    const entries = feeds.map((id) => ({ id, ...feedEntry(byId[id]) }))
    // The first feed not read decides the lane; if every one was read, the worst state does, and
    // the lane was last read when the earliest of them was.
    const unread = entries.find((e) => !isRead(e))
    const pick =
      unread || entries.reduce((a, b) => (STATE_RANK[b.state] > STATE_RANK[a.state] ? b : a))
    const { id, ...entry } = pick
    if (!unread && entries.length > 1) {
      const earliest = entries.map((e) => e.last_ok).sort()[0]
      entry.last_ok = earliest
      entry.checked_at = earliest
    }
    if (entries.length > 1 && unread) {
      entry.detail = `${id}: ${entry.detail || `state ${entry.state}, last status ${entry.last_status ?? 'none'}`}`
    }
    out[lane] = { ...entry, feeds }
  }
  return out
}

/**
 * The health block as published under contract 2.1, whose states are a closed list without `stalled`. A stalled lane
 * goes out as `stale` with `stalled: true`, so it is still not read and its detail still says why. A lane with no
 * attempt on record has no checked_at of its own: it is the time this feed looked and found none.
 */
export function contractHealth(health, published) {
  if (!health) return null
  return Object.fromEntries(
    Object.entries(health).map(([lane, e]) => [
      lane,
      {
        ...e,
        ...(e.state === 'stalled' ? { state: 'stale', stalled: true } : {}),
        ...(e.state === 'degraded' ? { state: 'stale', degraded: true } : {}),
        checked_at: e.checked_at || published,
      },
    ])
  )
}

/**
 * The summary's caveat when RansomLook has stalled. The claim count is then what RansomLook relayed,
 * which may be short of what the leak sites posted: absence and zero are different answers.
 */
export function stallCaveat(health) {
  const rl = health?.ransomlook
  if (rl?.state !== 'stalled') return null
  return rl.last_new
    ? `RansomLook has relayed no new claim since ${clock(rl.last_new)}, longer than it goes when working, so the claim count may be incomplete`
    : 'RansomLook has relayed no claim at all, so the claim count may be incomplete'
}

/**
 * `data_as_of` for what Vigil computes itself (the surge groups and the summary): when its
 * inputs were last taken in, never the request time. Until 18 Nov 2026 both carried the request
 * time, so a stalled worker still read fresh to COP, which judges Vigil by its newest data_as_of
 * (suite review of 15 Nov 2026).
 *
 * First the `vigil` lane's last_ok, which healthBlock gives as the earlier of the last successful
 * ransomlook and data-quality runs, or the last success of whichever was not read. When RansomLook
 * has stalled (it runs and adds nothing, as for 32.5 hours from 11 Nov), the lane carries its
 * last_new instead, the last time a claim actually arrived. Without the block, the newest claim's
 * day, a real data time that can only read older than the truth. The request time only when
 * there is neither, and then nothing in the feed rests on ingestion.
 */
export function computedAsOf(health, claims, published) {
  const lane = health?.vigil
  if (lane?.state === 'stalled' && lane.last_new) return lane.last_new
  if (lane?.last_ok) return lane.last_ok
  const days = claims.map((c) => c.discovered_date).filter(Boolean)
  if (days.length) return dayStart(days.reduce((a, b) => (String(b) > String(a) ? b : a)))
  return published
}

export function buildFeed(
  {
    actors = [],
    claims = [],
    actorNames = {},
    kev = [],
    adp = [],
    disclosures = [],
    counts = {},
    health = null,
  },
  now = new Date()
) {
  const published = utc(now)
  const asOf = computedAsOf(health, claims, published)
  const epssCutoff = new Date(now.getTime() - EPSS_CURRENT_DAYS * 86400000)
    .toISOString()
    .slice(0, 10)
  const day = published.slice(0, 10)
  const base = {
    contract: CONTRACT,
    program: 'vigil',
    kind: 'observation',
    status: 'actual',
    msg_type: 'new',
    human_review: 'none',
    method_version: METHOD,
    product_category: 'current',
    published_at: published,
    ie_aspect: ['informational'],
    pmesii_pt: ['information', 'economic'],
    ascope: ['events'],
  }
  const feats = []

  for (const a of actors) {
    // An attributed origin is published only with the source that gave it, and only on the actor: the item's
    // countries and map point are where victims were claimed, not where a catalog says the group is from.
    const originSrc = ORIGIN_SRC[a.origin_source] || null
    const originCc = originSrc ? iso2(a.origin_country) : null
    const countries = [
      ...new Set(
        claims
          .filter((c) => c.actor_id === a.id && !c.victim_country_withheld)
          .map((c) => iso2(c.victim_country))
          .filter(Boolean)
      ),
    ].sort()
    const itemSources = withSources(
      published,
      SRC.vigil,
      SRC.ransomlook,
      ...(originCc ? [originSrc] : [])
    )
    const actorSourceIds = ['ransomlook', ...(originCc ? [originSrc.id] : [])]
    feats.push(
      feature(null, {
        ...base,
        id: `vigil:${day}:actor:${a.id}`,
        subject_id: `vigil:actor:${a.id}`,
        ...surgeWindow(a.surge_window_end),
        signal: {
          name: 'victims_claimed_7d',
          value: Number(a.surge_claims_7d),
          unit: 'victims',
          ...(a.surge_baseline_mean == null ? {} : { expected: Number(a.surge_baseline_mean) }),
          tail: 'high',
          baseline_n: 8,
        },
        title:
          `${a.name} claimed ${a.surge_claims_7d} victims on ${a.surge_days_7d} days in the 7 days to ${plain(a.surge_window_end)}, ` +
          (a.surge_new_group
            ? 'with none in the 8 weeks before'
            : `unusual for the group: about ${perWeek(a.surge_baseline_mean)} a week in the 8 weeks before`),
        tier: 'anomaly',
        status_class: 'claimed',
        us_person_data: 'organizations',
        data_as_of: asOf,
        countries,
        actors: [
          {
            name: a.name,
            role: 'responsible',
            actor_type: 'criminal_group',
            status_class: 'claimed',
            source_ids: actorSourceIds,
            ...(originCc ? { country: originCc } : {}),
          },
        ],
        baseline_ref: BASE_GROUP,
        warning_problem_id: 'VG-WP-1',
        requirement_ids: ['VG-PIR-1'],
        indicator_id: 'VG-IND-1',
        hypothesis_id: 'VG-WP-1-H1',
        direction: 'neutral',
        indicator_state: 'present',
        precision_class: 'none',
        sources: itemSources,
        measures: {
          victims_7d: a.surge_claims_7d,
          posting_days_7d: a.surge_days_7d,
          window_end: a.surge_window_end,
          baseline_mean_per_week:
            a.surge_baseline_mean == null ? null : Number(a.surge_baseline_mean),
          baseline_weeks: 8,
          p_value: a.surge_p == null ? null : Number(a.surge_p),
          new_group: Boolean(a.surge_new_group),
          ...(originCc ? { origin_country: originCc, origin_source: originSrc.id } : {}),
        },
        visual: { type: 'page', url: `${SITE}/actors/${a.id}` },
      })
    )
  }

  for (const c of claims) {
    const knownActor = actorNames[c.actor_id] || null
    const actor = knownActor || 'An unnamed group'
    const victim = c.victim_name || 'an unnamed victim'
    const cc = !c.victim_country_withheld ? iso2(c.victim_country) : null
    const geom = cc ? point(cc) : null
    const sector = sectorsOf([c.victim_sector])
    const where = [c.victim_sector, cc].filter(Boolean).join(', ')
    const claimActors = []
    if (c.victim_name) {
      if (knownActor) {
        claimActors.push({
          name: knownActor,
          role: 'responsible',
          actor_type: 'criminal_group',
          status_class: 'claimed',
          source_ids: ['ransomlook'],
        })
      }
      claimActors.push({
        name: c.victim_name,
        role: 'affected',
        actor_type: 'company',
        status_class: 'claimed',
        ...(cc ? { country: cc } : {}),
      })
    }
    feats.push(
      feature(geom, {
        ...base,
        id: `vigil:claim:${c.incident_id}`,
        ...onceAt(`vigil:claim:${c.incident_id}`, dayStart(c.discovered_date), 'day'),
        title: `${actor} claims ${victim}${where ? ` (${where})` : ''}`,
        tier: 'routine',
        status_class: 'claimed',
        us_person_data: c.victim_name ? 'organizations' : 'none',
        data_as_of: dayStart(c.discovered_date),
        countries: cc ? [cc] : [],
        ...(claimActors.length ? { actors: claimActors } : {}),
        warning_problem_id: 'VG-WP-1',
        requirement_ids: ['VG-PIR-1'],
        precision_class: geom ? 'country' : 'none',
        ...(sector.length ? { sector } : {}),
        sources: withSources(published, SRC.ransomlook),
        link: `${SITE}/incidents`,
        ...(geom ? {} : { visual: { type: 'page', url: `${SITE}/incidents` } }),
      })
    )
  }

  for (const v of kev) {
    const ransomware = Boolean(v.ransomware_use || v.ransomware_campaign_use)
    const current = Boolean(v.epss_date && String(v.epss_date).slice(0, 10) >= epssCutoff)
    const epss = v.epss_score == null ? null : Number(v.epss_score)
    const alert = ransomware && current && epss != null && epss >= EPSS_ALERT
    const bits = [
      ransomware ? 'known ransomware use' : null,
      epss != null ? `EPSS ${epss.toFixed(2)}${current ? '' : ' (not current)'}` : null,
    ]
    feats.push(
      feature(null, {
        ...base,
        id: `vigil:kev:${v.cve_id}`,
        ...onceAt(`vigil:kev:${v.cve_id}`, dayStart(v.kev_date), 'day'),
        ...(alert
          ? { signal: { name: 'epss', value: epss, unit: 'probability', tail: 'high' } }
          : {}),
        title: `${v.cve_id} (${subjectOf(v)}) added to CISA's KEV catalog on ${plain(v.kev_date)}${bits.some(Boolean) ? `; ${bits.filter(Boolean).join(', ')}` : ''}`,
        tier: alert ? 'anomaly' : 'routine',
        status_class: 'reported',
        us_person_data: 'organizations',
        data_as_of: dayStart(v.kev_date),
        countries: [],
        warning_problem_id: 'VG-WP-2',
        requirement_ids: ['VG-PIR-2'],
        indicator_id: alert ? 'VG-IND-6' : 'VG-IND-5',
        hypothesis_id: 'VG-WP-2-H1',
        direction: alert ? 'supports' : 'neutral',
        indicator_state: 'present',
        ...(alert ? { baseline_ref: BASE_EPSS } : {}),
        precision_class: 'none',
        sources: withSources(published, SRC.kev, ...(epss != null ? [SRC.epss] : [])),
        measures: {
          epss,
          epss_date: v.epss_date || null,
          cvss: v.cvss_score ?? null,
          ransomware_use: ransomware,
        },
        visual: { type: 'page', url: `${SITE}/vulnerabilities` },
      })
    )
  }

  // CISA's ADP assessment (176): its own line, never labelled KEV. "Not in CISA's KEV catalog"
  // only where Vigil's copy of the catalog says so (in_kev false); the cisa-kev lane's health says
  // whether that copy is current.
  for (const a of adp) {
    const named = Boolean(a.vendor || a.product || a.description)
    const subject = named ? subjectOf(a) : null
    const notKev = a.in_kev === false
    feats.push(
      feature(null, {
        ...base,
        id: `vigil:adp:${a.cve_id}`,
        ...onceAt(`vigil:adp:${a.cve_id}`, utc(a.assessed_at)),
        title: `CISA's ADP assessment of ${a.cve_id}${subject && subject !== a.cve_id ? ` (${subject})` : ''}: exploitation active (assessed ${plain(a.assessed_at)})${notKev ? "; not in CISA's KEV catalog" : ''}`,
        tier: 'routine',
        status_class: 'reported',
        us_person_data: named ? 'organizations' : 'none',
        data_as_of: utc(a.assessed_at),
        countries: [],
        // No indicator yet: VG-WP-2's hypotheses are frozen (30 Oct 2026), and an indicator must
        // name one. Carried like a disclosure, under the warning problem and requirement only.
        warning_problem_id: 'VG-WP-2',
        requirement_ids: ['VG-PIR-2'],
        precision_class: 'none',
        sources: withSources(published, SRC.adp),
        measures: {
          exploitation: 'active',
          automatable: a.automatable ?? null,
          technical_impact: a.technical_impact ?? null,
          assessed_at: utc(a.assessed_at),
          in_kev: a.in_kev ?? null,
          kev_date: a.in_kev ? a.kev_date || null : null,
        },
        visual: { type: 'page', url: `${SITE}/vulnerabilities` },
      })
    )
  }

  for (const d of disclosures) {
    const sec = d.source === 'sec-edgar'
    const to = sec
      ? 'the SEC (Form 8-K Item 1.05)'
      : `the ${REGULATOR[d.source] || 'state'} attorney general`
    const people =
      d.persons_affected != null
        ? `; ${Number(d.persons_affected).toLocaleString('en-US')} people affected${d.persons_affected_scope === 'state_residents' ? ' in that state' : ''}`
        : ''
    feats.push(
      feature(null, {
        ...base,
        id: `vigil:disclosure:${d.id}`,
        ...onceAt(
          `vigil:disclosure:${d.id}`,
          d.filed_date ? dayStart(d.filed_date) : utc(d.first_seen),
          d.filed_date ? 'day' : null
        ),
        title: `${d.company_name} reported a data breach to ${to}${people}`,
        tier: 'routine',
        status_class: 'reported',
        us_person_data: 'organizations',
        data_as_of: d.filed_date ? dayStart(d.filed_date) : utc(d.first_seen),
        countries: ['US'],
        warning_problem_id: 'VG-WP-1',
        requirement_ids: ['VG-PIR-3'],
        precision_class: 'none',
        sources: withSources(
          published,
          sec
            ? { ...SRC.sec, url: d.filing_url || SRC.sec.url }
            : { ...SRC.stateAg, url: d.filing_url || undefined, id: d.source }
        ),
        measures: {
          persons_affected: d.persons_affected ?? null,
          scope: d.persons_affected_scope || null,
          match_status: d.match_status || null,
        },
        visual: { type: 'page', url: `${SITE}/disclosures` },
      })
    )
  }

  const count = (pred) => feats.filter(pred).length
  const mapped = count((f) => f.properties.id.startsWith('vigil:claim:') && f.geometry)
  const alerts = count((f) => f.properties.indicator_id === 'VG-IND-6')
  const adpNotKev = adp.filter((a) => a.in_kev === false).length
  // Each window by the first date it includes. The year only when it is not this year's.
  const start = windowStarts(now)
  const since = (d) => (d.startsWith(day.slice(0, 4)) ? plain(d).replace(/ \d{4}$/, '') : plain(d))
  const latest = (k) => `the latest ${num(k)} in this feed`
  const summary = feature(null, {
    ...base,
    id: `vigil:${day}:summary`,
    subject_id: 'vigil:feed:summary',
    event_start: dayStart(start.kev),
    event_end: published,
    last_change: 'none',
    title:
      `Vigil, ${plain(now)}: ` +
      [
        figure({
          total: counts.actors,
          rows: actors,
          noun: ['group with unusual claims', 'groups with unusual claims'],
          part: (k) => `${num(k)} named in this feed`,
        }),
        figure({
          total: counts.claims,
          rows: claims,
          noun: ['leak-site claim', 'leak-site claims'],
          scope: `since ${since(start.claims)}`,
          detail: `${num(mapped)} placed on the map`,
          part: latest,
        }),
        figure({
          total: counts.kev,
          rows: kev,
          noun: ['KEV addition', 'KEV additions'],
          scope: `since ${since(start.kev)}`,
          detail: `${num(alerts)} ${alerts === 1 ? 'meets' : 'meet'} the EPSS alert`,
          part: latest,
        }),
        figure({
          total: counts.adp,
          rows: adp,
          noun: [
            "CVE CISA's ADP assessed as exploitation active",
            "CVEs CISA's ADP assessed as exploitation active",
          ],
          scope: `since ${since(start.adp)}`,
          detail: `${num(adpNotKev)} not in KEV`,
          part: latest,
        }),
        figure({
          total: counts.disclosures,
          rows: disclosures,
          noun: ['breach notice', 'breach notices'],
          scope: `first seen since ${since(start.disclosures)}`,
          part: latest,
        }),
      ].join('; ') +
      (stallCaveat(health) ? `. ${stallCaveat(health)}` : ''),
    tier: 'routine',
    status_class: 'reported',
    us_person_data: 'none',
    data_as_of: asOf,
    countries: [],
    requirement_ids: ['VG-PIR-1', 'VG-PIR-2', 'VG-PIR-3'],
    precision_class: 'none',
    sources: withSources(
      published,
      SRC.vigil,
      SRC.ransomlook,
      SRC.kev,
      SRC.adp,
      SRC.stateAg,
      SRC.sec
    ),
    visual: { type: 'page', url: SITE },
  })
  return {
    type: 'FeatureCollection',
    contract: CONTRACT,
    contract_rev: CONTRACT_REV,
    kit: KIT_VERSION,
    program: 'vigil',
    generated_at: published,
    licence: `Vigil terms of use (${SITE}); claims from RansomLook (CC BY 4.0); CISA and SEC data US public domain; CISA Vulnrichment CC0-1.0`,
    attribution:
      'Vigil, The Intelligence Company. Leak-site claims: RansomLook (CC BY 4.0). KEV: CISA. ADP assessments: CISA Vulnrichment (CC0). EPSS: FIRST.',
    language_key: LANGUAGE_KEY,
    ...(health ? { health: contractHealth(health, published) } : {}),
    features: [summary, ...feats],
  }
}
