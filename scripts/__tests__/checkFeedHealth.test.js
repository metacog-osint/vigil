/**
 * The case that matters is the first one. ofac-sdn errored on every attempt for
 * thirteen days while sitting at `late`, and ingestion_is_healthy() reported
 * true for eleven of them because it only looks at `state`. If this test ever
 * goes green on a feed that is erroring, the check is back to being decorative.
 *
 * The `late` cases matter nearly as much in the other direction: the hourly
 * feeds are routinely `late`, and ten retired workflows were disabled on
 * 3 October for generating failures nobody could act on.
 */
import { describe, it, expect } from 'vitest'
import {
  classify,
  hoursSince,
  dataAge,
  table,
  errorsInARow,
  allowsOneError,
} from '../check-feed-health.mjs'

const feed = (overrides) => ({
  feed_id: 'a-feed',
  critical: true,
  state: 'fresh',
  last_status: 'success',
  last_error: null,
  minutes_since_success: 30,
  ...overrides,
})

describe('classify', () => {
  it('catches a feed erroring while still only late — the ofac-sdn case', () => {
    const f = feed({ feed_id: 'ofac-sdn', state: 'late', last_status: 'error' })
    expect(classify([f]).broken).toEqual([f])
  })

  it('catches stale and never, which is all ingestion_is_healthy() covers', () => {
    const stale = feed({ state: 'stale' })
    const never = feed({ state: 'never', last_status: null, minutes_since_success: null })
    expect(classify([stale, never]).broken).toHaveLength(2)
  })

  it('does not fail on a feed that is late but succeeding', () => {
    // The hourly feeds sit here between runs. Failing on this is how a check
    // gets muted, and a muted check is worse than none.
    const f = feed({ state: 'late', minutes_since_success: 100 })
    expect(classify([f]).broken).toEqual([])
  })

  it('does not fail on a fresh feed', () => {
    expect(classify([feed()]).broken).toEqual([])
  })

  it('separates the broken from the rest rather than dropping them', () => {
    const bad = feed({ feed_id: 'bad', last_status: 'error' })
    const good = feed({ feed_id: 'good' })
    const { broken, ok } = classify([bad, good])
    expect(broken.map((f) => f.feed_id)).toEqual(['bad'])
    expect(ok.map((f) => f.feed_id)).toEqual(['good'])
  })
})

describe('one error from an hourly feed', () => {
  // ransomlook, 26 October: HTTP 524 at 21:16, a success at 22:15.
  const hourly = (overrides) =>
    feed({
      feed_id: 'ransomlook',
      expected_interval_minutes: 60,
      last_status: 'error',
      ...overrides,
    })

  it('is listed, not failed, when the run before it succeeded', () => {
    const f = hourly()
    const { broken, blips } = classify([f], { ransomlook: ['error', 'success'] })
    expect(broken).toEqual([])
    expect(blips).toEqual([f])
  })

  it('fails on the second error in a row', () => {
    const f = hourly()
    expect(classify([f], { ransomlook: ['error', 'error'] }).broken).toEqual([f])
  })

  it('fails when its recent runs could not be read, rather than excusing it', () => {
    const f = hourly()
    expect(classify([f], {}).broken).toEqual([f])
    expect(classify([f], { ransomlook: ['error'] }).broken).toEqual([f])
  })

  it('is neither failed nor listed when a success landed between the two reads', () => {
    const f = hourly()
    const { broken, blips, ok } = classify([f], { ransomlook: ['success', 'error'] })
    expect(broken).toEqual([])
    expect(blips).toEqual([])
    expect(ok).toEqual([f])
  })

  it('still fails if the feed has gone stale, whatever its last runs say', () => {
    const f = hourly({ state: 'stale' })
    expect(classify([f], { ransomlook: ['error', 'success'] }).broken).toEqual([f])
  })
})

describe('slower feeds still fail on the first error', () => {
  it('fails a daily feed on one error - a day without the sanctions list is too long', () => {
    const f = feed({ feed_id: 'ofac-sdn', expected_interval_minutes: 1440, last_status: 'error' })
    expect(classify([f], { 'ofac-sdn': ['error', 'success'] }).broken).toEqual([f])
  })

  it('fails a six-hourly feed on one error', () => {
    const f = feed({ feed_id: 'cisa-kev', expected_interval_minutes: 360, last_status: 'error' })
    expect(classify([f], { 'cisa-kev': ['error', 'success'] }).broken).toEqual([f])
  })

  it('treats an unknown interval as slow', () => {
    expect(allowsOneError(feed({}))).toBe(false)
    expect(allowsOneError(feed({ expected_interval_minutes: 60 }))).toBe(true)
    expect(allowsOneError(feed({ expected_interval_minutes: 61 }))).toBe(false)
  })
})

describe('errorsInARow', () => {
  it('counts only the leading errors', () => {
    expect(errorsInARow(['error', 'error', 'success', 'error'])).toBe(2)
    expect(errorsInARow(['success', 'error'])).toBe(0)
    expect(errorsInARow([])).toBe(0)
    expect(errorsInARow(undefined)).toBe(0)
  })
})

describe('hoursSince', () => {
  it('floors minutes to whole hours', () => {
    expect(hoursSince(119)).toBe(1)
    expect(hoursSince(120)).toBe(2)
  })

  it('reports a feed that never succeeded as null rather than zero', () => {
    // 0 would render as "last success 0h ago", which is the opposite of true.
    expect(hoursSince(null)).toBeNull()
    expect(hoursSince(undefined)).toBeNull()
  })
})

describe('dataAge', () => {
  // ransomwhere checks a 2024 Zenodo deposit every week. Once a confirmed check
  // counts as success it reads `fresh`, which is true of the check and false of
  // the data. These keep the second fact on the same line as the first.
  const ransomwhere = feed({
    feed_id: 'ransomwhere',
    snapshot_version: '1.1.0',
    snapshot_published: '2024-10-27',
  })

  it('states the version and publication date of a snapshot', () => {
    expect(dataAge(ransomwhere)).toBe('snapshot 1.1.0, published 2024-10-27')
  })

  it('says nothing about a live feed rather than calling it live', () => {
    expect(dataAge(feed({ snapshot_version: null, snapshot_published: null }))).toBeNull()
    expect(dataAge(feed())).toBeNull()
  })

  it('puts the snapshot date beside the fresh state in the summary table', () => {
    const row = table([ransomwhere])
      .split('\n')
      .find((line) => line.startsWith('| ransomwhere'))
    expect(row).toContain('| fresh |')
    expect(row).toContain('snapshot 1.1.0, published 2024-10-27')
  })

  it('does not count a fresh snapshot feed as broken', () => {
    expect(classify([ransomwhere]).broken).toEqual([])
  })
})
