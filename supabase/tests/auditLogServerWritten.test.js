// @vitest-environment node
/**
 * Migration 171: audit_log is written by the server only. The browser's insert
 * policy goes, anon loses everything, authenticated keeps only SELECT, the
 * service role writes and deletes but never updates, and the two functions that
 * touch the table are closed to the browser roles.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// audit_log as production has it before 171: Supabase's old default grants and
// 121's policies.
const SCHEMA = `
  create table public.audit_log (
    id uuid primary key default gen_random_uuid(),
    user_id text,
    action text,
    created_at timestamptz default now()
  );
  grant all on public.audit_log to anon, authenticated, service_role;
  alter table public.audit_log enable row level security;
  create policy audit_log_select on public.audit_log for select to authenticated
    using (user_id = (auth.uid())::text);
  create policy audit_log_insert on public.audit_log for insert to authenticated
    with check (user_id = (auth.uid())::text);

  create function public.log_audit_event(p_user_id text, p_user_email text, p_action text,
    p_resource_type text, p_resource_id text default null, p_details jsonb default '{}',
    p_ip_address text default null, p_user_agent text default null,
    p_status text default 'success', p_error_message text default null)
  returns uuid language sql security definer as $$
    insert into public.audit_log (user_id, action) values (p_user_id, p_action) returning id
  $$;
  create function public.cleanup_old_audit_logs(retention_days integer default 90)
  returns integer language sql as $$
    with d as (delete from public.audit_log
               where created_at < now() - make_interval(days => retention_days) returning 1)
    select count(*)::int from d
  $$;
  grant execute on function public.cleanup_old_audit_logs(integer) to anon, authenticated;
`

describe('migration 171', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['171_audit_log_server_written.sql'] })
  }, 60_000)
  afterAll(() => db?.close())

  it('drops the browser insert policy and keeps the reader', async () => {
    const { rows } = await db.query(
      `select policyname from pg_policies where tablename = 'audit_log' order by 1`
    )
    expect(rows.map((r) => r.policyname)).toEqual(['audit_log_select'])
  })

  it('leaves each role exactly what it needs on the table', async () => {
    const privs = ['select', 'insert', 'update', 'delete', 'truncate']
    const { rows } = await db.query(
      `select r.role, p.priv, has_table_privilege(r.role, 'public.audit_log', p.priv) as ok
         from unnest(array['anon','authenticated','service_role']) as r(role),
              unnest($1::text[]) as p(priv)`,
      [privs]
    )
    const held = (role) => rows.filter((r) => r.role === role && r.ok).map((r) => r.priv)
    expect(held('anon')).toEqual([])
    expect(held('authenticated')).toEqual(['select'])
    expect(held('service_role')).toEqual(['select', 'insert', 'delete'])
  })

  it('closes both audit functions to the browser roles', async () => {
    const { rows } = await db.query(`
      select p.proname,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth,
             has_function_privilege('service_role', p.oid, 'execute') as svc
        from pg_proc p
       where p.proname in ('log_audit_event', 'cleanup_old_audit_logs')
       order by 1
    `)
    expect(rows).toEqual([
      { proname: 'cleanup_old_audit_logs', anon: false, auth: false, svc: true },
      { proname: 'log_audit_event', anon: false, auth: false, svc: true },
    ])
  })
})
