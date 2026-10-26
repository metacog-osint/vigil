/**
 * The last two tests are the point: migrations 147 and 152 shipped
 * SECURITY DEFINER writers that signed-in users, and in 152's case anyone with
 * the browser's anon key, could call. Both were reviewed and merged. If the
 * checker stops flagging those two files, it has stopped doing its job.
 *
 * The rest cover the 30 October 2026 change: a public table or view created
 * without a GRANT is invisible to supabase-js, and a page reading it renders
 * an empty state instead of an error.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findGrantProblems, checkMigrations, FIRST_ENFORCED } from '../check-migration-grants.mjs'

const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations'
)

describe('tables and views', () => {
  it('flags a public table created with no grant', () => {
    expect(
      findGrantProblems('create table public.widgets (id uuid primary key);').ungranted
    ).toEqual(['widgets'])
  })

  it('accepts a grant naming the table, qualified or not, in a list', () => {
    const sql = `
      create table if not exists public.a (id int);
      create table b (id int);
      grant select on public.a, b to anon, authenticated;`
    expect(findGrantProblems(sql).ungranted).toEqual([])
  })

  it('accepts GRANT ... ON TABLE', () => {
    const sql = 'create table public.c (id int); grant select on table public.c to service_role;'
    expect(findGrantProblems(sql).ungranted).toEqual([])
  })

  it('treats views and materialized views as tables, as Postgres default privileges do', () => {
    const sql = `
      create or replace view public.v with (security_invoker = true) as select 1;
      drop materialized view if exists public.mv;
      create materialized view public.mv as select 1;`
    expect(findGrantProblems(sql).ungranted).toEqual(['v', 'mv'])
  })

  it('ignores other schemas, temp tables, comments and function bodies', () => {
    const sql = `
      -- create table public.in_a_comment (id int);
      create table private.elsewhere (id int);
      create temp table scratch (id int);
      create function public.f() returns void language plpgsql as $fn$
      begin
        create table public.inside_a_body (id int);
      end;
      $fn$;`
    expect(findGrantProblems(sql).ungranted).toEqual([])
  })

  it('accepts a written exception that names the object', () => {
    const sql = `
      -- no-grants: internal_only - written only by apply_x() as its owner
      create table public.internal_only (id int);`
    expect(findGrantProblems(sql).ungranted).toEqual([])
  })
})

describe('SECURITY DEFINER functions', () => {
  const definer = `
    create or replace function public.apply_things(p_rows jsonb)
    returns jsonb language plpgsql security definer set search_path = public as $fn$
    begin return p_rows; end;
    $fn$;`

  it('flags one revoked from nobody', () => {
    expect(findGrantProblems(definer).openDefiners).toEqual([
      { name: 'apply_things', missing: ['public', 'anon', 'authenticated'] },
    ])
  })

  it('flags one revoked from public and anon but not authenticated', () => {
    // Supabase grants authenticated by name, so revoking from public does not
    // remove it. This is the 145 and 147 pattern.
    const sql = `${definer}
      revoke execute on function public.apply_things(jsonb) from public;
      revoke execute on function public.apply_things(jsonb) from anon;`
    expect(findGrantProblems(sql).openDefiners).toEqual([
      { name: 'apply_things', missing: ['authenticated'] },
    ])
  })

  it('accepts revoke from all three, then a grant to the intended caller', () => {
    const sql = `${definer}
      revoke execute on function public.apply_things(jsonb) from public, anon, authenticated;
      grant execute on function public.apply_things(jsonb) to service_role;`
    expect(findGrantProblems(sql).openDefiners).toEqual([])
  })

  it('leaves SECURITY INVOKER functions alone', () => {
    const sql = definer.replace('security definer', 'security invoker')
    expect(findGrantProblems(sql).openDefiners).toEqual([])
  })
})

describe('the migrations that shipped open doors', () => {
  const read = (file) => readFileSync(join(migrations, file), 'utf8')

  it('would have caught 152: apply_ransom_payments open to anon', () => {
    const { openDefiners } = findGrantProblems(read('152_ransomwhere_archive.sql'))
    expect(openDefiners).toContainEqual({
      name: 'apply_ransom_payments',
      missing: ['public', 'anon', 'authenticated'],
    })
  })

  it('would have caught 147: apply_regulatory_advisories open to signed-in users', () => {
    const { openDefiners } = findGrantProblems(read('147_fincen_advisories.sql'))
    expect(openDefiners).toContainEqual({
      name: 'apply_regulatory_advisories',
      missing: ['authenticated'],
    })
  })
})

describe(`every migration from ${FIRST_ENFORCED} on`, () => {
  it('grants what it creates and closes what it runs as owner', () => {
    expect(checkMigrations(migrations)).toEqual([])
  })
})
