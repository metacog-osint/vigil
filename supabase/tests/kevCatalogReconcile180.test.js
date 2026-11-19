// @vitest-environment node
/**
 * Migration 180: KEV in Vigil means CISA's catalogue as it stands. The 8 rows
 * flagged KEV that CISA did not list on 19 Nov 2026 are archived and cleared,
 * and reconcile_kev_catalog keeps it that way after each cisa-kev run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, migration } from './pg.js'

const SCHEMA = `
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text,
    updated_at timestamptz
  );
  create table vulnerabilities (
    cve_id text primary key, description text, title text, source text,
    kev_date date, kev_date_added date, kev_due_date date,
    is_kev boolean default false, exploited_in_wild boolean default false,
    ransomware_campaign_use boolean, ransomware_use boolean,
    vendor text, product text, affected_vendors text[], affected_products text[],
    metadata jsonb default '{}'
  );
  create table data_quality_findings (
    check_name text, subject text,
    severity text check (severity in ('info', 'warning', 'error')),
    status text check (status in ('open', 'auto_resolved', 'auto_closed', 'resolved', 'dismissed')),
    details jsonb,
    resolved_at timestamptz, last_seen timestamptz default now(),
    unique (check_name, subject)
  );
  create function public.record_finding(
    p_check text, p_subject text, p_severity text, p_status text, p_details jsonb
  ) returns void language sql security definer set search_path = public as $$
    insert into data_quality_findings (check_name, subject, severity, status, details)
    values (p_check, p_subject, p_severity, p_status, p_details)
    on conflict (check_name, subject) do update set details = excluded.details, last_seen = now();
  $$;
`

// The eight rows as measured live on 19 Nov 2026, reduced to what matters.
const SEED = `
  insert into vulnerabilities (cve_id, description, title, source, kev_date, kev_due_date, metadata) values
    ('CVE-2026-23744', 'cna text', 'vc title', 'epss', '2026-02-18', null, '{"xdb":[],"reported_exploitation":[],"title":"vc title","required_action":"x","cwes":[]}'),
    ('CVE-2026-3584',  'cna text', 'vc title', 'epss', '2026-03-20', null, '{"xdb":[],"reported_exploitation":[]}'),
    ('CVE-2026-4020',  'cna text', 'vc title', 'epss', '2026-03-31', null, '{"xdb":[],"reported_exploitation":[]}'),
    ('CVE-2026-24477', 'cna text', 'vc title', 'epss', '2026-04-01', null, '{"xdb":[],"reported_exploitation":[]}'),
    ('CVE-2026-27971', 'cna text', 'vc title', 'epss', '2026-04-01', null, '{"xdb":[],"reported_exploitation":[]}'),
    ('CVE-2026-0740',  'nvd text', null, 'nvd', '2026-04-06', null, '{"published":"x"}'),
    ('CVE-2026-22679', 'nvd text', null, 'nvd', '2026-04-07', null, '{"published":"x"}'),
    ('CVE-2026-69836', 'kev text', 'Entra', 'cisa-kev', '2026-08-21', '2026-08-24', '{"title":"Entra","required_action":"x"}'),
    ('CVE-2026-1281',  'kev text', 'Ivanti', 'cisa-kev', '2026-01-29', '2026-02-01', '{"title":"Ivanti"}'),
    ('CVE-2026-0001',  'plain', null, 'nvd', null, null, '{}');
`

const EIGHT = [
  'CVE-2026-23744', 'CVE-2026-3584', 'CVE-2026-4020', 'CVE-2026-24477',
  'CVE-2026-27971', 'CVE-2026-0740', 'CVE-2026-22679', 'CVE-2026-69836',
]

// A catalogue list of n ids that always includes the one real KEV row kept above.
const catalogue = (n) => ['CVE-2026-1281', ...Array.from({ length: n - 1 }, (_, i) => `CVE-2099-${i}`)]

describe('migration 180', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['102_kev_columns_agree.sql', '164_retire_vulncheck.sql'],
    })
    await db.exec(SEED)
    await db.exec(migration('180_kev_catalog_reconcile.sql'))
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  const row = async (cve) =>
    (await db.query('select * from vulnerabilities where cve_id = $1', [cve])).rows[0]

  it('clears the eight and leaves CISA-listed and non-KEV rows alone', async () => {
    for (const cve of EIGHT) {
      const r = await row(cve)
      expect(r.is_kev, cve).toBe(false)
      expect(r.kev_date, cve).toBeNull()
      expect(r.kev_date_added, cve).toBeNull()
      expect(r.exploited_in_wild, cve).toBe(false)
    }
    const kept = await row('CVE-2026-1281')
    expect(kept.is_kev).toBe(true)
    expect(kept.title).toBe('Ivanti')
    expect((await row('CVE-2026-0001')).is_kev).toBe(false)
  })

  it('strips VulnCheck fields from the five leftovers and backs them up', async () => {
    const r = await row('CVE-2026-23744')
    expect(r.metadata).toEqual({})
    expect(r.title).toBeNull()
    expect(r.description).toBe('cna text')
    const { rows } = await db.query('select count(*)::int n from vulncheck_retired_rows')
    expect(rows[0].n).toBe(5)
  })

  it('archives all eight, each with its reason', async () => {
    const { rows } = await db.query(
      'select reason, count(*)::int n from kev_unlisted_rows group by reason order by reason'
    )
    expect(rows).toEqual([
      { reason: 'origin_unrecorded', n: 2 },
      { reason: 'removed_by_cisa', n: 1 },
      { reason: 'vulncheck_leftover', n: 5 },
    ])
    const entra = (
      await db.query(`select row from kev_unlisted_rows where cve_id = 'CVE-2026-69836'`)
    ).rows[0].row
    expect(entra.kev_date).toBe('2026-08-21')
  })

  it('refuses a catalogue under 1,000 entries', async () => {
    await expect(
      db.query('select reconcile_kev_catalog($1, $2)', [catalogue(999), 'test'])
    ).rejects.toThrow(/refusing a catalogue of 999/)
  })

  it('clears a row CISA stops listing, and records it', async () => {
    await db.exec(`insert into vulnerabilities (cve_id, source, kev_date, kev_due_date)
                   values ('CVE-2026-5555', 'cisa-kev', '2026-11-01', '2026-11-22')`)
    expect((await row('CVE-2026-5555')).is_kev).toBe(true)
    const out = (
      await db.query('select reconcile_kev_catalog($1, $2) as r', [catalogue(1200), '2026.11.19'])
    ).rows[0].r
    expect(out.cleared).toBe(1)
    expect(out.cve_ids).toEqual(['CVE-2026-5555'])
    expect((await row('CVE-2026-5555')).is_kev).toBe(false)
    expect((await row('CVE-2026-1281')).is_kev).toBe(true)
    const f = await db.query(
      `select status from data_quality_findings where check_name = 'kev_unlisted' and subject = 'CVE-2026-5555'`
    )
    expect(f.rows[0].status).toBe('auto_resolved')
  })

  it('holds more than 25 unlisted rows for a person instead of clearing them', async () => {
    await db.exec(`insert into vulnerabilities (cve_id, source, kev_date)
                   select 'CVE-2030-' || g, 'cisa-kev', '2026-11-01' from generate_series(1, 26) g`)
    const out = (
      await db.query('select reconcile_kev_catalog($1, $2) as r', [catalogue(1200), '2026.11.20'])
    ).rows[0].r
    expect(out).toMatchObject({ cleared: 0, held: 26 })
    expect((await row('CVE-2030-1')).is_kev).toBe(true)
    const f = await db.query(
      `select severity, status from data_quality_findings where check_name = 'kev_unlisted_bulk'`
    )
    expect(f.rows[0]).toEqual({ severity: 'warning', status: 'open' })
  })

  it('lets only service_role call the reconcile and nobody read the archive', async () => {
    const exec = async (role, fn) =>
      (await db.query('select has_function_privilege($1, $2, $3) as ok', [role, fn, 'EXECUTE']))
        .rows[0].ok
    const reconcile = 'public.reconcile_kev_catalog(text[], text)'
    const clear = 'public.clear_kev_flags(text[], text, text)'
    for (const role of ['anon', 'authenticated']) {
      expect(await exec(role, reconcile)).toBe(false)
      expect(await exec(role, clear)).toBe(false)
      const sel = await db.query(`select has_table_privilege($1, 'public.kev_unlisted_rows', 'SELECT') ok`, [role])
      expect(sel.rows[0].ok).toBe(false)
    }
    expect(await exec('service_role', reconcile)).toBe(true)
    expect(await exec('service_role', clear)).toBe(false)
  })
})
