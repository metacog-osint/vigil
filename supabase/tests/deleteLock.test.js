// @vitest-environment node
/**
 * Migration 195: no function or browser grant can delete Vigil's data without an archive. It removes no rows.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The shape production has before 195: every role holds everything, and the three retention functions exist.
const SCHEMA = `
  create table public.watchlists (id int primary key);
  create table public.incidents (id int primary key);
  create table public.entity_changelog (id int primary key, created_at timestamptz default now());
  create table public.alert_queue (id int primary key, status text, processed_at timestamptz);
  create table public.audit_log (id int primary key, created_at timestamptz default now());
  create table public.iocs (id int primary key, type text, value text, last_seen_at timestamptz,
    constraint iocs_type_value_key unique (type, value));
  create index idx_iocs_type_value on public.iocs (type, value);
  create index idx_iocs_last_seen on public.iocs (last_seen_at desc);
  create index idx_iocs_last_seen_at_desc on public.iocs (last_seen_at desc);
  create view public.incidents_view as select id from public.incidents;
  create materialized view public.incident_counts as select count(*) as n from public.incidents;
  grant all on all tables in schema public to anon, authenticated, service_role;
  insert into public.watchlists values (1);
  insert into public.incidents values (1), (2);
  insert into public.entity_changelog (id) values (1);
  create function public.purge_old_changelog(p_days integer default 365) returns integer language sql as 'select 0';
  create function public.cleanup_old_alerts() returns integer language sql as 'select 0';
  create function public.cleanup_old_audit_logs(retention_days integer default 90) returns integer
    language sql as 'select 0';
`

describe('195 delete lock', () => {
  let db
  const can = async (role, rel, priv) =>
    (await db.query('select has_table_privilege($1, $2, $3) as ok', [role, rel, priv])).rows[0].ok

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['195_delete_lock.sql'] })
  }, 60_000)
  afterAll(() => db?.close())

  it('takes DELETE and TRUNCATE from anon on every table, view and materialized view', async () => {
    for (const rel of ['public.watchlists', 'public.incidents', 'public.incidents_view', 'public.incident_counts']) {
      expect(await can('anon', rel, 'delete')).toBe(false)
      expect(await can('anon', rel, 'truncate')).toBe(false)
    }
  })

  it('leaves signed-in DELETE only where the app deletes, and no TRUNCATE', async () => {
    expect(await can('authenticated', 'public.watchlists', 'delete')).toBe(true)
    expect(await can('authenticated', 'public.incidents', 'delete')).toBe(false)
    expect(await can('authenticated', 'public.watchlists', 'truncate')).toBe(false)
  })

  it('leaves reads and the service role alone', async () => {
    expect(await can('anon', 'public.incidents', 'select')).toBe(true)
    expect(await can('authenticated', 'public.incidents', 'select')).toBe(true)
    expect(await can('service_role', 'public.incidents', 'delete')).toBe(true)
    expect(await can('service_role', 'public.incidents', 'truncate')).toBe(true)
  })

  it('drops the three retention functions', async () => {
    const { rows } = await db.query(`select proname from pg_proc
      where proname in ('purge_old_changelog', 'cleanup_old_alerts', 'cleanup_old_audit_logs')`)
    expect(rows).toEqual([])
  })

  it('drops the duplicate indexes and keeps their twins', async () => {
    const { rows } = await db.query(`select indexname from pg_indexes where tablename = 'iocs'
      and indexname like any (array['%type_value%', '%last_seen%']) order by 1`)
    expect(rows.map((r) => r.indexname)).toEqual(['idx_iocs_last_seen_at_desc', 'iocs_type_value_key'])
  })

  it('removes no rows', async () => {
    const n = async (t) => (await db.query(`select count(*)::int as n from public.${t}`)).rows[0].n
    expect([await n('watchlists'), await n('incidents'), await n('entity_changelog')]).toEqual([1, 2, 1])
  })
})
