// @vitest-environment node
/**
 * Migration 198 (ideas#155): only accounts in ruling_reviewers may rule. The
 * three ruling functions keep their bodies under *_unchecked names, closed to
 * every browser role, and the old names check the allowlist first.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const REVIEWER = '11111111-1111-1111-1111-111111111111'
const STRANGER = '22222222-2222-2222-2222-222222222222'

// The three decision tables and functions as production has them before 198,
// cut to what the wrappers touch. rule_vendor_attribution calls record_verdict
// by name, as 157 does.
const SCHEMA = `
  create table auth.users (id uuid primary key, email text);
  insert into auth.users values ('${REVIEWER}', null), ('${STRANGER}', null);

  create table public.finding_verdicts (id serial primary key, finding_id uuid, verdict text, decided_by text not null);
  create table public.vendor_link_decisions (id serial primary key, report_id uuid, decided_by text not null);
  create table public.vendor_attribution_decisions (id serial primary key, report_id uuid, decided_by text not null);
  insert into public.finding_verdicts (finding_id, verdict, decided_by)
    values (gen_random_uuid(), 'confirmed', '${REVIEWER}');

  create function public.record_verdict(p_finding_id uuid, p_verdict text, p_rationale text)
  returns public.finding_verdicts language plpgsql security definer set search_path = public as $$
  declare v_row public.finding_verdicts;
  begin
    if auth.uid() is null then raise exception 'signed-in reviewer' using errcode = '28000'; end if;
    insert into finding_verdicts (finding_id, verdict, decided_by)
      values (p_finding_id, p_verdict, auth.uid()::text) returning * into v_row;
    return v_row;
  end $$;
  grant execute on function public.record_verdict(uuid, text, text) to authenticated, service_role;

  create function public.rule_vendor_actor_link(p_report_id uuid, p_actor_id uuid, p_verdict text, p_rationale text)
  returns public.vendor_link_decisions language plpgsql security definer set search_path = public as $$
  declare v_row public.vendor_link_decisions;
  begin
    insert into vendor_link_decisions (report_id, decided_by) values (p_report_id, auth.uid()::text)
      returning * into v_row;
    return v_row;
  end $$;
  revoke execute on function public.rule_vendor_actor_link(uuid, uuid, text, text) from public, anon, authenticated;
  grant execute on function public.rule_vendor_actor_link(uuid, uuid, text, text) to authenticated, service_role;

  create function public.rule_vendor_attribution(p_report_id uuid, p_verdict text, p_country text,
    p_strength text, p_phrase text, p_rationale text)
  returns public.vendor_attribution_decisions language plpgsql security definer set search_path = public as $$
  declare v_row public.vendor_attribution_decisions; v_verdict public.finding_verdicts;
  begin
    insert into vendor_attribution_decisions (report_id, decided_by) values (p_report_id, auth.uid()::text)
      returning * into v_row;
    v_verdict := record_verdict(gen_random_uuid(), 'confirmed', p_rationale);
    return v_row;
  end $$;
  revoke execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text) from public, anon, authenticated;
  grant execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text) to authenticated, service_role;
`

async function as(db, user, sql) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user || ''])
  return db.query(sql)
}

describe('migration 198', () => {
  let db
  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['198_ruling_reviewers.sql'] })
  }, 60_000)
  afterAll(() => db?.close())

  it('seeds the account that had already ruled, and no one else', async () => {
    const { rows } = await db.query(`select user_id from public.ruling_reviewers`)
    expect(rows.map((r) => r.user_id)).toEqual([REVIEWER])
  })

  it('lets a named reviewer record a verdict', async () => {
    const { rows } = await as(db, REVIEWER,
      `select (public.record_verdict(gen_random_uuid(), 'rejected', 'reasoning here')).decided_by as who`)
    expect(rows[0].who).toBe(REVIEWER)
  })

  it('refuses every ruling from a signed-in account not on the list', async () => {
    for (const call of [
      `select public.record_verdict(gen_random_uuid(), 'rejected', 'reasoning here')`,
      `select public.rule_vendor_actor_link(gen_random_uuid(), gen_random_uuid(), 'confirmed', 'reasoning here')`,
      `select public.rule_vendor_attribution(gen_random_uuid(), 'deferred', null, null, null, 'reasoning here')`,
    ]) {
      await expect(as(db, STRANGER, call)).rejects.toMatchObject({ code: '42501' })
    }
    const { rows } = await db.query(
      `select (select count(*) from vendor_link_decisions where decided_by = '${STRANGER}')
            + (select count(*) from vendor_attribution_decisions where decided_by = '${STRANGER}')
            + (select count(*) from finding_verdicts where decided_by = '${STRANGER}') as n`)
    expect(Number(rows[0].n)).toBe(0)
  })

  it('refuses a caller with no session', async () => {
    await expect(as(db, null,
      `select public.record_verdict(gen_random_uuid(), 'rejected', 'reasoning here')`))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('lets a reviewer rule on attributions, including the verdict it records by name', async () => {
    await as(db, REVIEWER,
      `select public.rule_vendor_attribution(gen_random_uuid(), 'deferred', null, null, null, 'reasoning here')`)
    await as(db, REVIEWER,
      `select public.rule_vendor_actor_link(gen_random_uuid(), gen_random_uuid(), 'confirmed', 'reasoning here')`)
    const { rows } = await db.query(
      `select (select count(*) from vendor_attribution_decisions where decided_by = '${REVIEWER}') as a,
              (select count(*) from vendor_link_decisions where decided_by = '${REVIEWER}') as l`)
    expect(Number(rows[0].a)).toBe(1)
    expect(Number(rows[0].l)).toBe(1)
  })

  it('closes the unchecked bodies and the allowlist to the browser roles', async () => {
    const { rows } = await db.query(`
      select r.role, f.sig, has_function_privilege(r.role, f.sig, 'execute') as ok
      from (values ('anon'), ('authenticated'), ('service_role')) r(role),
           (values ('public.record_verdict_unchecked(uuid,text,text)'),
                   ('public.rule_vendor_actor_link_unchecked(uuid,uuid,text,text)'),
                   ('public.rule_vendor_attribution_unchecked(uuid,text,text,text,text,text)')) f(sig)`)
    expect(rows.filter((r) => r.ok)).toEqual([])

    const t = await db.query(`
      select r.role, has_table_privilege(r.role, 'public.ruling_reviewers', 'select') as s,
             has_table_privilege(r.role, 'public.ruling_reviewers', 'insert') as i
      from (values ('anon'), ('authenticated')) r(role)`)
    expect(t.rows.every((r) => !r.s && !r.i)).toBe(true)
  })

  it('keeps the wrappers callable by authenticated and closed to anon', async () => {
    const { rows } = await db.query(`
      select has_function_privilege('authenticated', 'public.record_verdict(uuid,text,text)', 'execute') as auth,
             has_function_privilege('anon', 'public.record_verdict(uuid,text,text)', 'execute') as anon,
             has_function_privilege('anon', 'public.is_ruling_reviewer()', 'execute') as anon_check`)
    expect(rows[0]).toEqual({ auth: true, anon: false, anon_check: false })
  })
})
