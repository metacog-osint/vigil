// @vitest-environment node
/**
 * Migration 194: CIRCL sightings are readable but not writable by the public roles, only the
 * service role can run the writer, a re-read changes nothing, and the feed is watched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text
  );
`

const row = (sighted_at) => ({
  cve_id: 'CVE-2026-12345',
  source_class: 'honeypot',
  source_name: 'Shadowserver honeypots',
  source_link: '',
  sighted_at,
})

describe('migration 194', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['194_circl_sightings.sql'] })
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const can = async (role, table, privilege) =>
    (
      await db.query(`select has_table_privilege($1, $2, $3) as ok`, [
        role,
        `public.${table}`,
        privilege,
      ])
    ).rows[0].ok

  const apply = async (rows) =>
    (await db.query(`select public.apply_circl_sightings($1::jsonb) as r`, [JSON.stringify(rows)]))
      .rows[0].r

  it('lets the public roles read sightings and nothing else', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect(await can(role, 'circl_sightings', 'select')).toBe(true)
      for (const p of ['insert', 'update', 'delete']) {
        expect(await can(role, 'circl_sightings', p)).toBe(false)
      }
      expect(await can(role, 'circl_sightings_cursor', 'select')).toBe(false)
    }
  })

  it('opens the writer to service_role only', async () => {
    const fn = 'public.apply_circl_sightings(jsonb)'
    for (const [role, expected] of [
      ['anon', false],
      ['authenticated', false],
      ['service_role', true],
    ]) {
      const { rows } = await db.query(`select has_function_privilege($1, $2, 'execute') as ok`, [
        role,
        fn,
      ])
      expect(rows[0].ok).toBe(expected)
    }
  })

  it('keeps one row per source, widens dates, and is unchanged by a re-read', async () => {
    expect(await apply([row('2026-11-20T00:00:00Z')])).toEqual({ added: 1, updated: 0 })
    expect(await apply([row('2026-11-18T00:00:00Z'), row('2026-11-21T00:00:00Z')])).toEqual({
      added: 0,
      updated: 1,
    })
    await apply([row('2026-11-20T00:00:00Z')])
    const { rows } = await db.query(
      `select first_sighted_at::date::text as f, last_sighted_at::date::text as l from circl_sightings`
    )
    expect(rows).toEqual([{ f: '2026-11-18', l: '2026-11-21' }])
  })

  it('registers the licence as not commercial and watches the feed, not critical', async () => {
    const licence = await db.query(
      `select commercial_use from source_licences where source_id = 'circl-sightings'`
    )
    expect(licence.rows[0].commercial_use).toBe(false)
    const feed = await db.query(
      `select critical from feed_expectations where feed_id = 'circl-sightings'`
    )
    expect(feed.rows[0].critical).toBe(false)
  })
})
