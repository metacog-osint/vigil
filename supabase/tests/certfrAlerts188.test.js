// @vitest-environment node
/**
 * Migration 188: CERT-FR's alerts are stored as CERT-FR's notices, closed to
 * the public roles until Tom decides where they show, written only by
 * service_role, and the job is watched.
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

describe('migration 188', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['188_certfr_alerts.sql'] })
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const can = async (role, privilege) =>
    (
      await db.query(`select has_table_privilege($1, 'public.certfr_alerts', $2) as ok`, [
        role,
        privilege,
      ])
    ).rows[0].ok

  it('gives the public roles nothing and service_role read and write', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const p of ['select', 'insert', 'update', 'delete'])
        expect(await can(role, p)).toBe(false)
    }
    for (const p of ['select', 'insert', 'update']) expect(await can('service_role', p)).toBe(true)
  })

  it('takes an alert with or without CVEs and refuses a reference that is not an alert', async () => {
    await db.query(
      `insert into certfr_alerts (reference, title, url, cve_ids, raw) values
         ('CERTFR-2024-ALE-006', 't', 'u', '{CVE-2024-3400}', '{}'),
         ('CERTFR-2026-ALE-012', 't', 'u', '{}', '{}')`
    )
    const hit = await db.query(
      `select reference from certfr_alerts where cve_ids @> array['CVE-2024-3400']`
    )
    expect(hit.rows).toEqual([{ reference: 'CERTFR-2024-ALE-006' }])
    await expect(
      db.query(
        `insert into certfr_alerts (reference, title, url, raw) values ('CERTFR-2024-AVI-0001', 't', 'u', '{}')`
      )
    ).rejects.toThrow()
  })

  it('registers the licence and watches the job daily, not critical', async () => {
    const lic = await db.query(
      `select licence, attribution_required from source_licences where source_id = 'certfr-alerts'`
    )
    expect(lic.rows).toEqual([
      { licence: 'Licence Ouverte 2.0 (Etalab)', attribution_required: true },
    ])
    const exp = await db.query(
      `select expected_interval_minutes, critical from feed_expectations where feed_id = 'certfr-alerts'`
    )
    expect(exp.rows).toEqual([{ expected_interval_minutes: 1440, critical: false }])
  })
})
