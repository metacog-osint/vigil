// @vitest-environment node
/**
 * Migration 191: the site may read vendors' classified statements and CERT-FR's alerts, but not
 * an unclassified wording, not CERT-FR's raw JSON, not the job's bookkeeping, and nothing is
 * writable by the public roles.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table vendor_exploit_statements (
    id bigint generated always as identity primary key, source_id text, family text,
    document_id text, document_url text, document_date date, cve_id text, statement text,
    kind text, first_seen_at timestamptz default now(), last_seen_at timestamptz default now()
  );
  create table vendor_documents_read (source_id text, document_id text);
  create table certfr_alerts (
    reference text primary key, title text, url text, first_published date, last_revision date,
    closed_at date, cve_ids text[], vendors text[], risks text[], summary text, raw jsonb,
    first_seen_at timestamptz default now(), last_seen_at timestamptz default now()
  );
  alter table vendor_exploit_statements enable row level security;
  alter table certfr_alerts enable row level security;
  revoke all on vendor_exploit_statements, vendor_documents_read, certfr_alerts from anon, authenticated;
`

describe('migration 191', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['191_vendor_sources_public_read.sql'],
    })
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const table = async (role, t, p) =>
    (await db.query(`select has_table_privilege($1, $2, $3) as ok`, [role, `public.${t}`, p]))
      .rows[0].ok
  const column = async (role, c) =>
    (
      await db.query(
        `select has_column_privilege($1, 'public.certfr_alerts', $2, 'select') as ok`,
        [role, c]
      )
    ).rows[0].ok

  it('lets anon and authenticated read the statements, and write nothing', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect(await table(role, 'vendor_exploit_statements', 'select')).toBe(true)
      for (const p of ['insert', 'update', 'delete']) {
        expect(await table(role, 'vendor_exploit_statements', p)).toBe(false)
        expect(await table(role, 'certfr_alerts', p)).toBe(false)
      }
      expect(await table(role, 'vendor_documents_read', 'select')).toBe(false)
    }
  })

  it("opens CERT-FR's columns but not the raw JSON", async () => {
    for (const c of ['reference', 'title', 'url', 'first_published', 'last_revision', 'cve_ids']) {
      expect(await column('anon', c)).toBe(true)
    }
    expect(await column('anon', 'raw')).toBe(false)
  })

  it("keeps CERT-FR's raw JSON from authenticated too", async () => {
    expect(await column('authenticated', 'raw')).toBe(false)
    expect(await column('authenticated', 'title')).toBe(true)
  })

  // ideas#75 D.2: read as the role, so the test fails if the policy is inverted or dropped.
  it('never shows an unclassified wording to anon or authenticated', async () => {
    await db.query(`
      insert into vendor_exploit_statements (source_id, document_id, cve_id, statement, kind)
      values ('mozilla-mfsa', 'mfsa2099-1', 'CVE-2099-0001', 'classified', 'exploited'),
             ('mozilla-mfsa', 'mfsa2099-1', 'CVE-2099-0001', 'nobody has read this', 'unclassified')
    `)
    for (const role of ['anon', 'authenticated']) {
      await db.query(`set role ${role}`)
      try {
        const { rows } = await db.query(
          `select statement, kind from vendor_exploit_statements where cve_id = 'CVE-2099-0001'`
        )
        expect(rows).toEqual([{ statement: 'classified', kind: 'exploited' }])
      } finally {
        await db.query('reset role')
      }
    }
  })
})
