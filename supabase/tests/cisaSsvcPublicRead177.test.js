// @vitest-environment node
/**
 * Migration 177: CISA's SSVC judgments (176) become readable by the public roles, for /api/feed and
 * the vulnerability panel. Read only: writing stays service_role's, and the cursor stays closed.
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

describe('migration 177', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['176_cisa_vulnrichment.sql', '177_cisa_ssvc_public_read.sql'],
    })
  }, 120_000)

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

  it('lets anon and authenticated read cisa_ssvc and nothing more', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect(await can(role, 'cisa_ssvc', 'SELECT')).toBe(true)
      for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await can(role, 'cisa_ssvc', p)).toBe(false)
      }
      expect(await can(role, 'cisa_vulnrichment_cursor', 'SELECT')).toBe(false)
    }
  })

  it('opens every row to the read policy, with row-level security still on', async () => {
    const { rows } = await db.query(
      `select p.policyname, p.roles::text as roles, p.cmd, c.relrowsecurity as rls
         from pg_policies p join pg_class c on c.relname = p.tablename
        where p.tablename = 'cisa_ssvc'`
    )
    expect(rows).toEqual([
      { policyname: 'cisa_ssvc_read', roles: '{anon,authenticated}', cmd: 'SELECT', rls: true },
    ])
  })

  it("indexes the feed's window over active rows", async () => {
    const { rows } = await db.query(
      `select indexdef from pg_indexes where indexname = 'cisa_ssvc_active_assessed_idx'`
    )
    expect(rows[0].indexdef).toMatch(/assessed_at DESC.*WHERE \(exploitation = 'active'::text\)/)
  })
})
