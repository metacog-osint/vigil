// @vitest-environment node
/**
 * Migrations 201 and 202. 201: a RansomLook claim's sector tag is replaced only by appending the old
 * one to victim_sector_history, only while the stored tag is still the one the plan was made from,
 * and only by service_role. 202: the TEST-NET debug rows are marked, and nothing is deleted.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'
import { planRetag } from '../../scripts/retag-victim-sectors.mjs'

const SCHEMA = `
  create table incidents (
    id uuid primary key,
    victim_name text,
    victim_sector text,
    source text,
    updated_at timestamptz
  );
  create table iocs (id uuid primary key, type text, value text, source text);
  create table sync_log (id uuid primary key, source text, status text);
  insert into incidents (id, victim_name, victim_sector, source) values
    ('00000000-0000-0000-0000-000000000001', 'Midwest Soils', 'energy', 'ransomlook'),
    ('00000000-0000-0000-0000-000000000002', 'Lake County', 'government', 'ransomlook'),
    ('00000000-0000-0000-0000-000000000003', 'Acme Biotechnology Bank', 'finance', 'ransomlook'),
    ('00000000-0000-0000-0000-000000000004', 'Midwest Soils', 'professional_services', 'ransomlook'),
    ('00000000-0000-0000-0000-000000000005', 'Gulf Soils', 'energy', 'ransomware.live'),
    ('00000000-0000-0000-0000-000000000006', 'Bankruptcy Software Specialists', 'finance', 'ransomlook');
  insert into iocs (id, type, value, source) values
    ('10000000-0000-0000-0000-000000000001', 'ip', '192.0.2.1', 'debug-test'),
    ('10000000-0000-0000-0000-000000000002', 'ip', '192.0.2.4', 'debug-test'),
    ('10000000-0000-0000-0000-000000000003', 'ip', '203.0.113.9', 'threatfox'),
    ('10000000-0000-0000-0000-000000000004', 'ip', '198.51.100.7', 'debug-test');
  insert into sync_log (id, source, status) values
    ('20000000-0000-0000-0000-000000000001', 'debug-test', 'success'),
    ('20000000-0000-0000-0000-000000000002', 'ransomlook', 'success');
`

describe('migrations 201 and 202', () => {
  let db
  const retag = async (changes) =>
    (
      await db.query('select public.apply_victim_sector_retag($1::jsonb) as r', [
        JSON.stringify(changes),
      ])
    ).rows[0].r
  const incident = async (n) =>
    (
      await db.query(
        `select victim_sector, victim_sector_history from incidents where id = '00000000-0000-0000-0000-00000000000${n}'`
      )
    ).rows[0]

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['201_victim_sector_whole_words.sql', '202_mark_test_rows.sql'],
    })
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  it('starts every row with an empty history and changes no tag by itself', async () => {
    const { rows } = await db.query(
      `select count(*)::int n, count(*) filter (where victim_sector_history = '[]'::jsonb)::int empty from incidents`
    )
    expect(rows[0]).toEqual({ n: 6, empty: 6 })
    expect((await incident(1)).victim_sector).toBe('energy')
  })

  it('lets only service_role run the re-tag, as its caller', async () => {
    const { rows } = await db.query(
      `select p.prosecdef as definer,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
              has_function_privilege('service_role', p.oid, 'execute') as service_role
         from pg_proc p where p.proname = 'apply_victim_sector_retag'`
    )
    expect(rows).toEqual([
      { definer: false, anon: false, authenticated: false, service_role: true },
    ])
  })

  it('plans changes only for tags the old rule wrote, and keeps each replaced tag', async () => {
    const { rows } = await db.query(
      `select id, victim_name, victim_sector from incidents where source = 'ransomlook' order by id`
    )
    const plan = planRetag(rows)
    // Soils (old rule: energy) loses its tag; Bankruptcy Software moves to technology. Lake County
    // and the Biotechnology bank are unchanged; the professional_services tag came from elsewhere.
    expect(plan.changes.map((c) => [c.name, c.from, c.to])).toEqual([
      ['Midwest Soils', 'energy', null],
      ['Bankruptcy Software Specialists', 'finance', 'technology'],
    ])
    expect(plan.unchanged).toBe(2)
    expect(plan.notFromOldRule).toBe(1)

    expect(await retag(plan.changes)).toEqual({ changed: 2, skipped: 0 })
    const soils = await incident(1)
    expect(soils.victim_sector).toBeNull()
    expect(soils.victim_sector_history).toHaveLength(1)
    expect(soils.victim_sector_history[0]).toMatchObject({
      sector: 'energy',
      rule: 'name-substring',
      replaced_by: 'name-whole-word-1',
    })
    expect(soils.victim_sector_history[0].replaced_at).toBeTruthy()
    expect((await incident(6)).victim_sector).toBe('technology')
    // Untouched rows keep an empty history.
    expect((await incident(2)).victim_sector_history).toEqual([])
    expect((await incident(4)).victim_sector).toBe('professional_services')
  })

  it('changes nothing the second time, and skips a row whose tag changed since the plan', async () => {
    expect(
      await retag([{ id: '00000000-0000-0000-0000-000000000001', from: 'energy', to: null }])
    ).toEqual({ changed: 0, skipped: 1 })
    expect((await incident(1)).victim_sector_history).toHaveLength(1)
    // Not RansomLook: never touched, whatever the plan says.
    expect(
      await retag([{ id: '00000000-0000-0000-0000-000000000005', from: 'energy', to: null }])
    ).toEqual({ changed: 0, skipped: 1 })
    expect((await incident(5)).victim_sector).toBe('energy')
  })

  it('refuses anything but an array', async () => {
    await expect(db.query(`select public.apply_victim_sector_retag('{}'::jsonb)`)).rejects.toThrow(
      /must be a JSON array/
    )
  })

  it('marks the TEST-NET debug rows and deletes nothing', async () => {
    const iocs = (await db.query(`select value, excluded_reason from iocs order by value`)).rows
    expect(iocs).toHaveLength(4)
    const reason = Object.fromEntries(iocs.map((r) => [r.value, r.excluded_reason]))
    expect(reason['192.0.2.1']).toMatch(/^test row: TEST-NET-1/)
    expect(reason['192.0.2.4']).toMatch(/^test row: TEST-NET-1/)
    // A real row, and a debug-test row outside the four named addresses, stay unmarked.
    expect(reason['203.0.113.9']).toBeNull()
    expect(reason['198.51.100.7']).toBeNull()
    const sync = (await db.query(`select source, excluded_reason from sync_log order by source`))
      .rows
    expect(sync).toEqual([
      { source: 'debug-test', excluded_reason: 'test row: source debug-test' },
      { source: 'ransomlook', excluded_reason: null },
    ])
  })
})
