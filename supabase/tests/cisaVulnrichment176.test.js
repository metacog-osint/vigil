// @vitest-environment node
/**
 * Migration 176: CISA's SSVC judgments are stored apart from KEV, closed to the public roles
 * until it is decided where they show, written only by service_role, and the job is watched.
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

describe('migration 176', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['176_cisa_vulnrichment.sql'] })
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

  it('gives the public roles nothing and service_role read and write', async () => {
    for (const table of ['cisa_ssvc', 'cisa_vulnrichment_cursor']) {
      for (const role of ['anon', 'authenticated']) {
        for (const p of ['select', 'insert', 'update', 'delete']) {
          expect(await can(role, table, p)).toBe(false)
        }
      }
      for (const p of ['select', 'insert', 'update']) {
        expect(await can('service_role', table, p)).toBe(true)
      }
    }
  })

  it('registers the source as CC0 and watches the job, not critical', async () => {
    const lic = await db.query(
      `select licence, commercial_use from source_licences where source_id = 'cisa-vulnrichment'`
    )
    expect(lic.rows).toEqual([{ licence: 'CC0 1.0 Universal', commercial_use: true }])
    const exp = await db.query(
      `select expected_interval_minutes, critical from feed_expectations where feed_id = 'cisa-vulnrichment'`
    )
    expect(exp.rows).toEqual([{ expected_interval_minutes: 60, critical: false }])
  })

  it('accepts only CISA’s own values and real CVE ids', async () => {
    const insert = (cve, exploitation, automatable = 'yes', impact = 'total') =>
      db.query(
        `insert into public.cisa_ssvc (cve_id, exploitation, automatable, technical_impact, source_commit)
           values ($1, $2, $3, $4, 'abc')`,
        [cve, exploitation, automatable, impact]
      )
    await insert('CVE-2024-3400', 'active')
    await insert('CVE-2021-44228', 'poc', 'no', 'partial')
    await expect(insert('CVE-2024-0001', 'likely')).rejects.toThrow()
    await expect(insert('CVE-2024-0002', 'active', 'maybe')).rejects.toThrow()
    await expect(insert('not-a-cve', 'active')).rejects.toThrow()
    await expect(insert('CVE-2024-3400', 'none')).rejects.toThrow() // one row per CVE
  })

  it('keeps one cursor row', async () => {
    await db.query(
      `insert into public.cisa_vulnrichment_cursor (commit_sha, committed_at) values ('a', now())`
    )
    await expect(
      db.query(
        `insert into public.cisa_vulnrichment_cursor (id, commit_sha, committed_at) values ('main', 'b', now())`
      )
    ).rejects.toThrow()
  })
})
