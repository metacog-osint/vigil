// @vitest-environment node
/**
 * Migration 173: the victim_name_markup card reads each marked-up name into its
 * parts and shows the same group's clean copy of the claim, if Vigil holds one.
 * It is a reading for a person: nothing is written, the placeholders 170 settled
 * stay out, and a part the text does not hold is left empty, never guessed.
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
`

const HUB = '00000000-0000-0000-0000-0000000000a1'
const QUANTUM = '00000000-0000-0000-0000-0000000000a2'

describe('migration 173', () => {
  let db
  let rows

  const byStored = (text) => rows.find((r) => r.as_stored === text)

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['173_review_victim_name_markup.sql'] })
    await db.exec(`
      insert into threat_actors (id, name) values ('${HUB}', 'ransomhub'), ('${QUANTUM}', 'QuantumLocker');
      insert into incidents (actor_id, victim_name, discovered_date, source, data_quality) values
        ('${HUB}', '[Published]Constelacion Savings<www.constelacion.com.sv>', '2024-04-24', 'ransomwatch', 'ok'),
        ('${HUB}', 'Constelacion Savings', '2024-04-04', 'ransomware.live', 'ok'),
        ('${HUB}', 'Constelacion Savings', '2024-04-23', 'ransomware.live', 'ok'),
        ('${HUB}', 'AL SHEFA FARM<https://al-shefafarm.ro>(SOLD)', '2024-03-04', 'ransomwatch', 'ok'),
        ('${HUB}', 'CYNC SOLUTIONS - The unexpected target.<Updated>', '2024-04-24', 'ransomwatch', 'ok'),
        ('${HUB}', 'EUROPEANPROF - Expertos - <europeanprof.es>', '2024-04-24', 'ransomwatch', 'ok'),
        ('${HUB}', 'EUROPEANPROF - Expertos - ', '2024-04-24', 'ransomware.live', 'ok'),
        ('${HUB}', 'National Agency <nepa.gov.af/df', '2024-05-04', 'ransomwatch', 'ok'),
        ('${QUANTUM}', '</a>', '2021-11-22', 'ransomware.live', 'ok'),
        ('${HUB}', 'RCSSTI {{7*7}} <%=7*7%>', '2026-08-22', 'ransomlook', 'placeholder');
      insert into data_quality_findings (check_name, subject)
        values ('victim_name_markup', '59 incidents whose victim_name holds angle brackets');
    `)
    const { rows: found } = await db.query(
      `select evidence from review_reading_evidence where check_name = 'victim_name_markup'`
    )
    rows = found[0].evidence.rows
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('lists every marked-up claim and leaves out the placeholders 170 settled', () => {
    expect(rows).toHaveLength(6)
    expect(rows.some((r) => r.as_stored.includes('{{7*7}}'))).toBe(false)
  })

  it('splits a name from its site and keeps the leading label as a label', () => {
    const r = byStored('[Published]Constelacion Savings<www.constelacion.com.sv>')
    expect(r.name).toBe('Constelacion Savings')
    expect(r.site).toBe('www.constelacion.com.sv')
    expect(r.labels).toEqual(['Published'])
    expect(r.group).toBe('ransomhub')
  })

  it('drops the scheme from a site and reads a trailing (SOLD) as a label', () => {
    const r = byStored('AL SHEFA FARM<https://al-shefafarm.ro>(SOLD)')
    expect(r.name).toBe('AL SHEFA FARM')
    expect(r.site).toBe('al-shefafarm.ro')
    expect(r.labels).toEqual(['SOLD'])
  })

  it('reads a word in brackets as a label, not a site', () => {
    const r = byStored('CYNC SOLUTIONS - The unexpected target.<Updated>')
    expect(r.name).toBe('CYNC SOLUTIONS - The unexpected target.')
    expect(r.site).toBeNull()
    expect(r.labels).toEqual(['Updated'])
  })

  it('says when the source cut the bracket off', () => {
    const r = byStored('National Agency <nepa.gov.af/df')
    expect(r.site).toBe('nepa.gov.af/df')
    expect(r.cut_off).toBe(true)
  })

  it('reads a bare tag as naming nobody, with no twin', () => {
    const r = byStored('</a>')
    expect(r.name).toBeNull()
    expect(r.labels).toEqual(['</a>'])
    expect(r.clean_twin).toBeNull()
    expect(r.group).toBe('QuantumLocker')
  })

  it('shows the clean copy nearest in date, matching past a trailing dash', () => {
    const r = byStored('[Published]Constelacion Savings<www.constelacion.com.sv>')
    expect(r.clean_twin.posted).toBe('2024-04-23')
    expect(r.clean_twin.source).toBe('ransomware.live')
    const e = byStored('EUROPEANPROF - Expertos - <europeanprof.es>')
    expect(e.name).toBe('EUROPEANPROF - Expertos')
    expect(e.clean_twin.name).toBe('EUROPEANPROF - Expertos - ')
  })

  it('changes no incident', async () => {
    const { rows: stored } = await db.query(
      `select count(*)::int as n from incidents where victim_name like '%<%'`
    )
    expect(stored[0].n).toBe(7)
  })
})
