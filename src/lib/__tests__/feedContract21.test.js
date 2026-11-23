// Feed contract revision 2.1 on Vigil's feed: stable subjects, event times, last_change, signal, header, health.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildFeed,
  contractHealth,
  CONTRACT_REV,
  KIT_VERSION,
} from '../../../api/_lib/doctrineFeed.js'

const NOW = new Date('2026-11-23T12:00:00Z')
const actor = {
  id: 'a1',
  name: 'Group',
  surge_claims_7d: 7,
  surge_days_7d: 3,
  surge_baseline_mean: 1.5,
  surge_p: 0.001,
  surge_new_group: false,
  surge_window_end: '2026-11-22',
}
const rows = () => ({
  actors: [actor],
  claims: [
    { incident_id: 'c1', actor_id: 'a1', victim_name: 'Victim', discovered_date: '2026-11-22' },
  ],
  actorNames: { a1: 'Group' },
  kev: [
    {
      cve_id: 'CVE-2026-1',
      kev_date: '2026-11-20',
      ransomware_use: true,
      epss_score: 0.9,
      epss_date: '2026-11-23',
    },
  ],
  adp: [{ cve_id: 'CVE-2026-2', assessed_at: '2026-11-21T08:30:00Z', in_kev: false }],
  disclosures: [
    { id: 'd1', source: 'sec-edgar', company_name: 'Co', filed_date: '2026-11-19' },
    { id: 'd2', source: 'ca-ag', company_name: 'Co2', first_seen: '2026-11-21T04:00:00Z' },
  ],
})
const byId = (fc, part) => fc.features.find((f) => f.properties.id.includes(part)).properties

describe('feed contract 2.1', () => {
  it('states a dateless subject on every item, the same on the next day', () => {
    const a = buildFeed(rows(), NOW)
    const b = buildFeed(rows(), new Date('2026-11-24T12:00:00Z'))
    const subjects = (fc) => fc.features.map((f) => f.properties.subject_id)
    expect(subjects(a).every(Boolean)).toBe(true)
    expect(subjects(a)).toEqual(subjects(b))
    expect(subjects(a).some((s) => /\d{4}-\d{2}-\d{2}/.test(s))).toBe(false)
    expect(byId(a, ':actor:').subject_id).toBe('vigil:actor:a1')
    expect(byId(a, ':summary').subject_id).toBe('vigil:feed:summary')
  })

  it('states the revision and the vendored kit', () => {
    const fc = buildFeed(rows(), NOW)
    const kit = JSON.parse(readFileSync(join(process.cwd(), 'doctrine/kit/KIT.json'), 'utf8'))
    expect(fc.contract_rev).toBe(CONTRACT_REV)
    expect(fc.kit).toBe(KIT_VERSION)
    expect(KIT_VERSION).toBe(kit.version)
  })

  it('dates a surge by its seven complete days and its signal', () => {
    const p = byId(buildFeed(rows(), NOW), ':actor:')
    expect(p.event_start).toBe('2026-11-16T00:00:00Z')
    expect(p.event_end).toBe('2026-11-22T00:00:00Z')
    expect(p.event_time_precision).toBe('day')
    expect(p.signal).toEqual({
      name: 'victims_claimed_7d',
      value: 7,
      unit: 'victims',
      expected: 1.5,
      tail: 'high',
      baseline_n: 8,
    })
  })

  it('does not invent when a surge began', () => {
    const p = byId(buildFeed(rows(), NOW), ':actor:')
    expect('last_change' in p).toBe(false)
    expect('last_change_at' in p).toBe(false)
  })

  it('dates each one-time item by its source', () => {
    const fc = buildFeed(rows(), NOW)
    expect(byId(fc, 'claim:c1')).toMatchObject({
      last_change: 'new',
      last_change_at: '2026-11-22T00:00:00Z',
      event_start: '2026-11-22T00:00:00Z',
      event_time_precision: 'day',
    })
    expect(byId(fc, 'adp:')).toMatchObject({ event_start: '2026-11-21T08:30:00Z' })
    expect('event_time_precision' in byId(fc, 'adp:')).toBe(false)
    expect(byId(fc, 'disclosure:d1').event_time_precision).toBe('day')
    expect('event_time_precision' in byId(fc, 'disclosure:d2')).toBe(false)
  })

  it('gives a KEV alert the EPSS signal', () => {
    const p = byId(buildFeed(rows(), NOW), 'kev:')
    expect(p.tier).toBe('anomaly')
    expect(p.signal).toEqual({ name: 'epss', value: 0.9, unit: 'probability', tail: 'high' })
  })

  it('publishes a stalled lane as stale and not read, and fills a missing check time', () => {
    const out = contractHealth(
      {
        ransomlook: { state: 'stalled', last_ok: 'x', checked_at: 'x', detail: 'why' },
        'cisa-kev': { state: 'never', last_ok: null, checked_at: null },
      },
      '2026-11-23T12:00:00Z'
    )
    expect(out.ransomlook).toMatchObject({ state: 'stale', stalled: true, detail: 'why' })
    expect(out['cisa-kev'].checked_at).toBe('2026-11-23T12:00:00Z')
    expect(out['cisa-kev'].last_ok).toBeNull()
  })
})
