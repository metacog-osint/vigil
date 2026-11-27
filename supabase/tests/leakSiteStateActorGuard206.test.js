// @vitest-environment node
/**
 * A leak-site group is not merged into a state actor by name alone (migration 206).
 *
 * RansomLook's leak site "inception" resolved to MITRE G0100 "Inception", an
 * espionage group, by name. 206 sends such a group to its own record and queues
 * the question, keeps ransomware groups MITRE tracks itself (Akira) where they
 * are, and moves the "inception" claims off G0100 with each old actor id kept.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const G0100 = '46787561-bbaa-44dd-8ebb-77c79d809062'
const AKIRA = 'b2077d7c-4a06-4892-ba4f-551dea001add'
const TTPS = ['T1005', 'T1027.013', 'T1566.001']

// The columns 206 reads and writes, and the helpers it calls, as production has them.
const SCHEMA = `
  create schema archive;
  create table threat_actors (
    id uuid primary key default gen_random_uuid(),
    name text not null unique, aliases text[] default '{}', actor_type text, status text,
    source text, description text, first_seen date, last_seen date,
    target_sectors text[] default '{}', target_countries text[] default '{}',
    ttps text[] default '{}', metadata jsonb default '{}', created_at timestamptz default now(),
    trend_status text default 'STABLE', incidents_7d int default 0, incidents_prev_7d int default 0,
    incident_velocity numeric default 0, surge boolean default false, surge_claims_7d int,
    origin_country text, origin_confidence int, origin_source text
  );
  create table archive.threat_actors_merged_20260919 (name text, canonical_id uuid);
  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id), victim_name text, discovered_date date, source text,
    unique nulls not distinct (actor_id, victim_name, discovered_date)
  );
  create table actor_sites (actor_id uuid references threat_actors (id), fqdn text, enabled boolean,
    available boolean, source text, first_seen date, last_seen date, primary key (actor_id, fqdn));
  create table actor_trend_history (id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id), recorded_date date, trend_status text,
    unique (actor_id, recorded_date));
  create table techniques (id text primary key);
  create table actor_techniques (actor_id uuid, technique_id text, confidence text, source text,
    notes text, first_seen date, last_seen date, primary key (actor_id, technique_id));
  create table actor_tools (actor_id uuid, tool_name text, category text, source text, last_seen date,
    primary key (actor_id, tool_name, category));
  create table entity_changelog (id uuid primary key default gen_random_uuid(), entity_id uuid,
    changed_fields jsonb, created_at timestamptz default now());
  create table data_quality_findings (id bigint generated always as identity, check_name text,
    subject text, severity text, status text, details jsonb, first_seen timestamptz default now(),
    last_seen timestamptz default now(), resolved_at timestamptz, unique (check_name, subject));

  create function actor_key(n text) returns text language sql immutable as
    $$ select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g') $$;
  create function canonical_rank(a threat_actors) returns bigint language sql stable as $$
    select (case when a.source = 'mitre-attack' then 0 when a.source in ('misp-galaxy', 'misp_galaxy')
            then 1 else 2 end)::bigint * 10000000
           - (select count(*) from incidents i where i.actor_id = a.id) $$;
  create function jsonb_text_array(j jsonb) returns text[] language sql immutable as $$
    select case when jsonb_typeof(j) = 'array'
           then array(select x from jsonb_array_elements_text(j) x where x is not null and x <> '')
           else '{}'::text[] end $$;
  create function safe_date(t text) returns date language plpgsql immutable as $$
    begin if t is null or t = '' then return null; end if; return left(t, 10)::date;
    exception when others then return null; end $$;
  create function record_finding(p_check text, p_subject text, p_severity text, p_status text,
    p_details jsonb) returns void language sql as $$
    insert into data_quality_findings (check_name, subject, severity, status, details)
    values (p_check, p_subject, p_severity, p_status, p_details)
    on conflict (check_name, subject) do update set last_seen = now(), details = excluded.details $$;

  -- G0100 as it stood on 27 Nov 2026, with the leak site's claims on it
  insert into threat_actors (id, name, aliases, actor_type, source, first_seen, last_seen, ttps,
                             trend_status, incidents_7d, metadata)
  values ('${G0100}', 'Inception', '{Cloud Atlas,inception,Inception Framework}', 'apt',
          'mitre-attack', '2026-11-17', '2026-11-26', '{}', 'STABLE', 7,
          '{"mitre_id": "G0100"}');
  insert into entity_changelog (entity_id, changed_fields, created_at) values
    ('${G0100}', '{"ttps": {"old": ${JSON.stringify(TTPS)}, "new": []}}', '2026-11-18T04:45:45Z');
  insert into incidents (actor_id, victim_name, discovered_date, source) values
    ('${G0100}', 'victim one', '2026-11-17', 'ransomlook'),
    ('${G0100}', 'victim two', '2026-11-26', 'ransomlook');
  insert into actor_sites (actor_id, fqdn, enabled, available, source) values
    ('${G0100}', 'incpt.onion', true, true, 'ransomware.live');
  insert into actor_trend_history (actor_id, recorded_date, trend_status) values
    ('${G0100}', '2026-11-21', 'STABLE'), ('${G0100}', '2026-11-27', 'STABLE');

  -- A ransomware group MITRE tracks itself, typed apt, already holding claims
  insert into threat_actors (id, name, actor_type, source) values ('${AKIRA}', 'Akira', 'apt', 'mitre-attack');
  insert into incidents (actor_id, victim_name, discovered_date, source) values
    ('${AKIRA}', 'akira victim', '2026-11-20', 'ransomlook');

  -- A state actor with no leak-site history
  insert into threat_actors (name, actor_type, source) values ('Sandworm Team', 'apt', 'mitre-attack');
  insert into techniques values ('T1486');
`

let db
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const upsert = async (records) =>
  (await one(`select upsert_actors($1::jsonb) r`, [JSON.stringify(records)])).r
const leak = (name) => ({ name, actor_type: 'ransomware', status: 'active', source: 'ransomlook',
  first_seen: '2026-11-27' })

beforeAll(async () => {
  db = await freshDatabase({ schema: SCHEMA, migrations: ['206_leak_site_state_actor_guard.sql'] })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('the one-off split of G0100', () => {
  it('moves the claims, the site and the trend rows to a leak-site record', async () => {
    const lk = await one(`select * from threat_actors where metadata->>'leak_site_key' = 'inception'`)
    expect(lk).toMatchObject({ name: 'inception (leak site)', actor_type: 'ransomware',
      source: 'ransomlook', aliases: ['inception'] })
    expect(lk.first_seen.toISOString().slice(0, 10)).toBe('2026-11-17')
    expect(lk.last_seen.toISOString().slice(0, 10)).toBe('2026-11-26')
    for (const t of ['incidents', 'actor_sites', 'actor_trend_history']) {
      const { n } = await one(`select count(*)::int n from ${t} where actor_id = $1`, [G0100])
      expect(n, t).toBe(0)
    }
    const { n } = await one(`select count(*)::int n from incidents where actor_id = $1`, [lk.id])
    expect(n).toBe(2)
  })

  it('keeps every moved row and the replaced G0100 values in the archive', async () => {
    const { rows } = await db.query(
      `select table_name, count(*)::int n, bool_and(old_actor_id = $1) old
       from archive.actor_split_moves group by 1 order by 1`, [G0100])
    expect(rows).toEqual([
      { table_name: 'actor_sites', n: 1, old: true },
      { table_name: 'actor_trend_history', n: 2, old: true },
      { table_name: 'incidents', n: 2, old: true },
      { table_name: 'threat_actors', n: 1, old: true },
    ])
    const { v } = await one(`select old_values v from archive.actor_split_moves where table_name = 'threat_actors'`)
    expect(v).toMatchObject({ first_seen: '2026-11-17', trend_status: 'STABLE', incidents_7d: 7 })
  })

  it('puts G0100 back to its own sources', async () => {
    const g = await one(`select * from threat_actors where id = $1`, [G0100])
    expect(g).toMatchObject({ actor_type: 'apt', first_seen: null, last_seen: null, trend_status: null,
      incidents_7d: 0, aliases: ['Cloud Atlas', 'Inception Framework'], ttps: TTPS })
  })

  it('queues the collision for a person', async () => {
    const f = await one(`select * from data_quality_findings where check_name = 'leak_site_name_collision'`)
    expect(f).toMatchObject({ subject: 'inception', severity: 'warning', status: 'open' })
    expect(f.details.state_actor_id).toBe(G0100)
  })
})

describe('upsert_actors after 206', () => {
  it('sends the next RansomLook run for "inception" to the leak-site record', async () => {
    const [{ id }] = await upsert([leak('inception')])
    const lk = await one(`select id from threat_actors where metadata->>'leak_site_key' = 'inception'`)
    expect(id).toBe(lk.id)
    const g = await one(`select first_seen, aliases from threat_actors where id = $1`, [G0100])
    expect(g.first_seen).toBeNull()
    expect(g.aliases).not.toContain('inception')
  })

  it('keeps a ransomware group MITRE tracks itself on its record', async () => {
    const [{ id }] = await upsert([leak('akira')])
    expect(id).toBe(AKIRA)
  })

  it('splits a new leak site named like a state actor and records a finding', async () => {
    const st = await one(`select id from threat_actors where name = 'Sandworm Team'`)
    const [{ id }] = await upsert([leak('Sandworm Team')])
    expect(id).not.toBe(st.id)
    const f = await one(
      `select details from data_quality_findings where check_name = 'leak_site_name_collision'
       and subject = 'sandwormteam'`)
    expect(f.details).toMatchObject({ state_actor_id: st.id, leak_site_actor_id: id })
    const [again] = await upsert([leak('Sandworm Team')])
    expect(again.id).toBe(id)
  })

  it('still lets MITRE update its own record by name', async () => {
    const st = await one(`select id from threat_actors where name = 'Sandworm Team'`)
    const [{ id }] = await upsert([{ name: 'Sandworm Team', actor_type: 'apt', source: 'mitre-attack' }])
    expect(id).toBe(st.id)
  })

  it('creates an unknown leak-site group as before', async () => {
    const [{ id }] = await upsert([leak('brand new crew')])
    const a = await one(`select name, actor_type from threat_actors where id = $1`, [id])
    expect(a).toEqual({ name: 'brand new crew', actor_type: 'ransomware' })
  })
})

describe('upsert_group_profiles after 206', () => {
  it('attaches a Ransomware.live profile to the leak-site record, not G0100', async () => {
    const r = await one(`select upsert_group_profiles($1::jsonb) r`, [JSON.stringify([
      { name: 'inception', locations: [{ fqdn: 'incpt2.onion', enabled: true, available: true }],
        ttps: [{ techniques: [{ technique_id: 'T1486' }] }] },
    ])])
    expect(r.r.matched).toBe(1)
    const g = await one(`select ttps from threat_actors where id = $1`, [G0100])
    expect(g.ttps).toEqual(TTPS)
    const { n } = await one(`select count(*)::int n from actor_sites where actor_id = $1`, [G0100])
    expect(n).toBe(0)
  })

  it('splits a profile whose name matches a state actor with no leak-site history', async () => {
    await db.query(`insert into threat_actors (name, actor_type, source) values ('Turla', 'nation-state', 'misp-galaxy')`)
    await one(`select upsert_group_profiles($1::jsonb) r`, [JSON.stringify([
      { name: 'Turla', locations: [{ fqdn: 'turla.onion', enabled: true, available: true }] },
    ])])
    const s = await one(
      `select a.metadata->>'leak_site_key' k from actor_sites s join threat_actors a on a.id = s.actor_id
       where s.fqdn = 'turla.onion'`)
    expect(s.k).toBe('turla')
  })
})
