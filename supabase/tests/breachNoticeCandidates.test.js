// @vitest-environment node
/**
 * Migration 166: the state-notice question, asked under its own name.
 *
 * A notice is asked about when a claimed victim has the same company_key and
 * the claim falls within 90 days of the breach or report date. It is never
 * matched: match_status stays 'unreviewed'. New notices and new claims both
 * raise it, and a failure in either trigger must not stop the insert.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(),
    check_name text not null,
    subject text not null,
    severity text not null,
    status text not null default 'open',
    details jsonb default '{}',
    first_seen timestamptz default now(),
    last_seen timestamptz default now(),
    resolved_at timestamptz,
    unique (check_name, subject)
  );
  create function record_finding(p_check text, p_subject text, p_severity text, p_status text, p_details jsonb)
  returns void language sql as $$
    insert into data_quality_findings (check_name, subject, severity, status, details)
    values (p_check, p_subject, p_severity, p_status, p_details)
    on conflict (check_name, subject) do update
    set last_seen = now(), details = excluded.details,
        status = case when data_quality_findings.status in ('dismissed', 'resolved')
                      then data_quality_findings.status else excluded.status end;
  $$;
  create function company_key(n text) returns text language sql immutable as $$
    select regexp_replace(
             regexp_replace(
               regexp_replace(lower(coalesce(n, '')), '[^a-z0-9 ]', ' ', 'g'),
               '\\m(inc|corp|corporation|company|co|llc|ltd|limited|plc|holdings|holding|group|trust|lp|llp|the)\\M', ' ', 'g'
             ), '\\s+', '', 'g')
  $$;
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text);
  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors(id),
    victim_name text,
    victim_website text,
    discovered_date date
  );
  create table victim_disclosures (
    id uuid primary key default gen_random_uuid(),
    accession text not null unique,
    company_name text not null,
    state text,
    filed_date date,
    incident_date date,
    filing_url text,
    persons_affected bigint,
    source text not null,
    match_status text not null default 'unreviewed'
  );
`

let db
const q = async (sql, params) => (await db.query(sql, params)).rows
const findings = () =>
  q(`select subject, details from data_quality_findings
     where check_name = 'breach_notice_candidate' order by subject`)

beforeAll(async () => {
  db = await freshDatabase({ schema: SCHEMA })
  await db.exec(`
    insert into threat_actors (name) values ('Qilin');
    insert into incidents (actor_id, victim_name, discovered_date)
      select id, v, d::date from threat_actors, (values
        ('Acme Dental, Inc.', '2026-07-01'),
        ('Faraway Corp', '2025-01-01'),
        ('Sec Only Co', '2026-07-01')) x(v, d);
    insert into victim_disclosures (accession, company_name, state, filed_date, incident_date, source) values
      ('ca:acme', 'Acme Dental', 'CA', '2026-08-15', '2026-06-20', 'ca-ag'),
      ('wa:far', 'Faraway Corporation', 'WA', '2026-08-15', '2026-08-01', 'wa-ag'),
      ('sec:1', 'Sec Only Co', null, '2026-07-05', null, 'sec-edgar');
  `)
  await db.exec((await import('./pg.js')).migration('166_breach_notice_candidates.sql'))
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('the backfill', () => {
  it('asks about a notice whose claim is within 90 days, and only that one', async () => {
    const rows = await findings()
    expect(rows.map((r) => r.subject)).toEqual([
      'Acme Dental: CA breach notice reported 2026-08-15, breach 2026-06-20',
    ])
    const [{ details }] = rows
    expect(details.nearest_days_apart).toBe(11)
    expect(details.claims).toEqual([
      expect.objectContaining({
        claimed_victim: 'Acme Dental, Inc.',
        claimed_by: 'Qilin',
        days_apart: 11,
      }),
    ])
  })

  it('never asks about an SEC filing here, and never matches anything', async () => {
    const rows = await q(`select match_status, count(*)::int n from victim_disclosures group by 1`)
    expect(rows).toEqual([{ match_status: 'unreviewed', n: 3 }])
  })
})

describe('the triggers', () => {
  it('asks when a claim arrives after the notice', async () => {
    await q(
      `insert into incidents (victim_name, discovered_date) values ('Faraway Corp.', '2026-09-01')`
    )
    const subjects = (await findings()).map((r) => r.subject)
    expect(subjects).toContain(
      'Faraway Corporation: WA breach notice reported 2026-08-15, breach 2026-08-01'
    )
  })

  it('asks when a notice arrives after the claim', async () => {
    await q(
      `insert into victim_disclosures (accession, company_name, state, filed_date, source)
       values ('or:acme', 'ACME DENTAL', 'OR', '2026-07-20', 'or-ag')`
    )
    const subjects = (await findings()).map((r) => r.subject)
    expect(subjects).toContain('ACME DENTAL: OR breach notice reported 2026-07-20')
  })

  it('does not fail an insert when the check itself fails', async () => {
    await db.exec(`alter function queue_breach_notice_candidates(uuid[]) rename to qbnc_real;
      create function queue_breach_notice_candidates(p uuid[]) returns int language plpgsql as $$
      begin raise exception 'boom'; end $$;`)
    await q(
      `insert into incidents (victim_name, discovered_date) values ('Acme Dental', '2026-07-02')`
    )
    const [row] = await q(
      `select details->>'error' e from data_quality_findings where check_name = 'breach_notice_candidate_failed'`
    )
    expect(row.e).toMatch(/boom/)
    await db.exec(`drop function queue_breach_notice_candidates(uuid[]);
      alter function qbnc_real(uuid[]) rename to queue_breach_notice_candidates;`)
  })
})

describe('review_country_evidence', () => {
  it('reads the victim website and says which side a country-code domain agrees with', async () => {
    await db.exec(`
      insert into incidents (victim_name, victim_website) values ('World Wide Fittings', 'https://www.wwfittings.co.uk/about');
      insert into data_quality_findings (check_name, subject, severity, details) values
        ('victim_country_disagreement', 'World Wide Fittings: US or GB', 'info', '{"held":"US","offered":"GB"}'),
        ('victim_country_disagreement', 'Nowhere Ltd: US or DE', 'info', '{"held":"US","offered":"DE"}');
    `)
    const rows = await q(
      `select victim, website, tld, domain_agrees_with, incidents::int from review_country_evidence order by victim`
    )
    expect(rows).toEqual([
      { victim: 'Nowhere Ltd', website: null, tld: null, domain_agrees_with: null, incidents: 0 },
      {
        victim: 'World Wide Fittings',
        website: 'https://www.wwfittings.co.uk/about',
        tld: 'UK',
        domain_agrees_with: 'offered',
        incidents: 1,
      },
    ])
  })
})
