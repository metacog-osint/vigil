// @vitest-environment node
/**
 * feed_health.below_floor (migration 197): a run that succeeds on far too few rows.
 *
 * The first case is the real one. On 23 November 2026 ThreatCluster's run parsed
 * 16 rows against 2,952 the day before, and logged success.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

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
    ('threatcluster', 1440, false),
    ('threatfox', 60, true),
    ('pulsedive', 360, false),
    ('data-quality', 60, true);

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
  -- 167 refuses to run before the worker that writes new_counted.
  insert into sync_log (source, completed_at, status, metadata)
  values ('ransomlook', now(), 'success', '{"new_counted": true}');

  create table feed_cursors (feed_id text primary key, cursor jsonb);
`

let db

beforeAll(async () => {
  db = await freshDatabase({
    schema: SCHEMA,
    migrations: [
      '163_feed_health_stall.sql',
      '167_feed_stall_expand.sql',
      '197_feed_row_floor.sql',
    ],
  })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

async function run(source, hoursAgo, { processed = 0, parsed, status = 'success' } = {}) {
  const metadata = parsed === undefined ? {} : { result: { parsed } }
  await db.query(
    `insert into sync_log (source, completed_at, status, records_processed, metadata)
     values ($1, now() - make_interval(hours => $2), $3, $4, $5)`,
    [source, hoursAgo, status, processed, JSON.stringify(metadata)]
  )
}

async function row(feedId) {
  const { rows } = await db.query('select * from feed_health where feed_id = $1', [feedId])
  return rows[0]
}

describe('feed_health.below_floor', () => {
  it('flags the 23 Nov ThreatCluster run, read from parsed, while status stays success', async () => {
    await run('threatcluster', 24, { processed: 18, parsed: 2952 })
    expect((await row('threatcluster')).below_floor).toBe(false)

    await run('threatcluster', 1, { processed: 0, parsed: 16 })
    const r = await row('threatcluster')
    expect(r.last_status).toBe('success')
    expect(r.last_rows).toBe(16)
    expect(r.min_rows_per_run).toBe(500)
    expect(r.below_floor).toBe(true)
  })

  it('falls back to records_processed when a feed reports no parsed count', async () => {
    await run('threatfox', 2, { processed: 1512 })
    expect((await row('threatfox')).below_floor).toBe(false)
    await run('threatfox', 1, { processed: 12 })
    expect((await row('threatfox')).below_floor).toBe(true)
  })

  it('judges the last successful run, not a later failure', async () => {
    await run('threatfox', 0, { processed: 0, status: 'error' })
    const r = await row('threatfox')
    expect(r.last_status).toBe('error')
    expect(r.last_rows).toBe(12)
  })

  it('reads null for a feed with no floor, and every such feed says why', async () => {
    await run('pulsedive', 1, { processed: 0 })
    expect((await row('pulsedive')).below_floor).toBeNull()
    const { rows } = await db.query(
      `select feed_id from feed_expectations where row_floor_note is null`
    )
    expect(rows).toEqual([])
  })
})
