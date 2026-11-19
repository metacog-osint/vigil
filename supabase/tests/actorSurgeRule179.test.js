// @vitest-environment node
/**
 * Migration 179: VG-IND-1, a group's claims judged against the group's own 8 weeks before
 * (negative binomial, p < 0.01, at least 5 claims on at least 3 days), in new columns on
 * threat_actors. 077's trend_status is left as it was.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table threat_actors (
    id uuid primary key, name text, status text default 'active',
    incidents_7d int, incidents_prev_7d int, incident_velocity numeric,
    trend_status text, last_seen timestamptz
  );
  create table incidents (
    id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text,
    discovered_date date, data_quality text default 'ok'
  );
`

// Evaluated as of 19 Nov 2026: the window is 12-18 Nov, the baseline 17 Sep - 11 Nov.
const DAY = '2026-11-19'
const WINDOW_START = new Date('2026-11-12T00:00:00Z')
const iso = (d) => d.toISOString().slice(0, 10)
const plus = (d, days) => new Date(d.getTime() + days * 86400000)
/** The first day of baseline week k (1 = the week before the window). */
const week = (k) => plus(WINDOW_START, -7 * k)

const ACTORS = {
  steady: '00000000-0000-0000-0000-000000000001',
  dump: '00000000-0000-0000-0000-000000000002',
  bursty: '00000000-0000-0000-0000-000000000003',
  fresh: '00000000-0000-0000-0000-000000000004',
  placeholders: '00000000-0000-0000-0000-000000000005',
  today: '00000000-0000-0000-0000-000000000006',
  small: '00000000-0000-0000-0000-000000000007',
  stale: '00000000-0000-0000-0000-000000000008',
}

describe('migration 179', () => {
  let db
  const claims = async (actor, day, n, quality = 'ok') =>
    db.query(
      `insert into incidents (actor_id, victim_name, discovered_date, data_quality)
       select $1::uuid, 'Victim ' || g, $2::date, $3 from generate_series(1, $4) g`,
      [ACTORS[actor], iso(day), quality, n]
    )
  const row = async (actor) =>
    (
      await db.query(
        `select surge, surge_claims_7d, surge_days_7d, surge_baseline_mean::float8 as mean,
                surge_p, surge_new_group, surge_window_end::text as window_end
           from threat_actors where id = $1`,
        [ACTORS[actor]]
      )
    ).rows[0]

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['179_actor_surge_rule.sql'] })
    for (const [name, id] of Object.entries(ACTORS)) {
      await db.query(`insert into threat_actors (id, name) values ($1, $2)`, [id, name])
    }
    // About 3 a week, then 20 over 4 days.
    for (let k = 1; k <= 8; k++) await claims('steady', week(k), 3)
    for (const d of [0, 1, 3, 5]) await claims('steady', plus(WINDOW_START, d), 5)
    // About 1 a week, then 10 posted at once.
    for (let k = 1; k <= 8; k++) await claims('dump', week(k), 1)
    await claims('dump', plus(WINDOW_START, 5), 10)
    // n0n's 8 weeks before 15 Nov 2026, then its 77 over 3 days: normal for n0n.
    const n0n = [49, 11, 50, 86, 4, 4, 4, 9]
    for (let k = 1; k <= 8; k++) await claims('bursty', week(k), n0n[k - 1])
    for (const [d, n] of [
      [0, 30],
      [2, 27],
      [4, 20],
    ])
      await claims('bursty', plus(WINDOW_START, d), n)
    // Nothing in 8 weeks, then 8 over 3 days.
    for (const d of [1, 2, 4]) await claims('fresh', plus(WINDOW_START, d), d === 1 ? 4 : 2)
    // 4 real claims and 10 placeholders over 3 days.
    for (let k = 1; k <= 8; k++) await claims('placeholders', week(k), 1)
    for (const d of [0, 2, 4]) await claims('placeholders', plus(WINDOW_START, d), d === 0 ? 2 : 1)
    await claims('placeholders', plus(WINDOW_START, 2), 10, 'placeholder')
    // 3 in the window, then 10 today, which is not yet a complete day.
    for (const d of [0, 2, 4]) await claims('today', plus(WINDOW_START, d), 1)
    await claims('today', new Date(`${DAY}T00:00:00Z`), 10)
    // 4 over 4 days with no baseline: under the minimum of 5.
    for (const d of [0, 1, 2, 3]) await claims('small', plus(WINDOW_START, d), 1)
    // Flagged by an earlier run, nothing since.
    await db.query(`update threat_actors set surge = true, surge_claims_7d = 30 where id = $1`, [
      ACTORS.stale,
    ])
    await db.query(`select apply_actor_surges($1::date)`, [DAY])
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  it('computes the upper tail exactly for Poisson and negative binomial counts', async () => {
    const tail = async (k, mu, v) =>
      (await db.query(`select count_upper_tail($1, $2, $3) as p`, [k, mu, v])).rows[0].p
    // Poisson(1): 1 - e^-1 (1 + 1 + 1/2 + 1/6 + 1/24)
    expect(await tail(5, 1, 1)).toBeCloseTo(1 - Math.exp(-1) * (65 / 24), 12)
    // mean 2, variance 6: r = 1, p = 1/3, a geometric count, so P(X >= k) = (2/3)^k
    expect(await tail(5, 2, 6)).toBeCloseTo((2 / 3) ** 5, 12)
    expect(await tail(0, 2, 6)).toBe(1)
  })

  it('flags a group well above its own steady baseline, spread over several days', async () => {
    expect(await row('steady')).toMatchObject({
      surge: true,
      surge_claims_7d: 20,
      surge_days_7d: 4,
      mean: 3,
      surge_new_group: false,
      window_end: '2026-11-18',
    })
    expect((await row('steady')).surge_p).toBeLessThan(0.01)
  })

  it('does not read one batch dump as a surge', async () => {
    expect(await row('dump')).toMatchObject({
      surge: false,
      surge_claims_7d: 10,
      surge_days_7d: 1,
      surge_p: null,
    })
  })

  it("judges a bursty group against its own spread: n0n's 77 is normal for n0n", async () => {
    const r = await row('bursty')
    expect(r).toMatchObject({ surge: false, surge_claims_7d: 77, surge_days_7d: 3, mean: 27.13 })
    expect(r.surge_p).toBeGreaterThan(0.01)
  })

  it('flags a group with no claims in the 8 weeks before, and says it has no baseline', async () => {
    expect(await row('fresh')).toMatchObject({
      surge: true,
      surge_claims_7d: 8,
      surge_days_7d: 3,
      mean: 0,
      surge_new_group: true,
    })
  })

  it('leaves placeholders out of the count', async () => {
    expect(await row('placeholders')).toMatchObject({ surge: false, surge_claims_7d: 4 })
  })

  it('counts only complete days: today is not in the window', async () => {
    expect(await row('today')).toMatchObject({ surge: false, surge_claims_7d: 3 })
  })

  it('needs at least 5 claims', async () => {
    expect(await row('small')).toMatchObject({ surge: false, surge_claims_7d: 4, surge_p: null })
  })

  it('clears an earlier flag when the group has gone quiet', async () => {
    expect(await row('stale')).toMatchObject({ surge: false, surge_claims_7d: 0 })
  })

  it("keeps 077's trend rule and runs the surge rule after it", async () => {
    const { rows } = await db.query(`select apply_actor_trends() as r`)
    expect(rows[0].r).toHaveProperty('actors_updated')
    expect(rows[0].r.surges).toMatchObject({ window_end: expect.any(String) })
    const t = await db.query(`select trend_status from threat_actors where id = $1`, [ACTORS.dump])
    expect(['ESCALATING', 'STABLE', 'DECLINING', 'INACTIVE']).toContain(t.rows[0].trend_status)
  })

  it('lets only service_role run the writers and the helper', async () => {
    const can = async (role, fn) =>
      (await db.query(`select has_function_privilege($1, $2, 'EXECUTE') as ok`, [role, fn])).rows[0]
        .ok
    for (const fn of [
      'public.apply_actor_surges(date)',
      'public.apply_actor_trends()',
      'public.count_upper_tail(integer, double precision, double precision)',
    ]) {
      for (const role of ['anon', 'authenticated']) expect(await can(role, fn)).toBe(false)
      expect(await can('service_role', fn)).toBe(true)
    }
  })
})
