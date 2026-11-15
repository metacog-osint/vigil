// @vitest-environment node
/**
 * feed_health.stalled (migration 163): a feed that runs and brings nothing new.
 *
 * The first case is the real one. From 22:15 UTC on 11 November 2026 RansomLook
 * returned the same 100 posts on every hourly run for 32.5 hours. Every run
 * succeeded, so feed_health said fresh and ingestion_is_healthy() said true,
 * and nothing told anyone. If that case ever reads not stalled, the check is
 * decorative again.
 *
 * The others guard the other direction: a feed that is meant to be quiet must
 * not be called stalled, and `state` must still describe the check alone.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The columns 163 reads, as production has them before it runs.
const SCHEMA = `
  create table feed_expectations (
    feed_id text primary key,
    expected_interval_minutes integer not null check (expected_interval_minutes > 0),
    critical boolean not null default false,
    note text,
    created_at timestamptz not null default now()
  );
  insert into feed_expectations (feed_id, expected_interval_minutes, critical) values
    ('ransomlook', 60, true),
    ('cisa-kev', 360, true),
    ('ioc-geo', 60, false);

  create table sync_log (
    id bigserial primary key,
    source text,
    started_at timestamptz,
    completed_at timestamptz,
    status text,
    records_processed integer,
    records_added integer,
    records_updated integer,
    error_message text,
    metadata jsonb,
    records_failed integer
  );

  create table feed_cursors (feed_id text primary key, cursor jsonb);
`

let db

beforeAll(async () => {
  db = await freshDatabase({ schema: SCHEMA, migrations: ['163_feed_health_stall.sql'] })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

/** Hourly runs of `source`, `hoursAgo` hours before now, each adding `added`. */
async function runs(source, entries) {
  for (const { hoursAgo, added = 0, status = 'success' } of entries) {
    await db.query(
      `insert into sync_log (source, completed_at, status, records_added)
       values ($1, now() - make_interval(mins => $2), $3, $4)`,
      [source, Math.round(hoursAgo * 60), status, added]
    )
  }
}

const hourly = (fromHoursAgo, toHoursAgo, added = 0) =>
  Array.from({ length: fromHoursAgo - toHoursAgo + 1 }, (_, i) => ({
    hoursAgo: fromHoursAgo - i,
    added,
  }))

async function row(feedId) {
  const { rows } = await db.query('select * from feed_health where feed_id = $1', [feedId])
  return rows[0]
}

async function healthy() {
  const { rows } = await db.query('select ingestion_is_healthy() as ok')
  return rows[0].ok
}

async function reset() {
  await db.exec('truncate sync_log')
  await db.exec(
    "update feed_expectations set stall_after_minutes = null where feed_id <> 'ransomlook'"
  )
  // The other critical feed ran recently, so only ransomlook can move ingestion_is_healthy().
  await runs('cisa-kev', [{ hoursAgo: 2 }])
}

describe('migration 163', () => {
  it('watches ransomlook at 18 hours and leaves every other feed unwatched', async () => {
    const { rows } = await db.query(
      'select feed_id, stall_after_minutes from feed_expectations order by feed_id'
    )
    expect(rows).toEqual([
      { feed_id: 'cisa-kev', stall_after_minutes: null },
      { feed_id: 'ioc-geo', stall_after_minutes: null },
      { feed_id: 'ransomlook', stall_after_minutes: 1080 },
    ])
  })

  it('appends its columns after the existing ones, which CREATE OR REPLACE requires', async () => {
    const { rows } = await db.query(`
      select column_name from information_schema.columns
       where table_name = 'feed_health' order by ordinal_position`)
    expect(rows.map((r) => r.column_name)).toEqual([
      'feed_id',
      'expected_interval_minutes',
      'critical',
      'note',
      'last_success_at',
      'last_attempt_at',
      'last_status',
      'last_error',
      'minutes_since_success',
      'state',
      'snapshot_version',
      'snapshot_published',
      'stall_after_minutes',
      'last_new_at',
      'minutes_since_new',
      'stalled',
    ])
  })
})

describe('the 11-13 November case', () => {
  beforeAll(async () => {
    await reset()
    // A claim, then twenty hours of successful runs that add nothing.
    await runs('ransomlook', [{ hoursAgo: 20, added: 3 }, ...hourly(19, 0)])
  })

  it('is stalled, though every run succeeded', async () => {
    const r = await row('ransomlook')
    expect(r.state).toBe('fresh')
    expect(r.last_status).toBe('success')
    expect(r.stalled).toBe(true)
    expect(r.minutes_since_new).toBe(1200)
  })

  it('makes ingestion_is_healthy() false, because ransomlook is critical', async () => {
    expect(await healthy()).toBe(false)
  })
})

describe('a feed that is working', () => {
  beforeAll(async () => {
    await reset()
    // 17 hours without a claim: the longest ordinary lull before 11 Nov was 17.0 h.
    await runs('ransomlook', [{ hoursAgo: 17, added: 5 }, ...hourly(16, 0)])
  })

  it('is not stalled inside its threshold', async () => {
    const r = await row('ransomlook')
    expect(r.stalled).toBe(false)
    expect(r.minutes_since_new).toBe(1020)
  })

  it('leaves ingestion_is_healthy() true', async () => {
    expect(await healthy()).toBe(true)
  })
})

describe('what counts as new', () => {
  beforeAll(async () => {
    await reset()
    await runs('ransomlook', [
      { hoursAgo: 30, added: 4 },
      ...hourly(29, 3),
      // A partial run that still inserted claims brought new data.
      { hoursAgo: 2, added: 2, status: 'partial' },
      { hoursAgo: 1 },
    ])
  })

  it('counts a partial run that added records', async () => {
    const r = await row('ransomlook')
    expect(r.stalled).toBe(false)
    expect(r.minutes_since_new).toBe(120)
  })
})

describe('feeds that are not watched', () => {
  beforeAll(async () => {
    await reset()
    // cisa-kev adds to its catalogue a few times a week: days without an addition are normal.
    await runs('cisa-kev', [{ hoursAgo: 96, added: 1 }, { hoursAgo: 4 }])
    await runs('ransomlook', [{ hoursAgo: 1, added: 1 }])
  })

  it('reads null, not false: not watched is a different answer from fine', async () => {
    const r = await row('cisa-kev')
    expect(r.state).toBe('fresh')
    expect(r.stall_after_minutes).toBeNull()
    expect(r.stalled).toBeNull()
  })

  it('does not count against ingestion_is_healthy()', async () => {
    expect(await healthy()).toBe(true)
  })
})

describe('a watched feed that has never added anything', () => {
  beforeAll(async () => {
    await reset()
    await db.exec("update feed_expectations set stall_after_minutes = 60 where feed_id = 'ioc-geo'")
  })

  it('reads null before it has ever succeeded: state never already says so', async () => {
    const r = await row('ioc-geo')
    expect(r.state).toBe('never')
    expect(r.stalled).toBeNull()
  })

  it('reads stalled once it runs and still adds nothing', async () => {
    await runs('ioc-geo', [{ hoursAgo: 0.5 }])
    const r = await row('ioc-geo')
    expect(r.state).toBe('fresh')
    expect(r.last_new_at).toBeNull()
    expect(r.stalled).toBe(true)
  })

  it('is not critical, so ingestion_is_healthy() does not change', async () => {
    await runs('ransomlook', [{ hoursAgo: 1, added: 1 }])
    expect(await healthy()).toBe(true)
  })
})
