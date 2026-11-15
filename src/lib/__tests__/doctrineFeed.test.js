// @vitest-environment node
/**
 * Vigil's feed contract v2 builder (api/_lib/doctrineFeed.js). The last test runs the doctrine
 * kit's own tradecraft linter (Python, standard library) over the output when Python is present.
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildFeed,
  countFromRange,
  healthBlock,
  HEALTH_FEEDS,
  HEALTH_LANES,
  SECTOR_MAP,
  stallCaveat,
  subjectOf,
  windowStarts,
} from '../../../api/_lib/doctrineFeed.js'

const ROOT = resolve(__dirname, '../../..')
const NOW = new Date('2026-10-30T18:00:00Z')

const rows = () => ({
  actors: [{ id: 'a-akira', name: 'Akira', incidents_7d: 14 }],
  actorNames: { 'a-akira': 'Akira', 'a-qilin': 'Qilin' },
  claims: [
    {
      incident_id: 'i1',
      actor_id: 'a-akira',
      victim_name: 'Example Dental Group',
      discovered_date: '2026-10-30',
      victim_country: 'us',
      victim_sector: 'healthcare',
    },
    {
      incident_id: 'i2',
      actor_id: 'a-qilin',
      victim_name: 'Beispiel GmbH',
      discovered_date: '2026-10-29',
      victim_country: null,
      victim_sector: null,
    },
    {
      incident_id: 'i3',
      actor_id: 'a-gone',
      victim_name: null,
      discovered_date: '2026-10-29',
      victim_country: 'DE',
      victim_country_withheld: true,
    },
  ],
  kev: [
    {
      cve_id: 'CVE-2026-0001',
      kev_date: '2026-10-28',
      epss_score: 0.71,
      epss_date: '2026-10-30',
      ransomware_use: true,
      vendor: 'Acme',
      product: 'Gateway',
    },
    {
      cve_id: 'CVE-2026-0002',
      kev_date: '2026-10-27',
      epss_score: 0.9,
      epss_date: '2026-10-20',
      ransomware_use: true,
      description: 'Foo Server contains a path traversal',
    },
    {
      cve_id: 'CVE-2026-0003',
      kev_date: '2026-10-26',
      epss_score: null,
      ransomware_use: false,
      description: 'Bar contains a flaw',
    },
  ],
  disclosures: [
    {
      id: 'd1',
      company_name: 'Example Corp',
      source: 'ca-ag',
      filed_date: '2026-10-28',
      first_seen: '2026-10-29T10:00:00Z',
      persons_affected: 12345,
      persons_affected_scope: 'state_residents',
      filing_url: 'https://oag.ca.gov/x',
      match_status: 'unreviewed',
    },
    {
      id: 'd2',
      company_name: 'Listed Inc',
      source: 'sec-edgar',
      filed_date: null,
      first_seen: '2026-10-29T12:00:00Z',
      persons_affected: null,
    },
  ],
  // The database's counts behind each list; here the rows are all of them.
  counts: { actors: 1, claims: 3, kev: 3, disclosures: 2 },
})

const byId = (fc) => Object.fromEntries(fc.features.map((f) => [f.properties.id, f]))
const summaryTitle = (fc) => fc.features[0].properties.title

/**
 * feed_health rows (migration 163) at NOW, shaped like the 11-13 November 2026 stall: ransomlook
 * runs and succeeds, and has added nothing since 22:15 the day before.
 */
const healthRows = () => [
  {
    feed_id: 'ransomlook',
    state: 'fresh',
    last_status: 'success',
    last_success_at: '2026-10-30T17:45:39.53+00:00',
    last_attempt_at: '2026-10-30T17:45:39.53+00:00',
    stall_after_minutes: 1080,
    last_new_at: '2026-10-29T22:15:39.208+00:00',
    stalled: true,
  },
  {
    feed_id: 'data-quality',
    state: 'fresh',
    last_status: 'success',
    last_success_at: '2026-10-30T17:50:00+00:00',
    last_attempt_at: '2026-10-30T17:50:00+00:00',
    stall_after_minutes: null,
    last_new_at: null,
    stalled: null,
  },
  {
    feed_id: 'cisa-kev',
    state: 'fresh',
    last_status: 'success',
    last_success_at: '2026-10-30T16:00:00+00:00',
    last_attempt_at: '2026-10-30T16:00:00+00:00',
    stall_after_minutes: null,
    last_new_at: '2026-10-28T16:00:00+00:00',
    stalled: null,
  },
  {
    // An error after the last success: the source was not read on the latest attempt.
    feed_id: 'sec-edgar',
    state: 'fresh',
    last_status: 'error',
    last_success_at: '2026-10-30T10:00:00+00:00',
    last_attempt_at: '2026-10-30T16:00:00+00:00',
    stall_after_minutes: null,
    last_new_at: null,
    stalled: null,
  },
  {
    feed_id: 'state-breach-notices',
    state: 'late',
    last_status: 'success',
    last_success_at: '2026-10-29T17:47:03.794+00:00',
    last_attempt_at: '2026-10-29T17:47:03.794+00:00',
    stall_after_minutes: null,
    last_new_at: '2026-10-29T17:47:03.794+00:00',
    stalled: null,
  },
]

// The doctrine kit's rule for a lane read (tic_doctrine.history.lanes_ok), which COP's ledger applies.
const laneRead = (v) =>
  Boolean(v.last_ok) &&
  v.last_ok === v.checked_at &&
  (v.state == null || ['fresh', 'late', 'up'].includes(v.state))

describe('doctrineFeed', () => {
  it('builds a contract v2 FeatureCollection with a summary first', () => {
    const fc = buildFeed(rows(), NOW)
    expect(fc).toMatchObject({
      type: 'FeatureCollection',
      contract: 'tic-feed/2',
      program: 'vigil',
      generated_at: '2026-10-30T18:00:00Z',
    })
    const head = fc.features[0].properties
    expect(head.id).toBe('vigil:2026-10-30:summary')
    // Each window is named by the first date it includes, which is the date queried from.
    expect(head.title).toBe(
      'Vigil, 30 Oct 2026: 1 escalating group; ' +
        '3 leak-site claims since 28 Oct (1 placed on the map); ' +
        '3 KEV additions since 23 Oct (1 meets the EPSS alert); ' +
        '2 breach notices first seen since 23 Oct'
    )
    expect(fc.features).toHaveLength(1 + 1 + 3 + 3 + 2)
  })

  it('dates each window from the same start the queries use, with the year when it differs', () => {
    expect(windowStarts(NOW)).toEqual({
      claims: '2026-10-28',
      kev: '2026-10-23',
      disclosures: '2026-10-23',
    })
    const newYear = new Date('2027-01-01T05:00:00Z')
    expect(windowStarts(newYear).claims).toBe('2026-12-30')
    const title = summaryTitle(buildFeed(rows(), newYear))
    expect(title).toMatch(/^Vigil, 1 Jan 2027: /)
    expect(title).toContain('leak-site claims since 30 Dec 2026')
    expect(title).toContain('KEV additions since 25 Dec 2026')
    // September is "Sep", not ICU's "Sept".
    expect(summaryTitle(buildFeed(rows(), new Date('2026-09-04T12:00:00Z')))).toMatch(
      /^Vigil, 4 Sep 2026: .* since 2 Sep \(/
    )
  })

  it("states the database's count when there are more than the rows returned", () => {
    // A busy stretch: the row queries stop at their caps, the counts do not. Escalating
    // groups also outnumber the rows when a group's name only a restricted source supplied.
    const fc = buildFeed(
      { ...rows(), counts: { actors: 3, claims: 4500, kev: 120, disclosures: 2 } },
      NOW
    )
    const title = summaryTitle(fc)
    expect(title).toContain('3 escalating groups (1 named in this feed)')
    expect(title).toContain('4,500 leak-site claims since 28 Oct (the latest 3 in this feed)')
    expect(title).toContain('120 KEV additions since 23 Oct (the latest 3 in this feed)')
    expect(title).toContain('2 breach notices first seen since 23 Oct')
    // A tally of a capped page is not a count, so no sub-figure is drawn from one.
    expect(title).not.toContain('placed on the map')
    expect(title).not.toContain('EPSS alert')
    expect(title).not.toMatch(/\b3 leak-site claims/)
    // The items themselves are unchanged.
    expect(fc.features).toHaveLength(1 + 1 + 3 + 3 + 2)
  })

  it('states no figure for a count that failed, and never reads it as zero', () => {
    const counted = /\d+ (escalating group|leak-site claim|KEV addition|breach notice)/
    const fc = buildFeed(
      {
        ...rows(),
        counts: { actors: null, claims: null, kev: Number.NaN, disclosures: undefined },
      },
      NOW
    )
    const title = summaryTitle(fc)
    expect(title).toContain('count unavailable for escalating groups')
    expect(title).toContain('count unavailable for leak-site claims since 28 Oct')
    expect(title).toContain('count unavailable for KEV additions since 23 Oct')
    expect(title).toContain('count unavailable for breach notices first seen since 23 Oct')
    expect(title).not.toMatch(counted)
    expect(title).not.toContain('placed on the map')
    expect(fc.features).toHaveLength(1 + 1 + 3 + 3 + 2)

    // No counts at all is the same as failed counts, not a fallback to the rows.
    const bare = rows()
    delete bare.counts
    expect(summaryTitle(buildFeed(bare, NOW))).not.toMatch(counted)
    // Only a whole, non-negative number is a count.
    const junk = buildFeed(
      { ...rows(), counts: { actors: '1', claims: '3', kev: -1, disclosures: 2.5 } },
      NOW
    )
    expect(summaryTitle(junk)).not.toMatch(counted)
  })

  it('reads the total from a PostgREST Content-Range header', () => {
    expect(countFromRange('0-299/450')).toBe(450)
    expect(countFromRange('0-86/87')).toBe(87)
    expect(countFromRange('*/0')).toBe(0)
    expect(countFromRange('0-86/*')).toBeNull()
    expect(countFromRange('')).toBeNull()
    expect(countFromRange(null)).toBeNull()
  })

  it('publishes claims as claims, placed only when the country is not withheld', () => {
    const f = byId(buildFeed(rows(), NOW))
    const i1 = f['vigil:claim:i1']
    expect(i1.properties).toMatchObject({
      status_class: 'claimed',
      us_person_data: 'organizations',
      countries: ['US'],
      precision_class: 'country',
      sector: ['healthcare_and_public_health'],
      actors: [
        {
          name: 'Akira',
          role: 'responsible',
          actor_type: 'criminal_group',
          status_class: 'claimed',
          source_ids: ['ransomlook'],
        },
        {
          name: 'Example Dental Group',
          role: 'affected',
          actor_type: 'company',
          status_class: 'claimed',
          country: 'US',
        },
      ],
    })
    expect(i1.geometry.type).toBe('Point')
    expect(i1.properties.title).toBe('Akira claims Example Dental Group (healthcare, US)')
    const i3 = f['vigil:claim:i3']
    expect(i3.geometry).toBeNull()
    expect(i3.properties).toMatchObject({
      countries: [],
      us_person_data: 'none',
      title: 'An unnamed group claims an unnamed victim',
    })
    expect(i3.properties.visual.url).toMatch(/\/incidents$/)
  })

  it('puts an attributed origin on the actor, cited to its own source, and places the item by victims', () => {
    const input = rows()
    input.actors = [
      {
        id: 'a-akira',
        name: 'Akira',
        incidents_7d: 14,
        origin_country: 'RU',
        origin_source: 'misp-galaxy',
      },
    ]
    const actor = byId(buildFeed(input, NOW))['vigil:2026-10-30:actor:a-akira']
    expect(actor.properties.countries).toEqual(['US'])
    expect(actor.geometry).toBeNull()
    expect(actor.properties.precision_class).toBe('none')
    expect(actor.properties.actors).toEqual([
      {
        name: 'Akira',
        role: 'responsible',
        actor_type: 'criminal_group',
        status_class: 'claimed',
        source_ids: ['ransomlook', 'misp-galaxy'],
        country: 'RU',
      },
    ])
    expect(actor.properties.measures).toMatchObject({
      origin_country: 'RU',
      origin_source: 'misp-galaxy',
    })
    expect(actor.properties.sources.map((s) => s.id)).toContain('misp-galaxy')
  })

  it('cites MITRE ATT&CK for an origin from ATT&CK, and leaves out an origin it cannot cite', () => {
    const input = rows()
    input.actors = [
      {
        id: 'a-akira',
        name: 'Akira',
        incidents_7d: 14,
        origin_country: 'ru',
        origin_source: 'mitre-attack',
      },
      {
        id: 'a-other',
        name: 'Other',
        incidents_7d: 9,
        origin_country: 'CN',
        origin_source: 'etda',
      },
    ]
    const f = byId(buildFeed(input, NOW))
    const akira = f['vigil:2026-10-30:actor:a-akira'].properties
    expect(akira.actors[0]).toMatchObject({
      country: 'RU',
      source_ids: ['ransomlook', 'mitre-attack'],
    })
    expect(akira.sources.map((s) => s.id)).toEqual(['vigil', 'ransomlook', 'mitre-attack'])
    const other = f['vigil:2026-10-30:actor:a-other'].properties
    expect(other.actors[0].country).toBeUndefined()
    expect(other.actors[0].source_ids).toEqual(['ransomlook'])
    expect(other.measures.origin_country).toBeUndefined()
    expect(other.sources.map((s) => s.id)).not.toContain('misp-galaxy')
  })

  it('raises the EPSS alert only on a current score with known ransomware use', () => {
    const f = byId(buildFeed(rows(), NOW))
    expect(f['vigil:kev:CVE-2026-0001'].properties).toMatchObject({
      tier: 'anomaly',
      indicator_id: 'VG-IND-6',
      direction: 'supports',
    })
    expect(f['vigil:kev:CVE-2026-0001'].properties.baseline_ref.type).toBe('fixed')
    const stale = f['vigil:kev:CVE-2026-0002'].properties
    expect(stale).toMatchObject({ tier: 'routine', indicator_id: 'VG-IND-5' })
    expect(stale.title).toContain('EPSS 0.90 (not current)')
    expect(f['vigil:kev:CVE-2026-0003'].properties.sources.map((s) => s.id)).toEqual(['cisa-kev'])
  })

  it('names the regulator and the scope of people affected', () => {
    const f = byId(buildFeed(rows(), NOW))
    expect(f['vigil:disclosure:d1'].properties.title).toBe(
      'Example Corp reported a data breach to the California attorney general; 12,345 people affected in that state'
    )
    expect(f['vigil:disclosure:d2'].properties.title).toBe(
      'Listed Inc reported a data breach to the SEC (Form 8-K Item 1.05)'
    )
  })

  it('takes KEV product names from vendor and product, else the description', () => {
    expect(subjectOf({ vendor: 'Acme', product: 'Gateway' })).toBe('Acme Gateway')
    expect(subjectOf({ description: 'Foo Server contains a path traversal' })).toBe('Foo Server')
  })

  it('keeps its sector map equal to the doctrine register', () => {
    const reg = JSON.parse(readFileSync(join(ROOT, 'doctrine', 'ncf_map.json'), 'utf8'))
    expect(SECTOR_MAP).toEqual(reg.sector_map)
  })

  it("passes the doctrine kit's tradecraft linter", () => {
    const py = ['python3', 'python'].find((cmd) => spawnSync(cmd, ['--version']).status === 0)
    if (!py) return // no Python on this machine; CI has it
    // Without a health block, and with one carrying the stall and the summary's caveat.
    for (const fc of [
      buildFeed(rows(), NOW),
      buildFeed({ ...rows(), health: healthBlock(healthRows()) }, NOW),
    ]) {
      const file = join(mkdtempSync(join(tmpdir(), 'vigil-feed-')), 'feed.geojson')
      writeFileSync(file, JSON.stringify(fc))
      const run = spawnSync(
        py,
        [join(ROOT, 'doctrine/kit/tic.py'), 'lint', file, '--doctrine', join(ROOT, 'doctrine')],
        {
          encoding: 'utf8',
        }
      )
      expect(run.stdout).toContain('Result: PASS')
      expect(run.status).toBe(0)
    }
    // Two linter runs: 9.1 s on a slow drive, past the 5 s default.
  }, 60_000)
})

describe('the health block (migration 163)', () => {
  const health = () => healthBlock(healthRows())

  it('marks a stalled RansomLook as stalled, so its lane is not read', () => {
    const rl = health().ransomlook
    expect(rl).toEqual({
      state: 'stalled',
      last_ok: '2026-10-30T17:45:39Z',
      checked_at: '2026-10-30T17:45:39Z',
      last_status: 'success',
      last_new: '2026-10-29T22:15:39Z',
      stall_after_hours: 18,
      detail:
        'Runs, but has added no record since 22:15 UTC on 29 Oct 2026, more than its 18-hour limit',
      feeds: ['ransomlook'],
    })
    expect(laneRead(rl)).toBe(false)
  })

  it("takes Vigil's own lane from the worse of the claims and the trend recompute", () => {
    const vigil = health().vigil
    expect(vigil.state).toBe('stalled')
    expect(vigil.feeds).toEqual(['ransomlook', 'data-quality'])
    expect(vigil.detail).toMatch(/^ransomlook: Runs, but has added no record since/)
    expect(laneRead(vigil)).toBe(false)

    // With RansomLook working, the lane was last read when the earlier of the two was.
    const working = healthRows().map((r) =>
      r.feed_id === 'ransomlook' ? { ...r, stalled: false, last_new_at: r.last_success_at } : r
    )
    const ok = healthBlock(working).vigil
    expect(ok).toMatchObject({
      state: 'fresh',
      last_ok: '2026-10-30T17:45:39Z',
      checked_at: '2026-10-30T17:45:39Z',
    })
    expect(laneRead(ok)).toBe(true)
  })

  it('leaves a lane unread when the latest attempt failed', () => {
    const sec = health()['sec-edgar']
    expect(sec.last_ok).toBe('2026-10-30T10:00:00Z')
    expect(sec.checked_at).toBe('2026-10-30T16:00:00Z')
    expect(laneRead(sec)).toBe(false)
  })

  it('reads a late daily feed as read, as the kit does, and names the job behind each state', () => {
    const h = health()
    for (const lane of ['ca-ag', 'wa-ag', 'or-ag']) {
      expect(h[lane]).toMatchObject({ state: 'late', feeds: ['state-breach-notices'] })
      expect(laneRead(h[lane])).toBe(true)
    }
    expect(laneRead(h['cisa-kev'])).toBe(true)
  })

  it('says when a feed last brought something only for feeds watched for stalls', () => {
    const h = health()
    expect(h['cisa-kev']).not.toHaveProperty('last_new')
    expect(h['cisa-kev']).not.toHaveProperty('stall_after_hours')
  })

  it('reads a feed the database did not return as never, not as fine', () => {
    const h = healthBlock(healthRows().filter((r) => r.feed_id !== 'cisa-kev'))
    expect(h['cisa-kev']).toMatchObject({ state: 'never', last_ok: null, checked_at: null })
    expect(laneRead(h['cisa-kev'])).toBe(false)
  })

  it('is null when feed_health could not be read, and the feed then carries no block', () => {
    expect(healthBlock(null)).toBeNull()
    expect(buildFeed(rows(), NOW)).not.toHaveProperty('health')
    expect(buildFeed({ ...rows(), health: healthBlock(null) }, NOW)).not.toHaveProperty('health')
  })

  it('names a lane for every source an item can come from, so none falls back to the program', () => {
    const fc = buildFeed({ ...rows(), health: health() }, NOW)
    const firstSources = new Set(fc.features.map((f) => f.properties.sources[0].id))
    for (const id of firstSources) expect(Object.keys(fc.health)).toContain(id)
    expect(new Set(Object.keys(HEALTH_LANES))).toEqual(
      new Set(['ransomlook', 'cisa-kev', 'sec-edgar', 'ca-ag', 'wa-ag', 'or-ag', 'vigil'])
    )
    expect(HEALTH_FEEDS).toEqual([
      'ransomlook',
      'cisa-kev',
      'sec-edgar',
      'state-breach-notices',
      'data-quality',
    ])
  })

  it('adds a caveat to the summary while RansomLook is stalled, and none otherwise', () => {
    const stalled = buildFeed({ ...rows(), health: health() }, NOW)
    expect(summaryTitle(stalled)).toMatch(
      /\. RansomLook has relayed no new claim since 22:15 UTC on 29 Oct 2026, longer than it goes when working, so the claim count may be incomplete$/
    )
    expect(summaryTitle(buildFeed(rows(), NOW))).not.toMatch(/RansomLook/)
    const working = healthRows().map((r) =>
      r.feed_id === 'ransomlook' ? { ...r, stalled: false } : r
    )
    expect(stallCaveat(healthBlock(working))).toBeNull()
  })
})
