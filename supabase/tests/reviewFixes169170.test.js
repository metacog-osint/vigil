// @vitest-environment node
/**
 * Migrations 169 and 170: two review-queue verdicts carried out.
 *
 * 169 removes the 100 vulnerabilities stored under a JSON-array key, after an
 * undo copy, and refuses when a malformed row has no twin or something points
 * at it. 170 lifts five victim names out of leak-site markup, keeps what was
 * received, marks the empty description block a placeholder through the
 * generated column, and queues the other markup it found rather than fixing it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, migration } from './pg.js'

const VULNS = `
  create table vulnerabilities (
    cve_id text primary key,
    is_kev boolean default false,
    kev_date date,
    description text,
    source text
  );
  create table actor_vulnerabilities (cve_id text references vulnerabilities(cve_id) on delete cascade);
  create table cve_advisories (cve_id text references vulnerabilities(cve_id) on delete cascade);
  create table exploits (cve_id text references vulnerabilities(cve_id) on delete set null);
  create table kev_epss_p1 (cve_id text references vulnerabilities(cve_id) on delete cascade);
`

describe('migration 169', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({ schema: VULNS })
    await db.exec(`
      insert into vulnerabilities (cve_id, is_kev, kev_date, description) values
        ('CVE-2024-1111', true, '2024-02-01', 'well formed'),
        ('CVE-2023-22222', true, '2023-05-01', 'well formed'),
        ('CVE-2025-3333', false, null, 'unrelated');
      insert into vulnerabilities (cve_id) values ('["CVE-2024-1111"]'), ('["CVE-2023-22222"]');
    `)
    await db.exec(migration('169_vulnerability_malformed_keys.sql'))
  }, 60_000)
  afterAll(() => db?.close())

  it('removes every malformed key and leaves the twins as they were', async () => {
    const { rows } = await db.query(`select cve_id, is_kev from vulnerabilities order by cve_id`)
    expect(rows).toEqual([
      { cve_id: 'CVE-2023-22222', is_kev: true },
      { cve_id: 'CVE-2024-1111', is_kev: true },
      { cve_id: 'CVE-2025-3333', is_kev: false },
    ])
  })

  it('keeps an undo copy naming each twin', async () => {
    const { rows } = await db.query(
      `select cve_id, twin_id, row->>'cve_id' as kept from vulnerability_malformed_keys order by cve_id`
    )
    expect(rows).toEqual([
      { cve_id: '["CVE-2023-22222"]', twin_id: 'CVE-2023-22222', kept: '["CVE-2023-22222"]' },
      { cve_id: '["CVE-2024-1111"]', twin_id: 'CVE-2024-1111', kept: '["CVE-2024-1111"]' },
    ])
  })

  it('refuses a malformed key with no twin', async () => {
    const other = await freshDatabase({ schema: VULNS })
    await other.exec(`insert into vulnerabilities (cve_id) values ('["CVE-2020-9999"]')`)
    await expect(other.exec(migration('169_vulnerability_malformed_keys.sql'))).rejects.toThrow(
      /without a twin/
    )
    const { rows } = await other.query(`select count(*)::int as n from vulnerabilities`)
    expect(rows[0].n).toBe(1)
    await other.close()
  }, 60_000)

  it('refuses a malformed key something points at', async () => {
    const other = await freshDatabase({ schema: VULNS })
    await other.exec(`
      insert into vulnerabilities (cve_id) values ('CVE-2024-1111'), ('["CVE-2024-1111"]');
      insert into exploits (cve_id) values ('["CVE-2024-1111"]');
    `)
    await expect(other.exec(migration('169_vulnerability_malformed_keys.sql'))).rejects.toThrow(
      /referenced/
    )
    await other.close()
  }, 60_000)

  it('opens the undo table to the service role only', async () => {
    const { rows } = await db.query(`
      select has_table_privilege('anon', 'vulnerability_malformed_keys', 'select') as anon,
             has_table_privilege('authenticated', 'vulnerability_malformed_keys', 'select') as auth,
             has_table_privilege('service_role', 'vulnerability_malformed_keys', 'select') as svc
    `)
    expect(rows[0]).toEqual({ anon: false, auth: false, svc: true })
  })
})

// incidents as production has it: data_quality generated (077, widened since),
// 077's policy and a view reading it, so SET EXPRESSION meets its dependants.
const INCIDENTS = `
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(),
    check_name text not null,
    subject text not null,
    severity text not null,
    status text not null default 'open',
    details jsonb default '{}',
    resolved_at timestamptz,
    unique (check_name, subject)
  );
  create function record_finding(p_check text, p_subject text, p_severity text, p_status text, p_details jsonb)
  returns void language sql as $$
    insert into data_quality_findings (check_name, subject, severity, status, details)
    values (p_check, p_subject, p_severity, p_status, p_details)
    on conflict (check_name, subject) do update set details = excluded.details;
  $$;

  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid,
    victim_name text,
    discovered_date date,
    source text,
    raw_data jsonb,
    data_quality text generated always as (
      case
        when victim_name ~* '^\\s*(company\\s*id\\s*:|audit\\s+entity\\s*:)' then 'placeholder'
        when victim_name ~ '\\{\\{.*\\}\\}|<%=|\\$\\{' then 'placeholder'
        when victim_name ~~ '%***%' then 'redacted'
        when victim_name ~ '\\?\\?' then 'redacted'
        else 'ok'
      end
    ) stored
  );
  create unique index uq_incidents_actor_victim_date
    on incidents (actor_id, victim_name, discovered_date) nulls not distinct;
  alter table incidents enable row level security;
  create policy public_read on incidents for select to anon, authenticated
    using (data_quality <> 'placeholder');
  create view incidents_shown as select id, victim_name from incidents where data_quality = 'ok';
`

const DATALEAK = '895cd165-05c1-44a4-ad25-90dcda9f7bf4'
const ABOUT = (p) => `<h2 id="about">ABOUT</h2>\n<p>${p}`

function seedIncidents(db) {
  return db.query(
    `insert into incidents (id, actor_id, victim_name, discovered_date, source, raw_data) values
       ('7a5d9ddb-8a70-43f2-a351-ec5038664a07', $1, $2, '2026-07-08', 'ransomlook', '{"post_title":"x"}'),
       ('0fdd93be-f4f5-44d2-ac00-8ef0950e7f72', $1, $3, '2026-07-08', 'ransomlook', '{}'),
       ('21d72f12-7a37-4c57-a4f2-fa361aa670d7', $1, $4, '2026-07-08', 'ransomlook', '{}'),
       ('1238c091-0abd-45da-8ab1-bc542eb607f7', $1, $5, '2026-07-08', 'ransomlook', '{}'),
       ('ea736cff-113a-4b12-a626-8ba6fd113eda', null, 'USA Rice<br />', '2025-03-05', 'ransomwatch', null),
       ('5d359240-03ab-44eb-8daa-a779a2125cee', $1, $6, '2026-07-08', 'ransomlook', '{}'),
       (gen_random_uuid(), null, 'Christies Auction House - christies.com<Auction>', '2024-05-01', 'ransomwatch', null)`,
    [
      DATALEAK,
      ABOUT('Nissin Foods Do Brasil Ltda is a company that operates in the'),
      ABOUT('SCHERDELWiesauplast ist ein international tätiger Hersteller '),
      ABOUT('The Beacon Insurance Company Limited is ranked as the fourth '),
      ABOUT('The RKW Group is an independent private company headquartered'),
      '<h2 id="about">ABOUT</h2>\n<ul>\n<li></li>\n</ul>\n<h2 id="target">TARGET</h2>\n<p>ni*usa.com</',
    ]
  )
}

describe('migration 170', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({ schema: INCIDENTS })
    await seedIncidents(db)
    await db.exec(migration('170_victim_names_from_markup.sql'))
  }, 60_000)
  afterAll(() => db?.close())

  it('lifts the five names a person read from the posts', async () => {
    const { rows } = await db.query(
      `select victim_name, data_quality from incidents
        where id <> '5d359240-03ab-44eb-8daa-a779a2125cee' and victim_name !~ '<'
        order by victim_name`
    )
    expect(rows).toEqual([
      { victim_name: 'Nissin Foods Do Brasil Ltda', data_quality: 'ok' },
      { victim_name: 'SCHERDELWiesauplast', data_quality: 'ok' },
      { victim_name: 'The Beacon Insurance Company Limited', data_quality: 'ok' },
      { victim_name: 'The RKW Group', data_quality: 'ok' },
      { victim_name: 'USA Rice', data_quality: 'ok' },
    ])
  })

  it('keeps what the source sent, alongside what was already in raw_data', async () => {
    const { rows } = await db.query(
      `select raw_data from incidents where id = '7a5d9ddb-8a70-43f2-a351-ec5038664a07'`
    )
    expect(rows[0].raw_data.post_title).toBe('x')
    expect(rows[0].raw_data.victim_name_as_received).toMatch(/^<h2 id="about">ABOUT<\/h2>/)
    const usa = await db.query(
      `select raw_data from incidents where id = 'ea736cff-113a-4b12-a626-8ba6fd113eda'`
    )
    expect(usa.rows[0].raw_data).toEqual({ victim_name_as_received: 'USA Rice<br />' })
  })

  it('reads the empty description block as a placeholder, and nothing else changes class', async () => {
    const { rows } = await db.query(
      `select victim_name, data_quality from incidents where victim_name ~ '<' order by victim_name`
    )
    expect(rows.map((r) => r.data_quality).sort()).toEqual(['ok', 'placeholder'])
    const shown = await db.query(
      `select count(*)::int as n from incidents_shown where id = '5d359240-03ab-44eb-8daa-a779a2125cee'`
    )
    expect(shown.rows[0].n).toBe(0)
  })

  it('keeps every earlier placeholder and redaction rule', async () => {
    await db.exec(`
      insert into incidents (victim_name) values
        ('Company ID : bgsedf'), ('{{7*7}} probe'), ('ac***e corp'), ('??? ltd'), ('Plain Name');
    `)
    const { rows } = await db.query(
      `select victim_name, data_quality from incidents
        where victim_name in ('Company ID : bgsedf', '{{7*7}} probe', 'ac***e corp', '??? ltd', 'Plain Name')
        order by victim_name`
    )
    expect(Object.fromEntries(rows.map((r) => [r.victim_name, r.data_quality]))).toEqual({
      'Company ID : bgsedf': 'placeholder',
      '{{7*7}} probe': 'placeholder',
      'ac***e corp': 'redacted',
      '??? ltd': 'redacted',
      'Plain Name': 'ok',
    })
  })

  it('queues the other markup instead of fixing it', async () => {
    const { rows } = await db.query(
      `select status, details->>'question' as q from data_quality_findings where check_name = 'victim_name_markup'`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('open')
    const christies = await db.query(
      `select count(*)::int as n from incidents where victim_name = 'Christies Auction House - christies.com<Auction>'`
    )
    expect(christies.rows[0].n).toBe(1)
  })

  it('refuses when a row is no longer as the finding saw it', async () => {
    const other = await freshDatabase({ schema: INCIDENTS })
    await seedIncidents(other)
    await other.exec(
      `update incidents set victim_name = 'USA Rice' where source = 'ransomwatch' and victim_name like 'USA%'`
    )
    await expect(other.exec(migration('170_victim_names_from_markup.sql'))).rejects.toThrow(
      /expected the five rows/
    )
    await other.close()
  }, 60_000)

  it('refuses rather than duplicate an incident already held for the group and day', async () => {
    const other = await freshDatabase({ schema: INCIDENTS })
    await seedIncidents(other)
    await other.query(
      `insert into incidents (actor_id, victim_name, discovered_date) values ($1, 'The RKW Group', '2026-07-08')`,
      [DATALEAK]
    )
    await expect(other.exec(migration('170_victim_names_from_markup.sql'))).rejects.toThrow(
      /lifted 4 of 5/
    )
    await other.close()
  }, 60_000)
})
