// @vitest-environment node
/**
 * Migrations 181-186 (retention, 18 Nov 2026): nothing Vigil overwrites or deletes is lost.
 * Each describe block builds the few tables it needs, loads the real migration file, and checks the data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const FEED_EXPECTATIONS = `
  create table feed_expectations (
    feed_id text primary key, expected_interval_minutes int, critical boolean, note text
  );
`

describe('181: daily actor trend snapshot', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({
      schema:
        FEED_EXPECTATIONS +
        `
        create table threat_actors (
          id uuid primary key default gen_random_uuid(), name text, status text,
          trend_status text, incidents_7d int, incident_velocity numeric, last_seen timestamptz
        );
        create table incidents (id uuid primary key default gen_random_uuid(), actor_id uuid, discovered_date date);
        create table actor_trend_history (
          id uuid primary key default gen_random_uuid(),
          actor_id uuid not null references threat_actors(id) on delete cascade,
          recorded_date date not null default current_date,
          trend_status text, incidents_7d int default 0, incidents_30d int default 0,
          incident_velocity numeric default 0, rank_position int,
          unique (actor_id, recorded_date)
        );
        insert into threat_actors (name, status, trend_status, incidents_7d, last_seen) values
          ('alpha', 'active', 'STABLE', 5, now()),
          ('beta', 'defunct', 'ESCALATING', 9, now() - interval '200 days'),
          ('gamma', 'active', 'STABLE', 1, now() - interval '200 days');
        insert into incidents (actor_id, discovered_date)
          select id, current_date - 3 from threat_actors where name = 'alpha';
      `,
      migrations: ['181_actor_trend_snapshot_daily.sql'],
    })
  }, 60_000)
  afterAll(async () => db?.close())

  it('snapshots active and escalating actors, with status', async () => {
    const r = await db.query('select public.snapshot_actor_trends() as n')
    expect(r.rows[0].n).toBe(2)
    const rows = (
      await db.query(
        `select a.name, h.actor_status, h.incidents_30d, h.rank_position
         from actor_trend_history h join threat_actors a on a.id = h.actor_id order by a.name`
      )
    ).rows
    expect(rows).toEqual([
      { name: 'alpha', actor_status: 'active', incidents_30d: 1, rank_position: 2 },
      { name: 'beta', actor_status: 'defunct', incidents_30d: 0, rank_position: 1 },
    ])
  })

  it('is idempotent per day: a second call refreshes rows and adds none', async () => {
    await db.query(`update threat_actors set incidents_7d = 7 where name = 'alpha'`)
    await db.query('select public.snapshot_actor_trends()')
    const count = (await db.query('select count(*)::int as n from actor_trend_history')).rows[0].n
    expect(count).toBe(2)
    const alpha = (
      await db.query(
        `select h.incidents_7d from actor_trend_history h join threat_actors a on a.id = h.actor_id where a.name = 'alpha'`
      )
    ).rows[0]
    expect(alpha.incidents_7d).toBe(7)
  })

  it('is closed to the public roles and watched', async () => {
    const can = async (role) =>
      (await db.query(`select has_function_privilege($1, 'public.snapshot_actor_trends()', 'execute') as ok`, [role]))
        .rows[0].ok
    expect(await can('anon')).toBe(false)
    expect(await can('authenticated')).toBe(false)
    expect(await can('service_role')).toBe(true)
    const exp = await db.query(`select expected_interval_minutes, critical from feed_expectations where feed_id = 'actor-trend-snapshot'`)
    expect(exp.rows).toEqual([{ expected_interval_minutes: 1440, critical: false }])
  })
})

describe('182 and 183: vulnerability history (with 180 applied), EPSS series', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({
      schema: `
        create table vulnerabilities (
          cve_id text primary key, cvss_score numeric, description text, source text,
          kev_due_date date, metadata jsonb default '{}', updated_at timestamptz default now(),
          epss_score numeric, epss_percentile numeric, epss_date date, priority_score numeric,
          kev_date date, kev_date_added date, is_kev boolean, exploited_in_wild boolean,
          ransomware_campaign_use boolean, ransomware_use boolean, title text
        );
        create table vulncheck_retired_rows (cve_id text primary key, row jsonb);
        create function record_finding(a text, b text, c text, d text, e jsonb)
          returns void language sql as 'select';
      `,
      migrations: ['180_kev_catalog_reconcile.sql', '182_vulnerability_history.sql', '183_epss_history.sql'],
    })
  }, 60_000)
  afterAll(async () => db?.close())

  it('leaves removed metadata keys removed, and keeps their old value in history', async () => {
    await db.query(
      `insert into vulnerabilities (cve_id, source, metadata, description)
       values ('CVE-2026-0001', 'cisa-kev', '{"title":"T","required_action":"patch"}', 'd1')`
    )
    await db.query(`update vulnerabilities set metadata = metadata - 'title' where cve_id = 'CVE-2026-0001'`)
    const m = (await db.query(`select metadata from vulnerabilities where cve_id = 'CVE-2026-0001'`)).rows[0].metadata
    expect(m).toEqual({ required_action: 'patch' })
    const h = (await db.query(`select old_values from vulnerability_history where cve_id = 'CVE-2026-0001'`)).rows
    expect(h).toHaveLength(1)
    expect(h[0].old_values.metadata).toEqual({ title: 'T', required_action: 'patch' })
  })

  it('clear_kev_flags from 180 still works, with one history row per cleared CVE', async () => {
    await db.query(
      `insert into vulnerabilities (cve_id, source, is_kev, kev_date, kev_due_date, metadata)
       values ('CVE-2026-0010', 'cisa-kev', true, '2026-08-21', '2026-08-24', '{"title":"X"}')`
    )
    const n = (await db.query(`select public.clear_kev_flags(array['CVE-2026-0010'], 'test', 'v1') as n`)).rows[0].n
    expect(n).toBe(1)
    const v = (await db.query(`select is_kev, kev_date from vulnerabilities where cve_id = 'CVE-2026-0010'`)).rows[0]
    expect(v).toEqual({ is_kev: false, kev_date: null })
    const h = (await db.query(`select old_values from vulnerability_history where cve_id = 'CVE-2026-0010'`)).rows
    expect(h).toHaveLength(1)
    expect(h[0].old_values.is_kev).toBe(true)
    expect((await db.query(`select count(*)::int n from kev_unlisted_rows`)).rows[0].n).toBe(1)
  })

  it('the VulnCheck-style strip update in 180 style also succeeds with history', async () => {
    await db.query(`insert into vulnerabilities (cve_id, metadata) values ('CVE-2026-0011', '{"xdb":1,"title":"Y"}')`)
    await db.query(
      `update vulnerabilities set title = null, metadata = metadata - 'title' - 'xdb' where cve_id = 'CVE-2026-0011'`
    )
    const h = (await db.query(`select old_values from vulnerability_history where cve_id = 'CVE-2026-0011'`)).rows
    expect(h).toHaveLength(1)
    expect(h[0].old_values.metadata).toEqual({ xdb: 1, title: 'Y' })
  })

  it('stores the old values of changed fields only, and nothing when nothing changed', async () => {
    const before = (await db.query('select count(*)::int as n from vulnerability_history')).rows[0].n
    // identical rewrite, plus churn columns: no history row
    await db.query(
      `update vulnerabilities set source = 'cisa-kev', description = 'd1', updated_at = now(), priority_score = 4,
              epss_score = 0.2 where cve_id = 'CVE-2026-0001'`
    )
    expect((await db.query('select count(*)::int as n from vulnerability_history')).rows[0].n).toBe(before)

    await db.query(`update vulnerabilities set cvss_score = 9.8, description = 'd2' where cve_id = 'CVE-2026-0001'`)
    const rows = (
      await db.query(`select cve_id, source, old_values from vulnerability_history order by id`)
    ).rows
    const last = rows[rows.length - 1]
    expect(last.cve_id).toBe('CVE-2026-0001')
    expect(rows.filter((r) => r.cve_id === 'CVE-2026-0001')).toHaveLength(2)
    expect(last.old_values).toEqual({ cvss_score: null, description: 'd1' })
    // the feed switch kept the old source and old metadata
  })

  it('keeps every EPSS score the function applies, and is repeatable', async () => {
    await db.query(`insert into vulnerabilities (cve_id) values ('CVE-2026-0002'), ('CVE-2026-0003')`)
    const day = (d, a, b) =>
      JSON.stringify([
        { cve: 'CVE-2026-0002', epss: a, percentile: 0.5, date: d },
        { cve: 'CVE-2026-0003', epss: b, percentile: 0.6, date: d },
        { cve: 'CVE-9999-0000', epss: 0.9, percentile: 0.9, date: d },
      ])
    const apply = async (json) =>
      (await db.query('select public.apply_epss_scores($1::jsonb) as r', [json])).rows[0].r
    expect(await apply(day('2026-11-01', 0.1, 0.2))).toEqual({ received: 3, applied: 2 })
    expect(await apply(day('2026-11-01', 0.1, 0.2))).toEqual({ received: 3, applied: 0 })
    await apply(day('2026-11-02', 0.3, 0.2))
    await apply(day('2026-11-03', 0.4, 0.25))
    // an older score never replaces a newer one, and is not recorded
    await apply(day('2026-10-01', 0.99, 0.99))

    const series = (
      await db.query(
        `select score_date::text d, score::float s from epss_history where cve_id = 'CVE-2026-0002' order by score_date`
      )
    ).rows
    expect(series).toEqual([
      { d: '2026-11-01', s: 0.1 },
      { d: '2026-11-02', s: 0.3 },
      { d: '2026-11-03', s: 0.4 },
    ])
    const cur = (await db.query(`select epss_score::float s, epss_date::text d from vulnerabilities where cve_id = 'CVE-2026-0002'`)).rows[0]
    expect(cur).toEqual({ s: 0.4, d: '2026-11-03' })
    // no history for a CVE Vigil does not hold
    expect((await db.query(`select count(*)::int n from epss_history where cve_id = 'CVE-9999-0000'`)).rows[0].n).toBe(0)
  })

  it('keeps the replaced score the first time, from before the table existed', async () => {
    await db.query(
      `insert into vulnerabilities (cve_id, epss_score, epss_percentile, epss_date) values ('CVE-2026-0004', 0.05, 0.1, '2026-09-20')`
    )
    await db.query(`select public.apply_epss_scores('[{"cve":"CVE-2026-0004","epss":0.07,"percentile":0.2,"date":"2026-11-02"}]'::jsonb)`)
    const rows = (await db.query(`select score_date::text d, score::float s from epss_history where cve_id = 'CVE-2026-0004' order by score_date`)).rows
    expect(rows).toEqual([
      { d: '2026-09-20', s: 0.05 },
      { d: '2026-11-02', s: 0.07 },
    ])
  })

  it('closes the new tables to the public roles', async () => {
    for (const t of ['vulnerability_history', 'epss_history']) {
      for (const role of ['anon', 'authenticated']) {
        const r = await db.query(`select has_table_privilege($1, $2, 'select') as ok`, [role, `public.${t}`])
        expect(r.rows[0].ok).toBe(false)
      }
    }
  })
})

describe('184: cisa_ssvc_history', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({
      schema: `
        create table cisa_ssvc (
          cve_id text primary key, exploitation text not null, automatable text, technical_impact text,
          ssvc_version text, assessed_at timestamptz, adp_updated_at timestamptz, kev_date_added date,
          source_commit text not null, fetched_at timestamptz not null default now()
        );
        insert into cisa_ssvc (cve_id, exploitation, automatable, technical_impact, source_commit)
          values ('CVE-2026-1', 'poc', 'no', 'partial', 'aaa');
      `,
      migrations: ['184_cisa_ssvc_history.sql'],
    })
  }, 60_000)
  afterAll(async () => db?.close())

  it('inserts the old row only when a decision point changes', async () => {
    // same decision, new commit and fetch time: nothing
    await db.query(`update cisa_ssvc set source_commit = 'bbb', fetched_at = now() where cve_id = 'CVE-2026-1'`)
    expect((await db.query('select count(*)::int n from cisa_ssvc_history')).rows[0].n).toBe(0)
    // poc -> active
    await db.query(`update cisa_ssvc set exploitation = 'active', source_commit = 'ccc' where cve_id = 'CVE-2026-1'`)
    // active -> none
    await db.query(`update cisa_ssvc set exploitation = 'none', source_commit = 'ddd' where cve_id = 'CVE-2026-1'`)
    const rows = (await db.query('select exploitation, source_commit from cisa_ssvc_history order by id')).rows
    expect(rows).toEqual([
      { exploitation: 'poc', source_commit: 'bbb' },
      { exploitation: 'active', source_commit: 'ccc' },
    ])
  })
})

describe('185: trim_entity_changelog archives before it deletes', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({
      schema: `
        create table entity_changelog (
          id uuid default gen_random_uuid() primary key, entity_type text not null, entity_id uuid not null,
          entity_identifier text, change_type text not null, changed_fields jsonb not null default '{}',
          changed_by uuid, source text, created_at timestamptz default now()
        );
        insert into entity_changelog (entity_type, entity_id, entity_identifier, change_type, changed_fields, created_at)
          select 'threat_actor', gen_random_uuid(), 'old' || g, 'updated', jsonb_build_object('status', jsonb_build_object('old','a','new','b')),
                 now() - interval '200 days' + (g || ' minutes')::interval
          from generate_series(1, 5) g;
        insert into entity_changelog (entity_type, entity_id, entity_identifier, change_type)
          values ('threat_actor', gen_random_uuid(), 'recent', 'updated');
      `,
      migrations: ['185_changelog_archive_before_trim.sql'],
    })
  }, 60_000)
  afterAll(async () => db?.close())

  it('moves old rows to archive.entity_changelog and keeps the recent one', async () => {
    const r = (await db.query('select public.trim_entity_changelog(3) as r')).rows[0].r
    expect(r.changelog_rows_trimmed).toBe(3)
    expect((await db.query('select count(*)::int n from archive.entity_changelog')).rows[0].n).toBe(3)
    expect((await db.query('select count(*)::int n from entity_changelog')).rows[0].n).toBe(3)

    await db.query('select public.trim_entity_changelog()')
    const archived = (await db.query('select entity_identifier, changed_fields from archive.entity_changelog order by created_at')).rows
    expect(archived.map((x) => x.entity_identifier)).toEqual(['old1', 'old2', 'old3', 'old4', 'old5'])
    expect(archived[0].changed_fields).toEqual({ status: { old: 'a', new: 'b' } })
    const left = (await db.query('select entity_identifier from entity_changelog')).rows
    expect(left).toEqual([{ entity_identifier: 'recent' }])
    // a run with nothing old left changes nothing
    const again = (await db.query('select public.trim_entity_changelog() as r')).rows[0].r
    expect(again.changelog_rows_trimmed).toBe(0)
    expect((await db.query('select count(*)::int n from archive.entity_changelog')).rows[0].n).toBe(5)
  })
})

describe('186: merge_actor keeps the merged actor\'s history', () => {
  let db
  const A = '00000000-0000-0000-0000-00000000000a'
  const B = '00000000-0000-0000-0000-00000000000b'
  beforeAll(async () => {
    db = await freshDatabase({
      schema: `
        create schema archive;
        create table threat_actors (
          id uuid primary key, name text, aliases text[], ttps text[], target_sectors text[], target_countries text[],
          first_seen timestamptz, last_seen timestamptz, description text, actor_type text
        );
        create table archive.threat_actors_merged_20260919 (like threat_actors, canonical_id uuid);
        create table incidents (
          id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text, discovered_date date
        );
        create table archive.incidents_superseded (like incidents, keep_id uuid, superseded_at timestamptz);
        create table actor_techniques (actor_id uuid, technique_id text, primary key (actor_id, technique_id));
        create table actor_vulnerabilities (actor_id uuid, cve_id text, confidence text, source text, first_seen date, primary key (actor_id, cve_id));
        create table actor_tools (actor_id uuid, tool_name text, category text, source text, first_seen date, last_seen date, primary key (actor_id, tool_name));
        create table actor_sites (actor_id uuid, fqdn text, enabled bool, available bool, source text, first_seen date, last_seen date, primary key (actor_id, fqdn));
        create table actor_trend_history (
          id uuid primary key default gen_random_uuid(), actor_id uuid not null references threat_actors(id) on delete cascade,
          recorded_date date not null, trend_status text, unique (actor_id, recorded_date));
        create table actor_takedowns (
          id uuid primary key default gen_random_uuid(), actor_id uuid not null references threat_actors(id) on delete cascade,
          event_date date not null, source_url text not null, summary text, unique (actor_id, event_date, source_url));
        create table actor_sanctions (
          actor_id uuid not null references threat_actors(id) on delete cascade, entity_uid text not null,
          entity_name text, primary key (actor_id, entity_uid));
        create table actor_activity_snapshots (
          id uuid primary key default gen_random_uuid(), actor_id uuid references threat_actors(id) on delete cascade,
          snapshot_date date, status text, unique (actor_id, snapshot_date));
        create function record_finding(a text, b text, c text, d text, e jsonb) returns void language sql as 'select';
        insert into threat_actors (id, name) values ('${A}', 'Canon'), ('${B}', 'Dup');
        insert into actor_trend_history (actor_id, recorded_date, trend_status) values
          ('${A}', '2026-05-01', 'canon-day1'), ('${B}', '2026-05-01', 'dup-same-day'), ('${B}', '2026-05-02', 'dup-day2');
        insert into actor_takedowns (actor_id, event_date, source_url, summary) values
          ('${A}', '2026-03-01', 'u1', 'canon'), ('${B}', '2026-03-01', 'u1', 'dup same'), ('${B}', '2026-04-01', 'u2', 'dup other');
        insert into actor_sanctions (actor_id, entity_uid, entity_name) values ('${B}', 'e1', 'Dup Entity');
        insert into actor_activity_snapshots (actor_id, snapshot_date, status) values ('${B}', '2026-05-05', 'active');
      `,
      migrations: ['186_merge_actor_keeps_history.sql'],
    })
  }, 60_000)
  afterAll(async () => db?.close())

  it('re-points non-colliding history rows and archives colliding ones', async () => {
    await db.query(`select public.merge_actor('${B}', '${A}', 'test')`)
    expect((await db.query(`select count(*)::int n from threat_actors where id = '${B}'`)).rows[0].n).toBe(0)

    const trend = (await db.query(`select recorded_date::text d, trend_status from actor_trend_history where actor_id = '${A}' order by 1`)).rows
    expect(trend).toEqual([
      { d: '2026-05-01', trend_status: 'canon-day1' },
      { d: '2026-05-02', trend_status: 'dup-day2' },
    ])
    const take = (await db.query(`select summary from actor_takedowns where actor_id = '${A}' order by summary`)).rows
    expect(take.map((r) => r.summary)).toEqual(['canon', 'dup other'])
    expect((await db.query(`select entity_name from actor_sanctions where actor_id = '${A}'`)).rows).toEqual([{ entity_name: 'Dup Entity' }])
    expect((await db.query(`select status from actor_activity_snapshots where actor_id = '${A}'`)).rows).toEqual([{ status: 'active' }])

    const arch = (await db.query(`select source_table, row_data->>'trend_status' ts, row_data->>'summary' sm from archive.actor_merge_children order by source_table`)).rows
    expect(arch).toEqual([
      { source_table: 'actor_takedowns', ts: null, sm: 'dup same' },
      { source_table: 'actor_trend_history', ts: 'dup-same-day', sm: null },
    ])
  })
})
