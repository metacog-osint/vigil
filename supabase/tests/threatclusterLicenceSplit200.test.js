// @vitest-environment node
/**
 * ThreatCluster's two licences (migration 200, ideas#235).
 *
 * On 22 Nov 2026 the upstream data went from GPL-3.0 (TLP:CLEAR in its README)
 * to ThreatCluster's own terms, which allow free and non-commercial use but not
 * resale. A country filled from the old data may be sold; one filled from the
 * new file may not. incidents_commercial (160) decides by victim_country_source,
 * so each licence needs its own label.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(path.resolve(HERE, ...p), 'utf8')
const FUNCTION = read('..', 'functions', 'threatcluster-victims', 'index.ts')
const MIGRATION = read('..', 'migrations', '200_threatcluster_licence_split.sql')

// The columns 160 reads, as production has them, and the rows 136 left for these sources.
const SCHEMA = `
  create table source_licences (
    source_id text primary key,
    display_name text not null,
    licence text not null,
    licence_url text,
    commercial_use boolean not null default false,
    attribution_required boolean not null default true,
    checked_on date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  insert into source_licences (source_id, display_name, licence, commercial_use, checked_on, notes) values
    ('ransomlook', 'RansomLook', 'CC BY 4.0', true, null, null),
    ('ransomware.live', 'Ransomware.live', 'personal use', false, null, null),
    ('threatcluster', 'ThreatCluster Ransomware-Intel', 'TLP:CLEAR', true, '2026-09-21', 'old note');

  create table threat_actors (id uuid primary key default gen_random_uuid(), name text not null, source text);
  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id),
    victim_name text, incident_date date, discovered_date date, claim_date date,
    victim_country text, victim_country_source text, victim_sector text,
    victim_website text, status text, source_url text, source text, updated_at timestamptz
  );
  create table actor_techniques (actor_id uuid, technique_id text, confidence text,
    first_seen date, last_seen date, source text);
  create table actor_tools (actor_id uuid, tool_name text, category text,
    first_seen date, last_seen date, source text);
  create table actor_sites (actor_id uuid, fqdn text, enabled boolean, available boolean,
    first_seen date, last_seen date, source text);
`

let db

beforeAll(async () => {
  db = await freshDatabase({
    schema: SCHEMA,
    migrations: ['160_commercial_views.sql', '200_threatcluster_licence_split.sql'],
  })
  const fill = (name, source) =>
    db.query(
      `insert into incidents (victim_name, victim_country, victim_country_source, source)
       values ($1, 'DE', $2, 'ransomlook')`,
      [name, source]
    )
  await fill('filled before the change', 'threatcluster')
  await fill('backfilled from the GPL snapshot', 'threatcluster-gpl-20261121')
  await fill('filled from the free file', 'threatcluster-terms-20261122')
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('source_licences after 200', () => {
  it('has a row per label, and only the post-change terms are not sellable', async () => {
    const { rows } = await db.query(
      `select source_id, commercial_use from source_licences where source_id like 'threatcluster%' order by 1`
    )
    expect(rows).toEqual([
      { source_id: 'threatcluster', commercial_use: true },
      { source_id: 'threatcluster-gpl-20261121', commercial_use: true },
      { source_id: 'threatcluster-terms-20261122', commercial_use: false },
    ])
  })

  it('records the commit the backfill is pinned to, and the dates of the change', async () => {
    const { rows } = await db.query(
      `select source_id, notes, checked_on::text as checked_on from source_licences
       where source_id in ('threatcluster', 'threatcluster-gpl-20261121', 'threatcluster-terms-20261122')`
    )
    const by = Object.fromEntries(rows.map((r) => [r.source_id, r]))
    expect(by['threatcluster-gpl-20261121'].notes).toContain('3ae03304552ec01bfff7e77a5652e6459d193db2')
    expect(by['threatcluster-terms-20261122'].notes).toContain('eaee73985e')
    expect(by.threatcluster.notes).not.toBe('old note')
    expect(by.threatcluster.checked_on).toBe('2026-11-25')
  })

  it('is safe to run twice', async () => {
    await db.exec(MIGRATION)
    const { rows } = await db.query(
      `select count(*)::int as n from source_licences where source_id like 'threatcluster%'`
    )
    expect(rows[0].n).toBe(3)
  })
})

describe('incidents_commercial', () => {
  it('shows a country filled under the old terms or from the GPL snapshot, and withholds one from the free file', async () => {
    const { rows } = await db.query(
      `select victim_name, victim_country, victim_country_withheld from incidents_commercial order by victim_name`
    )
    const by = Object.fromEntries(rows.map((r) => [r.victim_name, r]))
    expect(by['filled before the change']).toMatchObject({ victim_country: 'DE', victim_country_withheld: false })
    expect(by['backfilled from the GPL snapshot']).toMatchObject({ victim_country: 'DE', victim_country_withheld: false })
    expect(by['filled from the free file']).toMatchObject({ victim_country: null, victim_country_withheld: true })
  })
})

describe('the threatcluster-victims function (text)', () => {
  it('pins the backfill to the last GPL-3.0 commit, by full sha, and offers no way to name another', () => {
    expect(FUNCTION).toContain("const GPL_COMMIT = '3ae03304552ec01bfff7e77a5652e6459d193db2'")
    expect(FUNCTION).toContain("'gpl-365d': `${GPL_BASE}/victims-365d.csv`")
    expect(FUNCTION).not.toMatch(/body\??\.(ref|commit|sha)/)
  })

  it('labels each window with a source that 200 gives a licence row', () => {
    const labels = [...FUNCTION.matchAll(/'(?:90d|365d|gpl-365d)': '(threatcluster-[a-z0-9-]+)'/g)].map((m) => m[1])
    expect(new Set(labels)).toEqual(new Set(['threatcluster-terms-20261122', 'threatcluster-gpl-20261121']))
    for (const l of labels) expect(MIGRATION).toContain(`'${l}'`)
  })

  it("writes with the window's own label, not a fixed one", () => {
    expect(FUNCTION).toContain('p_source: SOURCES[window]')
    expect(FUNCTION).not.toContain("p_source: 'threatcluster'")
  })

  it('leaves the daily run on the 90d window', () => {
    const worker = read('..', '..', 'workers', 'src', 'feeds', 'threatcluster.js')
    expect(worker).toContain("window: '90d'")
    expect(worker).not.toContain('gpl-365d')
  })
})
