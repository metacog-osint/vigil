// @vitest-environment node
/**
 * Migration 190: five more state registries, every count carrying its scope,
 * the three Oregon names corrected under their new accession, notices with no
 * reported date counted and left out, and only notices filed in the last 90
 * days queued for review.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table source_licences (
    source_id text primary key, display_name text, licence text, licence_url text,
    commercial_use boolean, attribution_required boolean, checked_on date, notes text
  );
  insert into source_licences (source_id) values ('wa-ag'), ('or-ag');
  create table victim_disclosures (
    id uuid primary key default gen_random_uuid(),
    accession text not null unique, company_name text not null, filed_date date not null,
    form text not null, filing_url text not null, source text not null default 'sec-edgar',
    match_status text not null default 'unreviewed', incident_date date, state text,
    persons_affected bigint, data_types text[], discovered_date date,
    persons_affected_scope text check (persons_affected_scope is null or persons_affected_scope in ('state_residents', 'total'))
  );
  create function public.actor_key(n text) returns text language sql immutable as
    $$ select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g') $$;
  create table queued (id uuid);
  create function public.queue_breach_notice_candidates(p_notice_ids uuid[]) returns integer
    language sql as $$ insert into queued select unnest(p_notice_ids); select cardinality(p_notice_ids) $$;
  create function public.record_finding(a text, b text, c text, d text, e jsonb) returns void
    language sql as $$ select $$;
  create function public.breach_notices_inserted() returns trigger language plpgsql as
    $$ begin return null; end $$;
  create trigger victim_disclosures_breach_candidates after insert on victim_disclosures
    referencing new table as new_rows for each statement execute function breach_notices_inserted();

  insert into victim_disclosures (accession, company_name, filed_date, form, filing_url, source, persons_affected, persons_affected_scope) values
    ('wa-ag:old:na:2026-01-01', 'Old WA', '2026-01-01', 'breach-notice', 'u', 'wa-ag', 10, 'state_residents'),
    ('wa-ag:new:na:2026-11-01', 'New WA', '2026-11-01', 'breach-notice', 'u', 'wa-ag', 12, null),
    ('or-ag:new:na:2026-11-02', 'New OR', '2026-11-02', 'breach-notice', 'u', 'or-ag', 99, null),
    ('or-ag:nocount:na:2026-11-02', 'No count OR', '2026-11-02', 'breach-notice', 'u', 'or-ag', null, null),
    ('or-ag:ameriprisefinancialinc160:2026-03-02:2026-04-17', 'Ameriprise Financial, Inc.&#160;', '2026-04-17', 'breach-notice', 'u', 'or-ag', 5, 'total');
  update victim_disclosures set incident_date = '2026-03-02' where company_name like 'Ameriprise%';
`

describe('migration 190', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['190_more_state_breach_registries.sql'],
    })
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  const apply = async (source, rows) =>
    (
      await db.query(`select apply_breach_notices($1::jsonb, $2) as r`, [
        JSON.stringify(rows),
        source,
      ])
    ).rows[0].r

  it('registers the five registries', async () => {
    const r = await db.query(
      `select source_id from source_licences where source_id like '%-ag' and notes like '%190.' order by 1`
    )
    expect(r.rows.map((x) => x.source_id)).toEqual(['de-ag', 'id-ag', 'mt-ag', 'sc-ag', 'vt-ag'])
  })

  it('gives every held count its scope, and none where there is no count', async () => {
    const r = await db.query(
      `select company_name, persons_affected_scope as scope from victim_disclosures order by company_name`
    )
    expect(Object.fromEntries(r.rows.map((x) => [x.company_name, x.scope]))).toMatchObject({
      'New WA': 'state_residents',
      'New OR': 'total',
      'No count OR': null,
      'Old WA': 'state_residents',
    })
  })

  it('corrects the Oregon name and its accession, so the next run updates it', async () => {
    const r = await db.query(
      `select company_name, accession from victim_disclosures where company_name like 'Ameriprise%'`
    )
    expect(r.rows).toEqual([
      {
        company_name: 'Ameriprise Financial, Inc.',
        accession: 'or-ag:ameriprisefinancialinc:2026-03-02:2026-04-17',
      },
    ])
    const out = await apply('or-ag', [
      {
        company_name: 'Ameriprise Financial, Inc.',
        state: 'OR',
        incident_date: '2026-03-02',
        reported_date: '2026-04-17',
        persons_affected: 5,
        persons_affected_scope: 'total',
        url: 'u',
      },
    ])
    expect(out.new).toBe(0)
  })

  it('stores a new registry with its scope, leaves out a notice with no reported date and says so', async () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    const out = await apply('mt-ag', [
      {
        company_name: 'Recent Co',
        state: 'MT',
        reported_date: recent,
        persons_affected: 7,
        persons_affected_scope: 'state_residents',
        url: 'u',
      },
      {
        company_name: 'Old Co',
        state: 'MT',
        reported_date: '2016-05-01',
        persons_affected: 3,
        persons_affected_scope: 'state_residents',
        url: 'u',
      },
      {
        company_name: 'Undated Co',
        state: 'MT',
        reported_date: '',
        persons_affected: 1,
        persons_affected_scope: 'state_residents',
        url: 'u',
      },
    ])
    expect(out).toMatchObject({ new: 2, skipped_no_reported_date: 1 })
    const r = await db.query(
      `select company_name, persons_affected_scope as scope from victim_disclosures where source = 'mt-ag' order by 1`
    )
    expect(r.rows).toEqual([
      { company_name: 'Old Co', scope: 'state_residents' },
      { company_name: 'Recent Co', scope: 'state_residents' },
    ])
  })

  it('queues only the notice filed in the last 90 days', async () => {
    const q = await db.query(
      `select v.company_name from queued q join victim_disclosures v on v.id = q.id order by 1`
    )
    expect(q.rows.map((x) => x.company_name)).toEqual(['Recent Co'])
  })

  it('refuses an unregistered source, and only service_role may run the writer', async () => {
    await expect(apply('zz-ag', [])).rejects.toThrow(/unregistered/)
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const ok = await db.query(
        `select has_function_privilege($1, 'public.apply_breach_notices(jsonb, text)', 'execute') as ok`,
        [role]
      )
      expect(ok.rows[0].ok).toBe(role === 'service_role')
    }
  })
})
