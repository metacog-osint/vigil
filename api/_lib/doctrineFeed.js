/**
 * Vigil in The Intelligence Company's feed contract v2 (tic-feed/2), as GeoJSON.
 *
 * A pure function of database rows, so it is tested without a network. Every item is a
 * measurement (kind observation): escalating groups, leak-site claims, KEV additions and
 * victim disclosures, plus one summary. Judged warnings wait for doctrine/indicators.json.
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
export const SITE = 'https://vigil.theintelligence.company'
export const METHOD = 'vigil-feed-1.0'
export const EPSS_ALERT = 0.5
export const EPSS_CURRENT_DAYS = 3 // migration 159: an older score is stale
export const LANGUAGE_KEY =
  'https://github.com/metacog-osint/vigil/blob/main/doctrine/kit/docs/language-key.md'

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
  vigil: {
    id: 'vigil',
    publisher: 'Vigil, The Intelligence Company',
    url: SITE,
    licence: 'Vigil terms of use',
    grade: 'B2',
    independence_group: 'vigil',
    source_type: 'derived',
    descriptor: "Vigil's own computation from the claims it holds (migration 077 trend rule).",
  },
}
const REGULATOR = { 'ca-ag': 'California', 'wa-ag': 'Washington', 'or-ag': 'Oregon' }
const BASE_WEEK = {
  id: 'vigil-actor-week',
  window: 'previous 7 days',
  type: 'rolling',
  version: '077',
}
const BASE_EPSS = {
  id: 'epss-0.5',
  window: 'current FIRST EPSS score against a fixed 0.5 threshold',
  type: 'fixed',
  version: '1',
}

const utc = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z')
const dayStart = (date) => `${String(date).slice(0, 10)}T00:00:00Z`
const plain = (d) =>
  new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
const sectorsOf = (names) =>
  [
    ...new Set((names || []).map((n) => SECTOR_MAP[String(n || '').toLowerCase()]).filter(Boolean)),
  ].sort()
const withSources = (accessed, ...list) => list.map((s) => ({ ...s, accessed_at: accessed }))
const point = (cc) => {
  const p = countryPoint(cc)
  return p ? { type: 'Point', coordinates: [p[1], p[0]] } : null
}
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties })

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

/**
 * One figure in the summary title, for a window the row query caps. The figure is the
 * database's count, never the number of rows returned: a tally of a capped page once shipped
 * "1,000 filings" against 8,896 (docs/SESSION_HANDOFF.md §2b). With no count, no figure.
 * `detail` tallies the rows, so it is stated only when the rows are the whole window.
 */
function windowClause(total, rows, what, detail) {
  const n = known(total)
  if (n == null) return `count unavailable for ${what}`
  if (n === rows.length) return `${n} ${what}${detail ? ` (${detail})` : ''}`
  if (n > rows.length) return `${n} ${what} (the latest ${rows.length} in this feed)`
  return `${n} ${what}`
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
 * @param {Array} rows.actors      escalating active groups: { id, name, incidents_7d }, name from threat_actors_commercial
 * @param {Array} rows.claims      incidents_commercial rows from the window
 * @param {object} rows.actorNames actor_id -> name, from threat_actors_commercial
 * @param {Array} rows.kev         vulnerabilities with kev_date in the window
 * @param {Array} rows.disclosures victim_disclosures first seen in the window
 * @param {object} [rows.counts]   the database's exact counts for the claims, kev and
 *   disclosures windows ({ claims, kev, disclosures }); a missing or failed count is null
 * @param {Date} [now]
 */
export function buildFeed(
  { actors = [], claims = [], actorNames = {}, kev = [], disclosures = [], counts = {} },
  now = new Date()
) {
  const published = utc(now)
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
    feats.push(
      feature(null, {
        ...base,
        id: `vigil:${day}:actor:${a.id}`,
        title: `${a.name} is escalating: ${a.incidents_7d} victims claimed in 7 days, more than 1.25x the week before`,
        tier: 'anomaly',
        status_class: 'claimed',
        us_person_data: 'organizations',
        data_as_of: published,
        countries: [],
        baseline_ref: BASE_WEEK,
        warning_problem_id: 'VG-WP-1',
        requirement_ids: ['VG-PIR-1'],
        indicator_id: 'VG-IND-1',
        hypothesis_id: 'VG-WP-1-H1',
        direction: 'neutral',
        indicator_state: 'present',
        precision_class: 'none',
        sources: withSources(published, SRC.vigil, SRC.ransomlook),
        measures: { victims_7d: a.incidents_7d },
        visual: { type: 'page', url: `${SITE}/actors/${a.id}` },
      })
    )
  }

  for (const c of claims) {
    const actor = actorNames[c.actor_id] || 'An unnamed group'
    const victim = c.victim_name || 'an unnamed victim'
    const cc =
      c.victim_country && !c.victim_country_withheld ? String(c.victim_country).toUpperCase() : null
    const geom = cc ? point(cc) : null
    const sector = sectorsOf([c.victim_sector])
    const where = [c.victim_sector, cc].filter(Boolean).join(', ')
    feats.push(
      feature(geom, {
        ...base,
        id: `vigil:claim:${c.incident_id}`,
        title: `${actor} claims ${victim}${where ? ` (${where})` : ''}`,
        tier: 'routine',
        status_class: 'claimed',
        us_person_data: c.victim_name ? 'organizations' : 'none',
        data_as_of: dayStart(c.discovered_date),
        countries: cc ? [cc] : [],
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
  const summary = feature(null, {
    ...base,
    id: `vigil:${day}:summary`,
    title:
      `Vigil, ${plain(now)}: ${actors.length} groups escalating; ` +
      [
        windowClause(
          counts.claims,
          claims,
          'leak-site claims in 48 hours',
          `${mapped} placed on the map`
        ),
        windowClause(counts.kev, kev, 'KEV additions in 7 days', `${alerts} meet the EPSS alert`),
        windowClause(counts.disclosures, disclosures, 'breach notices in 7 days'),
      ].join('; '),
    tier: 'routine',
    status_class: 'reported',
    us_person_data: 'none',
    data_as_of: published,
    countries: [],
    requirement_ids: ['VG-PIR-1', 'VG-PIR-2', 'VG-PIR-3'],
    precision_class: 'none',
    sources: withSources(published, SRC.vigil, SRC.ransomlook, SRC.kev, SRC.stateAg, SRC.sec),
    visual: { type: 'page', url: SITE },
  })
  return {
    type: 'FeatureCollection',
    contract: CONTRACT,
    program: 'vigil',
    generated_at: published,
    licence: `Vigil terms of use (${SITE}); claims from RansomLook (CC BY 4.0); CISA and SEC data US public domain`,
    attribution:
      'Vigil, The Intelligence Company. Leak-site claims: RansomLook (CC BY 4.0). KEV: CISA. EPSS: FIRST.',
    language_key: LANGUAGE_KEY,
    features: [summary, ...feats],
  }
}
