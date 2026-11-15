// @vitest-environment node
/**
 * Migration 167: stall watching for more feeds, reading only counted runs.
 *
 * Before 167 every job but ransomlook and ioc-geo logged records_added 0
 * whatever it brought, and some carry legacy counts from January and May.
 * The danger in extending the check is that history: read as it stands, a
 * newly watched feed is stalled the moment the migration runs. These cases
 * hold that it is not, that a real stall is still found once the count has
 * begun, and that 167 refuses to run before the worker that counts.
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
    ('threatfox', 60, true),
    ('malwarebazaar', 360, false),
    ('state-breach-notices', 1440, false),
    ('cisa-kev', 360, true);

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

// The worker has been deployed: one counted ransomlook run exists.
const DEPLOYED = `
  insert into sync_log (source, completed_at, status, records_added, metadata)
  values ('ransomlook', now() - interval '10 minutes', 'success', 2, '{"new_counted": true}');
`

let db

beforeAll(async () => {
  db = await freshDatabase({
    schema: SCHEMA + DEPLOYED,
    migrations: ['163_feed_health_stall.sql', '167_feed_stall_expand.sql'],
  })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

/** Runs of `source`; counted: true marks them as the new worker writes them. */
async function runs(source, entries) {
  for (const { hoursAgo, added = 0, counted = true, status = 'success' } of entries) {
    await db.query(
      `insert into sync_log (source, completed_at, status, records_added, metadata)
       values ($1, now() - make_interval(mins => $2), $3, $4, $5::jsonb)`,
      [
        source,
        Math.round(hoursAgo * 60),
        status,
        added,
        JSON.stringify(counted ? { new_counted: true } : { result: { updated: 250 } }),
      ]
    )
  }
}

const hourly = (from, to, opts = {}) =>
  Array.from({ length: from - to + 1 }, (_, i) => ({ hoursAgo: from - i, ...opts }))

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
  await db.exec(DEPLOYED)
  await runs('cisa-kev', [{ hoursAgo: 2, counted: false }])
}

describe('migration 167', () => {
  it('refuses to run before the worker that counts', async () => {
    const early = await freshDatabase({ schema: SCHEMA, migrations: ['163_feed_health_stall.sql'] })
    const { migration } = await import('./pg.js')
    await expect(early.exec(migration('167_feed_stall_expand.sql'))).rejects.toThrow(/new_counted/)
    await early.close()
  }, 60_000)

  it('sets the measured thresholds and leaves cisa-kev unwatched', async () => {
    const { rows } = await db.query(
      'select feed_id, stall_after_minutes from feed_expectations order by feed_id'
    )
    expect(rows).toEqual([
      { feed_id: 'cisa-kev', stall_after_minutes: null },
      { feed_id: 'malwarebazaar', stall_after_minutes: 1440 },
      { feed_id: 'ransomlook', stall_after_minutes: 1080 },
      { feed_id: 'state-breach-notices', stall_after_minutes: 8640 },
      { feed_id: 'threatfox', stall_after_minutes: 720 },
    ])
  })

  it('appends new_counted_since and keeps every earlier column in place', async () => {
    const { rows } = await db.query(`
      select column_name from information_schema.columns
       where table_name = 'feed_health' order by ordinal_position`)
    const names = rows.map((r) => r.column_name)
    expect(names.slice(-5)).toEqual([
      'stall_after_minutes',
      'last_new_at',
      'minutes_since_new',
      'stalled',
      'new_counted_since',
    ])
  })
})

describe('history from before the count', () => {
  beforeAll(async () => {
    await reset()
    // Months of uncounted runs logging 0, and a legacy count from January.
    await runs('malwarebazaar', [
      { hoursAgo: 24 * 300, added: 5, counted: false },
      ...hourly(40, 1, { counted: false }),
    ])
    await runs('threatfox', hourly(40, 1, { counted: false }))
  })

  it('does not make a newly watched feed stalled', async () => {
    const r = await row('malwarebazaar')
    expect(r.state).toBe('fresh')
    expect(r.stalled).toBeNull()
    expect(r.new_counted_since).toBeNull()
    expect(r.last_new_at).toBeNull()
  })

  it('leaves ingestion_is_healthy() alone for a critical feed not yet counting', async () => {
    expect((await row('threatfox')).stalled).toBeNull()
    expect(await healthy()).toBe(true)
  })
})

describe('once the count has begun', () => {
  beforeAll(async () => {
    await reset()
    // Counting began 5 h ago and threatfox has added nothing since: under 12 h.
    await runs('threatfox', [...hourly(30, 6, { counted: false }), ...hourly(5, 0)])
  })

  it('is not stalled before a whole threshold has passed', async () => {
    const r = await row('threatfox')
    expect(r.stalled).toBe(false)
    expect(r.last_new_at).toBeNull()
    expect(r.new_counted_since).not.toBeNull()
  })

  it('is stalled when a whole threshold passes with nothing new', async () => {
    await db.exec('truncate sync_log')
    await db.exec(DEPLOYED)
    await runs('cisa-kev', [{ hoursAgo: 2, counted: false }])
    await runs('threatfox', hourly(13, 0))
    const r = await row('threatfox')
    expect(r.stalled).toBe(true)
    expect(await healthy()).toBe(false)
  })

  it('times the stall from the last counted record', async () => {
    await db.exec('truncate sync_log')
    await db.exec(DEPLOYED)
    await runs('cisa-kev', [{ hoursAgo: 2, counted: false }])
    await runs('threatfox', [{ hoursAgo: 20, added: 40 }, ...hourly(19, 0)])
    const r = await row('threatfox')
    expect(r.stalled).toBe(true)
    expect(r.minutes_since_new).toBe(1200)

    await runs('threatfox', [{ hoursAgo: 0.2, added: 12 }])
    expect((await row('threatfox')).stalled).toBe(false)
  })

  it('ignores an uncounted row that says it added records', async () => {
    await db.exec('truncate sync_log')
    await db.exec(DEPLOYED)
    await runs('malwarebazaar', [...hourly(30, 0), { hoursAgo: 0.5, added: 9, counted: false }])
    const r = await row('malwarebazaar')
    expect(r.last_new_at).toBeNull()
    expect(r.stalled).toBe(true)
  })
})

describe('ransomlook across the deploy', () => {
  beforeAll(async () => {
    await reset()
    // Real but unmarked counts before the deploy; one counted run since.
  })

  it('stays watched, timed from the deploy until its next claim', async () => {
    await runs('ransomlook', [{ hoursAgo: 3, added: 4, counted: false }])
    const r = await row('ransomlook')
    expect(r.stalled).toBe(false)
    expect(r.new_counted_since).not.toBeNull()
  })
})
