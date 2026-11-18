// @vitest-environment node
/**
 * Migration 175: the hub's daily line is stored in one row, readable by the public roles and
 * writable only by service_role, and the worker job that writes it is watched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
`

describe('migration 175', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['175_public_summary.sql'] })
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const can = async (role, privilege) =>
    (
      await db.query(`select has_table_privilege($1, 'public.public_summary', $2) as ok`, [
        role,
        privilege,
      ])
    ).rows[0].ok

  it('lets the public roles read it and only service_role write it', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect(await can(role, 'select')).toBe(true)
      for (const p of ['insert', 'update', 'delete']) expect(await can(role, p)).toBe(false)
    }
    for (const p of ['select', 'insert', 'update']) expect(await can('service_role', p)).toBe(true)
  })

  it('holds one row, which an upsert replaces', async () => {
    const upsert = (builtAt, day) =>
      db.query(
        `insert into public.public_summary (id, built_at, day, summary) values ('latest', $1, $2, $3)
           on conflict (id) do update set built_at = excluded.built_at, day = excluded.day, summary = excluded.summary`,
        [builtAt, day, JSON.stringify({ day, brief: 'b' })]
      )
    await upsert('2026-10-31T20:16:00Z', '2026-10-30')
    await upsert('2026-10-31T21:16:00Z', '2026-10-30')
    const { rows } = await db.query(`select id, built_at, summary from public.public_summary`)
    expect(rows).toHaveLength(1)
    expect(new Date(rows[0].built_at).toISOString()).toBe('2026-10-31T21:16:00.000Z')
    await expect(
      db.query(
        `insert into public.public_summary (id, built_at, day, summary) values ('other', now(), current_date, '{}')`
      )
    ).rejects.toThrow()
  })

  it('has row-level security on, with a read policy for the public roles', async () => {
    const { rows } = await db.query(
      `select c.relrowsecurity as rls, (select count(*) from pg_policies p
         where p.tablename = 'public_summary' and p.cmd = 'SELECT') as policies
         from pg_class c where c.oid = 'public.public_summary'::regclass`
    )
    expect(rows[0].rls).toBe(true)
    expect(Number(rows[0].policies)).toBe(1)
  })

  it('watches the job, not critical until it has run', async () => {
    const { rows } = await db.query(
      `select expected_interval_minutes, critical from feed_expectations where feed_id = 'public-summary'`
    )
    expect(rows).toEqual([{ expected_interval_minutes: 60, critical: false }])
  })
})
