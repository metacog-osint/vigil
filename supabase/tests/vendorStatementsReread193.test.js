// @vitest-environment node
/**
 * Migration 193: on re-read a held statement's kind follows the wordings
 * (logged), a statement the document no longer carries is retired and kept, Google's note-only
 * CVEs are flagged with a finding, and the public read is a column list.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, migration } from './pg.js'

const SCHEMA = `
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text
  );
  create table data_quality_findings (
    check_name text, subject text, severity text, status text, details jsonb,
    unique (check_name, subject)
  );
  create function public.record_finding(
    p_check text, p_subject text, p_severity text, p_status text, p_details jsonb
  ) returns void language sql security definer set search_path = public as $$
    insert into data_quality_findings (check_name, subject, severity, status, details)
    values (p_check, p_subject, p_severity, p_status, p_details)
    on conflict (check_name, subject) do update set details = excluded.details;
  $$;
  create table certfr_alerts (
    reference text primary key, title text, url text, first_published date, last_revision date,
    closed_at date, cve_ids text[], vendors text[], risks text[], summary text, raw jsonb,
    first_seen_at timestamptz default now(), last_seen_at timestamptz default now()
  );
`

const NOTE = 'There are indications that the following may be under limited, targeted exploitation.'
const ANDROID = {
  family: 'asb',
  document_id: '2022-09-01',
  document_url: 'https://source.android.com/docs/security/bulletin/2022-09-01',
  document_date: '2022-09-01',
  cve_id: 'CVE-2020-0500',
  statement: NOTE,
  kind: 'exploited',
}
const doc = (s) => ({
  document_id: s.document_id,
  document_url: s.document_url,
  document_date: s.document_date,
  statements: 1,
})
const MOZ = {
  family: 'mfsa',
  document_id: 'mfsa2099-01',
  document_url: 'https://www.mozilla.org/security/advisories/mfsa2099-01/',
  document_date: '2099-01-01',
  cve_id: 'CVE-2099-0001',
  statement: 'A new wording about the wild.',
  kind: 'unclassified',
}

describe('migration 193', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['187_vendor_exploitation_statements.sql', '191_vendor_sources_public_read.sql'],
    })
    // The rows as 187 stored them, then 193, whose backfill flags the first.
    await db.query(
      `insert into vendor_exploit_statements
         (source_id, family, document_id, document_url, document_date, cve_id, statement, kind)
       values ('android-bulletins', 'asb', '2022-09-01', $2, '2022-09-01', 'CVE-2020-0500', $1, 'exploited'),
              ('android-bulletins', 'asb', '2025-09-01', $3, '2025-09-01', 'CVE-2025-38352', $1, 'exploited')`,
      [
        NOTE,
        'https://source.android.com/docs/security/bulletin/2022-09-01',
        'https://source.android.com/docs/security/bulletin/2025-09-01',
      ]
    )
    await db.exec(migration('193_vendor_statements_reread.sql'))
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const record = async (source, statements, documents) =>
    (
      await db.query(`select record_vendor_statements($1, $2::jsonb, $3::jsonb) as r`, [
        source,
        JSON.stringify(statements),
        JSON.stringify(documents),
      ])
    ).rows[0].r
  const row = async (cve) =>
    (
      await db.query(
        `select kind, note_flags, retired_at is not null as retired
           from vendor_exploit_statements where cve_id = $1`,
        [cve]
      )
    ).rows[0]
  const findings = async (check) =>
    (
      await db.query(
        `select subject, severity from data_quality_findings where check_name = $1 order by subject`,
        [check]
      )
    ).rows

  it('flags the known note-only row and opens its finding, leaving others alone', async () => {
    expect(await row('CVE-2020-0500')).toEqual({
      kind: 'exploited',
      note_flags: ['not_in_tables'],
      retired: false,
    })
    expect((await row('CVE-2025-38352')).note_flags).toEqual([])
    expect(await findings('vendor_statement_note_only')).toEqual([
      { subject: 'android-bulletins:2022-09-01:CVE-2020-0500', severity: 'warning' },
    ])
  })

  it("keeps a row's flags when an older caller sends none", async () => {
    const r = await record('android-bulletins', [ANDROID], [doc(ANDROID)])
    expect(r).toMatchObject({ added: 0, seen: 1, retired: 0, kind_changed: 0 })
    expect((await row('CVE-2020-0500')).note_flags).toEqual(['not_in_tables'])
  })

  it('updates a held kind on re-read and logs the change', async () => {
    await record('mozilla-mfsa', [MOZ], [doc(MOZ)])
    expect(
      (
        await db.query(
          `select count(*)::int n from vendor_exploit_statements where kind = 'unclassified'`
        )
      ).rows[0].n
    ).toBe(1)
    const r = await record('mozilla-mfsa', [{ ...MOZ, kind: 'not_exploited' }], [doc(MOZ)])
    expect(r).toMatchObject({ seen: 1, kind_changed: 1 })
    expect((await row('CVE-2099-0001')).kind).toBe('not_exploited')
    const log = await db.query(
      `select details->>'from' as "from", details->>'to' as "to", severity
         from data_quality_findings where check_name = 'vendor_statement_kind_changed'`
    )
    expect(log.rows).toEqual([{ from: 'unclassified', to: 'not_exploited', severity: 'info' }])
  })

  it('retires a statement a re-read no longer carries, keeps the row, and restores it', async () => {
    const r = await record('mozilla-mfsa', [], [{ ...doc(MOZ), statements: 0 }])
    expect(r).toMatchObject({ retired: 1 })
    expect(await row('CVE-2099-0001')).toMatchObject({ retired: true })
    // A document not read this run retires nothing.
    expect(await record('android-bulletins', [], [])).toMatchObject({ retired: 0 })
    expect((await row('CVE-2020-0500')).retired).toBe(false)
    const back = await record('mozilla-mfsa', [{ ...MOZ, kind: 'not_exploited' }], [doc(MOZ)])
    expect(back).toMatchObject({ restored: 1, retired: 0 })
    expect((await row('CVE-2099-0001')).retired).toBe(false)
  })

  it('stores flags sent with a new statement and opens a finding', async () => {
    const s = {
      ...ANDROID,
      document_id: '2022-04-01',
      document_date: '2022-04-01',
      cve_id: 'CVE-2023-21096',
      note_flags: ['not_in_tables', 'later_than_bulletin'],
    }
    expect(await record('android-bulletins', [s], [doc(s)])).toMatchObject({ added: 1 })
    expect((await row('CVE-2023-21096')).note_flags).toEqual([
      'not_in_tables',
      'later_than_bulletin',
    ])
    expect((await findings('vendor_statement_note_only')).map((f) => f.subject)).toContain(
      'android-bulletins:2022-04-01:CVE-2023-21096'
    )
    await expect(
      record('android-bulletins', [{ ...s, cve_id: 'CVE-2023-0001', note_flags: ['odd'] }], [])
    ).rejects.toThrow()
  })

  it('opens a column list to the public roles, and the writer to service_role only', async () => {
    const col = async (role, c) =>
      (
        await db.query(
          `select has_column_privilege($1, 'public.vendor_exploit_statements', $2, 'select') as ok`,
          [role, c]
        )
      ).rows[0].ok
    for (const role of ['anon', 'authenticated']) {
      for (const c of ['cve_id', 'statement', 'kind', 'note_flags', 'retired_at']) {
        expect(await col(role, c)).toBe(true)
      }
      const whole = await db.query(
        `select has_table_privilege($1, 'public.vendor_exploit_statements', 'select') as ok`,
        [role]
      )
      expect(whole.rows[0].ok).toBe(false)
    }
    // A column added later is not public.
    await db.query(`alter table vendor_exploit_statements add column reviewer_note text`)
    expect(await col('anon', 'reviewer_note')).toBe(false)
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const ok = await db.query(
        `select has_function_privilege($1, 'public.record_vendor_statements(text, jsonb, jsonb)', 'execute') as ok`,
        [role]
      )
      expect(ok.rows[0].ok).toBe(role === 'service_role')
    }
  })

  it('still hides an unclassified wording from anon, reading as the role', async () => {
    await record('mozilla-mfsa', [{ ...MOZ, cve_id: 'CVE-2099-0002' }], [])
    await db.query('set role anon')
    try {
      const { rows } = await db.query(
        `select kind from vendor_exploit_statements where cve_id like 'CVE-2099-%' order by cve_id`
      )
      expect(rows).toEqual([{ kind: 'not_exploited' }])
    } finally {
      await db.query('reset role')
    }
  })
})
