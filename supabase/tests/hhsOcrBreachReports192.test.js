// @vitest-environment node
/**
 * Migration 192: HHS OCR breach reports in victim_disclosures, with HHS's own
 * fields as given; a report OCR revised or closed is updated in place and an
 * unchanged one is not rewritten; a new report naming a claimed victim gets a
 * review card carrying HHS's fields; only service_role can write.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text
  );
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
  create table victim_disclosures (
    id uuid primary key default gen_random_uuid(),
    accession text not null unique, company_name text not null, filed_date date not null,
    form text not null, filing_url text not null, source text not null default 'sec-edgar',
    match_status text not null default 'unreviewed', incident_date date, state text,
    business_location text, persons_affected bigint, data_types text[], discovered_date date,
    persons_affected_scope text check (persons_affected_scope is null or persons_affected_scope in ('state_residents', 'total')),
    breach_cause text, cyberattack_type text, cause_source text, cause_recorded_at timestamptz
  );
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text);
  create table incidents (
    id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text, discovered_date date
  );
  create function public.company_key(n text) returns text language sql immutable as
    $$ select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g') $$;
  create table findings (check_name text, subject text, severity text, status text, details jsonb);
  create function public.record_finding(a text, b text, c text, d text, e jsonb) returns void
    language sql as $$ insert into findings values (a, b, c, d, e) $$;
  -- 190's trigger, as live.
  create function public.breach_notices_inserted() returns trigger language plpgsql as $$
  begin
    perform queue_breach_notice_candidates(
      (select coalesce(array_agg(id), '{}') from new_rows
        where source <> 'sec-edgar' and filed_date >= current_date - 90));
    return null;
  end $$;
  create trigger victim_disclosures_breach_candidates after insert on victim_disclosures
    referencing new table as new_rows for each statement execute function breach_notices_inserted();
`

const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10)

const report = (over = {}) => ({
  accession: `hhs-ocr:centralohioprimarycare:OH:${day(10)}:1`,
  company_name: 'Central Ohio Primary Care',
  entity_state: 'OH',
  entity_type: 'Healthcare Provider',
  persons_affected: 1351650,
  submitted: day(10),
  breach_type: 'Hacking/IT Incident',
  locations: ['Network Server'],
  business_associate: false,
  description: null,
  status: 'under_investigation',
  url: 'https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf',
  ...over,
})

describe('migration 192', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['192_hhs_ocr_breach_reports.sql'] })
    await db.exec(`
      insert into threat_actors (id, name) values ('00000000-0000-0000-0000-000000000001', 'examplegroup');
      insert into incidents (actor_id, victim_name, discovered_date)
        values ('00000000-0000-0000-0000-000000000001', 'Central Ohio Primary Care', current_date - 20);
    `)
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const apply = async (rows) =>
    (await db.query(`select apply_hhs_breach_reports($1::jsonb) as r`, [JSON.stringify(rows)]))
      .rows[0].r

  const held = async (accession) =>
    (await db.query(`select * from victim_disclosures where accession = $1`, [accession])).rows[0]

  it('registers the source and watches the feed', async () => {
    const lic = await db.query(
      `select commercial_use from source_licences where source_id = 'hhs-ocr'`
    )
    expect(lic.rows).toEqual([{ commercial_use: true }])
    const fe = await db.query(
      `select expected_interval_minutes, critical from feed_expectations where feed_id = 'hhs-ocr-breaches'`
    )
    expect(fe.rows).toEqual([{ expected_interval_minutes: 1440, critical: false }])
  })

  it("stores HHS's fields as given, outside the state registries' column", async () => {
    const old = report({
      accession: 'hhs-ocr:oldclinic:MN:2014-03-01:1',
      company_name: 'Old Clinic',
      entity_state: 'MN',
      submitted: '2014-03-01',
      breach_type: 'Theft',
      locations: ['Laptop', 'Paper/Films'],
      business_associate: true,
      persons_affected: 900,
      status: 'archived',
      description: 'The covered entity reported that a laptop was stolen.',
    })
    const out = await apply([report(), old])
    expect(out).toMatchObject({ seen: 2, new: 2, changed: 0, held_total: 2 })

    const r = await held(report().accession)
    expect(r).toMatchObject({
      source: 'hhs-ocr',
      form: 'hipaa-breach-report',
      state: null,
      business_location: 'OH',
      covered_entity_type: 'Healthcare Provider',
      persons_affected: 1351650,
      persons_affected_scope: 'total',
      breach_cause: 'Hacking/IT Incident',
      cause_source: 'hhs-ocr',
      breach_locations: ['Network Server'],
      business_associate_present: false,
      regulator_status: 'under_investigation',
      regulator_description: null,
      match_status: 'unreviewed',
    })
    expect((await held(old.accession)).breach_locations).toEqual(['Laptop', 'Paper/Films'])
  })

  it('does not rewrite a report nothing changed in', async () => {
    const out = await apply([report()])
    expect(out).toMatchObject({ seen: 1, new: 0, changed: 0 })
  })

  it('follows a report OCR closed and revised, and keeps its description after', async () => {
    const closed = report({
      status: 'archived',
      persons_affected: 1400000,
      description:
        'OCR Transaction Number: 00-000000\n\nThe covered entity reported a hacking incident.',
    })
    expect(await apply([closed])).toMatchObject({
      new: 0,
      changed: 1,
      moved_to_archive: 1,
      count_revised: 1,
    })
    expect(await held(closed.accession)).toMatchObject({
      regulator_status: 'archived',
      persons_affected: 1400000,
    })

    // A later export with the description blank never erases OCR's words.
    expect(await apply([{ ...closed, description: '' }])).toMatchObject({ changed: 0 })
    expect((await held(closed.accession)).regulator_description).toContain('hacking incident')
  })

  it('skips rows with no name, no date, a foreign accession or an unknown list', async () => {
    const out = await apply([
      report({ accession: 'hhs-ocr:x:na:2026-01-01:1', company_name: ' ' }),
      report({ accession: 'hhs-ocr:y:na:2026-01-01:1', submitted: '' }),
      report({ accession: 'ca-ag:z:na:2026-01-01' }),
      report({ accession: 'hhs-ocr:w:na:2026-01-01:1', status: 'closed' }),
    ])
    expect(out).toMatchObject({ seen: 0, new: 0 })
  })

  it("queues a new report naming a claimed victim, with HHS's fields on the card", async () => {
    const r = await db.query(
      `select subject, details from findings where check_name = 'breach_notice_candidate'`
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].subject).toBe(
      `Central Ohio Primary Care: HHS breach notice reported ${day(10)}`
    )
    expect(r.rows[0].details).toMatchObject({
      registry: 'hhs-ocr',
      persons_affected: 1351650,
      hhs_entity_state: 'OH',
      hhs_entity_type: 'Healthcare Provider',
      hhs_breach_type: 'Hacking/IT Incident',
      hhs_location: 'Network Server',
      hhs_business_associate: false,
      hhs_list: 'under_investigation',
    })
    // The 2014 report was stored, not queued (190's 90 days).
    expect(r.rows[0].details.reported).toBe(day(10))
  })

  it('leaves a state notice card as it was', async () => {
    await db.exec(`insert into source_licences (source_id) values ('ca-ag')`)
    await db.query(
      `insert into victim_disclosures (accession, company_name, filed_date, form, filing_url, source, state)
       values ('ca-ag:centralohioprimarycare:na:' || $1, 'Central Ohio Primary Care', $1::date, 'breach-notice', 'u', 'ca-ag', 'CA')`,
      [day(5)]
    )
    const r = await db.query(`select details from findings where details ->> 'registry' = 'ca-ag'`)
    expect(r.rows).toHaveLength(1)
    expect(Object.keys(r.rows[0].details).filter((k) => k.startsWith('hhs_'))).toEqual([])
  })

  it('lets only service_role write', async () => {
    const r = await db.query(`
      select has_function_privilege('anon', 'apply_hhs_breach_reports(jsonb)', 'execute') as anon,
             has_function_privilege('authenticated', 'apply_hhs_breach_reports(jsonb)', 'execute') as auth,
             has_function_privilege('service_role', 'apply_hhs_breach_reports(jsonb)', 'execute') as svc,
             has_function_privilege('authenticated', 'queue_breach_notice_candidates(uuid[])', 'execute') as q
    `)
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true, q: false })
  })

  it('refuses to write while the source is unregistered', async () => {
    await db.exec(`delete from source_licences where source_id = 'hhs-ocr'`)
    await expect(apply([report()])).rejects.toThrow(/unregistered disclosure source: hhs-ocr/)
  })
})
