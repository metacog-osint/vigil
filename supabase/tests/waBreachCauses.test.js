// @vitest-environment node
/**
 * Migration 174: Washington's own record of each breach's cause, matched onto
 * Vigil's notice rows by name and date, and shown on the breach-notice card.
 * A cause is the Attorney General's category, so it is stored as given; a
 * notice with no matching row keeps nulls; nothing about any claim changes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(),
    check_name text, subject text, status text default 'open', details jsonb default '{}'
  );
  create table vendor_reports (id uuid default gen_random_uuid(), url text, title text, summary text, published date);
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text);
  create table incidents (
    id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text,
    discovered_date date, source text, raw_data jsonb, data_quality text default 'ok'
  );
  create table contested_claims (id uuid primary key default gen_random_uuid(), question text, unit text);
  create table evidence_publishers (publisher_id text primary key, display_name text, tier text);
  create table claim_values (
    id uuid primary key default gen_random_uuid(), claim_id uuid, publisher_id text,
    value_numeric numeric, value_text text, measurement text, as_of date, window_note text,
    source_url text, citation text, verification text, verified_on date, entered_from text
  );
  create table regulatory_advisories (
    source text, advisory_id text, language text, kind text, title text, published date,
    url text, document_url text, indicators_read boolean
  );
  create table victim_disclosures (
    id uuid primary key default gen_random_uuid(), company_name text, filed_date date,
    source text, filing_url text, match_status text default 'unreviewed'
  );
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text
  );
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
`

describe('migration 174', () => {
  let db
  let result

  const notice = async (url) =>
    (
      await db.query(
        `select breach_cause, cyberattack_type, cause_source, match_status
           from victim_disclosures where filing_url = $1`,
        [url]
      )
    ).rows[0]

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['174_wa_breach_causes.sql'] })
    await db.exec(`
      insert into victim_disclosures (company_name, filed_date, source, filing_url) values
        ('See’s Candies, Inc.', '2026-09-02', 'wa-ag', 'wa/1'),
        ('Lusamerica Foods', '2026-05-18', 'wa-ag', 'wa/2'),
        ('Port of Seattle', '2025-04-03', 'wa-ag', 'wa/3'),
        ('Port of Seattle', '2025-04-03', 'ca-ag', 'ca/3'),
        ('Betterment LLC', '2026-03-27', 'wa-ag', 'wa/4');
      insert into data_quality_findings (check_name, subject, details) values
        ('breach_notice_candidate', 'See''s: WA notice', '{"notice": "wa/1", "registry": "wa-ag"}'),
        ('breach_notice_candidate', 'Lusamerica: WA notice', '{"notice": "wa/2", "registry": "wa-ag"}'),
        ('breach_notice_candidate', 'Port: CA notice', '{"notice": "ca/3", "registry": "ca-ag"}');
    `)
    const { rows } = await db.query(`select public.apply_wa_breach_causes($1::jsonb) as r`, [
      JSON.stringify([
        // Curly apostrophe and punctuation differ; letters and digits match.
        { name: "See's Candies Inc", submitted: '2026-09-03', cause: 'Cyberattack', attack_type: 'Ransomware' },
        { name: 'Port of Seattle', submitted: '2025-04-03', cause: 'Cyberattack', attack_type: 'Ransomware' },
        // Same name, two dataset rows: the nearer date wins.
        { name: 'Betterment LLC', submitted: '2026-03-20', cause: 'Theft or Mistake', attack_type: null },
        { name: 'Betterment LLC', submitted: '2026-03-26', cause: 'Unauthorized Access', attack_type: null },
        // Too far apart in date to be the same notice.
        { name: 'Lusamerica Foods', submitted: '2026-05-30', cause: 'Cyberattack', attack_type: 'Malware' },
        { name: '', submitted: '2026-01-01', cause: 'Cyberattack' },
      ]),
    ])
    result = rows[0].r
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('matches by name, letters and digits only, within three days', async () => {
    expect(await notice('wa/1')).toMatchObject({
      breach_cause: 'Cyberattack',
      cyberattack_type: 'Ransomware',
      cause_source: 'wa-ag-open-data',
    })
  })

  it('takes the nearer date when the dataset has the name twice', async () => {
    expect((await notice('wa/4')).breach_cause).toBe('Unauthorized Access')
  })

  it('leaves a notice with no close row empty, and other states untouched', async () => {
    expect((await notice('wa/2')).breach_cause).toBeNull()
    expect((await notice('ca/3')).breach_cause).toBeNull()
  })

  it('changes no match status', async () => {
    const { rows } = await db.query(
      `select count(*)::int as n from victim_disclosures where match_status <> 'unreviewed'`
    )
    expect(rows[0].n).toBe(0)
  })

  it('reports what it did', () => {
    expect(result).toMatchObject({ rows: 6, updated: 3, with_cause: 3 })
  })

  it('writes nothing the second time', async () => {
    const { rows } = await db.query(`select public.apply_wa_breach_causes($1::jsonb) as r`, [
      JSON.stringify([
        { name: 'Port of Seattle', submitted: '2025-04-03', cause: 'Cyberattack', attack_type: 'Ransomware' },
      ]),
    ])
    expect(rows[0].r.updated).toBe(0)
  })

  it('puts the cause on Washington cards and says when there is none', async () => {
    const { rows } = await db.query(
      `select subject, evidence from review_reading_evidence
        where check_name = 'breach_notice_candidate' order by subject`
    )
    const bySubject = Object.fromEntries(rows.map((r) => [r.subject, r.evidence]))
    expect(bySubject["See's: WA notice"]).toMatchObject({ cause: 'Cyberattack', attack_type: 'Ransomware' })
    expect(bySubject['Lusamerica: WA notice']).toMatchObject({ registry: 'wa-ag', cause: null })
    expect(bySubject['Port: CA notice']).toBeUndefined()
  })

  it('registers the source and the feed, and keeps the writer from the browser', async () => {
    const { rows: lic } = await db.query(
      `select commercial_use from source_licences where source_id = 'wa-ag-open-data'`
    )
    expect(lic[0].commercial_use).toBe(false)
    const { rows: feed } = await db.query(
      `select critical from feed_expectations where feed_id = 'wa-breach-causes'`
    )
    expect(feed[0].critical).toBe(false)
    const { rows: grants } = await db.query(`
      select has_function_privilege('anon', 'public.apply_wa_breach_causes(jsonb)', 'execute') as anon,
             has_function_privilege('authenticated', 'public.apply_wa_breach_causes(jsonb)', 'execute') as auth,
             has_function_privilege('service_role', 'public.apply_wa_breach_causes(jsonb)', 'execute') as svc`)
    expect(grants[0]).toEqual({ anon: false, auth: false, svc: true })
  })
})
