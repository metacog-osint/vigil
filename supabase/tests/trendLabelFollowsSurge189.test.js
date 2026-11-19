// @vitest-environment node
/**
 * Migration 189: trend_status ESCALATING means 179's surge, so the site's label
 * and /api/feed's anomaly agree. A week-on-week rise that is normal for the
 * group is STABLE; DECLINING, INACTIVE and null are 077's, unchanged.
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

const ACTORS = {
  surging: '00000000-0000-0000-0000-000000000001',
  usualRise: '00000000-0000-0000-0000-000000000002',
  falling: '00000000-0000-0000-0000-000000000003',
  stale: '00000000-0000-0000-0000-000000000004',
  silent: '00000000-0000-0000-0000-000000000005',
}

describe('migration 189', () => {
  let db
  // n claims `ago` days before today (the database's current_date).
  const claims = (actor, ago, n) =>
    db.query(
      `insert into incidents (actor_id, victim_name, discovered_date)
       select $1::uuid, 'Victim ' || g, current_date - $2::int from generate_series(1, $3) g`,
      [ACTORS[actor], ago, n]
    )
  const label = async (actor) =>
    (await db.query(`select trend_status, surge from threat_actors where id = $1`, [ACTORS[actor]]))
      .rows[0]

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['179_actor_surge_rule.sql', '189_trend_label_follows_surge.sql'],
    })
    for (const [name, id] of Object.entries(ACTORS)) {
      await db.query(`insert into threat_actors (id, name) values ($1, $2)`, [id, name])
    }
    // About 3 a week for 8 weeks, then 20 over 4 days: unusual for this group.
    for (let k = 1; k <= 8; k++) await claims('surging', 7 * k + 1, 3)
    for (const ago of [1, 2, 4, 6]) await claims('surging', ago, 5)
    // 20 a week for 8 weeks, then 28: 40% up on the week before (077 said
    // ESCALATING), but not unusual for a group this busy.
    for (let k = 1; k <= 8; k++) await claims('usualRise', 7 * k + 1, 20)
    for (const ago of [1, 2, 3, 4, 5, 6, 6]) await claims('usualRise', ago, 4)
    // 10 the week before, 2 this week.
    await claims('falling', 10, 10)
    await claims('falling', 2, 2)
    // Nothing for 60 days.
    await claims('stale', 60, 5)
    await db.query(`select apply_actor_trends()`)
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  it('labels a surge ESCALATING', async () => {
    expect(await label('surging')).toEqual({ trend_status: 'ESCALATING', surge: true })
  })

  it('labels a rise that is normal for the group STABLE, not ESCALATING', async () => {
    expect(await label('usualRise')).toEqual({ trend_status: 'STABLE', surge: false })
    const counts = await db.query(
      `select incidents_7d, incidents_prev_7d from threat_actors where id = $1`,
      [ACTORS.usualRise]
    )
    expect(counts.rows[0]).toEqual({ incidents_7d: 28, incidents_prev_7d: 20 })
  })

  it("keeps 077's DECLINING, INACTIVE and null", async () => {
    expect((await label('falling')).trend_status).toBe('DECLINING')
    expect((await label('stale')).trend_status).toBe('INACTIVE')
    expect((await label('silent')).trend_status).toBeNull()
  })

  it('lets only service_role run it', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const ok = await db.query(
        `select has_function_privilege($1, 'public.apply_actor_trends()', 'execute') as ok`,
        [role]
      )
      expect(ok.rows[0].ok).toBe(role === 'service_role')
    }
  })
})
