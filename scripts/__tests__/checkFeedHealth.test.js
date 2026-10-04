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
import { classify, hoursSince } from '../check-feed-health.mjs'

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
