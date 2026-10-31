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
  SECTOR_MAP,
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
    const file = join(mkdtempSync(join(tmpdir(), 'vigil-feed-')), 'feed.geojson')
    writeFileSync(file, JSON.stringify(buildFeed(rows(), NOW)))
    const run = spawnSync(
      py,
      [join(ROOT, 'doctrine/kit/tic.py'), 'lint', file, '--doctrine', join(ROOT, 'doctrine')],
      {
        encoding: 'utf8',
      }
    )
    expect(run.stdout).toContain('Result: PASS')
    expect(run.status).toBe(0)
  })
})
