// @vitest-environment node
/**
 * Migration 165: the review queue closes what it should never have asked.
 *
 * The first case is the real one. From 21 September 2026 every SEC run swept
 * state breach notices into the queue as "<company> filed 8-K Item 1.05 on
 * <date>": 583 of 600 open sec_disclosure_candidate findings named a filing
 * that does not exist. Those close, logged, and the notices go back to
 * 'unreviewed'. A real SEC candidate must stay open: whether a filing
 * corroborates a claim is a person's call.
 *
 * The others guard reversibility and the scan fix that stops new ones.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The columns 165 reads, as production has them before it runs.
const SCHEMA = `
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(),
    check_name text not null,
    subject text not null,
    severity text not null check (severity in ('info', 'warning', 'error')),
    status text not null default 'open',
    details jsonb default '{}',
    first_seen timestamptz default now(),
    last_seen timestamptz default now(),
    resolved_at timestamptz,
    unique (check_name, subject),
    constraint data_quality_findings_status_check
      check (status in ('open', 'auto_resolved', 'resolved', 'dismissed'))
  );

  -- 077's, verbatim in behaviour.
  create function record_finding(p_check text, p_subject text, p_severity text, p_status text, p_details jsonb)
  returns void language sql as $$
    insert into data_quality_findings (check_name, subject, severity, status, details, resolved_at)
    values (p_check, p_subject, p_severity, p_status, p_details,
            case when p_status in ('auto_resolved', 'resolved') then now() end)
    on conflict (check_name, subject) do update
    set last_seen = now(), severity = excluded.severity, details = excluded.details,
        status = case when data_quality_findings.status in ('dismissed', 'resolved')
                      then data_quality_findings.status else excluded.status end,
        resolved_at = coalesce(data_quality_findings.resolved_at, excluded.resolved_at);
  $$;

  create table finding_verdicts (
    id uuid primary key default gen_random_uuid(),
    finding_id uuid references data_quality_findings(id),
    verdict text, rationale text, decided_by text, decided_at timestamptz default now()
  );

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
    discovered_date date
  );

  create table victim_disclosures (
    id uuid primary key default gen_random_uuid(),
    accession text not null unique,
    company_name text not null,
    cik text,
    filed_date date not null,
    form text not null,
    items text[],
    business_location text,
    filing_url text,
    source text not null default 'sec-edgar',
    match_status text not null default 'unreviewed'
  );

  create table feed_health (feed_id text primary key, state text);
`

const SUBJECT = (company, date) => `${company} filed 8-K Item 1.05 on ${date}`

let db

async function q(sql, params) {
  return (await db.query(sql, params)).rows
}

async function status(subject) {
  return (await q('select status from data_quality_findings where subject = $1', [subject]))[0]
    ?.status
}

beforeAll(async () => {
  db = await freshDatabase({ schema: SCHEMA })
  // The state before 165: what the buggy scan left behind.
  await db.exec(`
    insert into threat_actors (name) values ('Qilin');
    insert into incidents (actor_id, victim_name, discovered_date)
      select id, v, '2026-07-01' from threat_actors,
        unnest(array['Acme Dental', 'Stryker', 'Oregon Widgets', 'Pending State Co']) v;

    insert into victim_disclosures (accession, company_name, filed_date, form, source, match_status) values
      ('ca:acme', 'Acme Dental', '2026-07-10', 'breach-notice', 'ca-ag', 'candidate'),
      ('wa:acme', 'Acme Dental', '2026-07-10', 'breach-notice', 'wa-ag', 'candidate'),
      ('or:widg', 'Oregon Widgets', '2026-06-02', 'breach-notice', 'or-ag', 'candidate'),
      ('0000310764-24-000001', 'Stryker', '2026-04-01', '8-K', 'sec-edgar', 'candidate'),
      ('ca:pending', 'Pending State Co', '2026-08-01', 'breach-notice', 'ca-ag', 'unreviewed');

    insert into data_quality_findings (check_name, subject, severity, status, details) values
      ('sec_disclosure_candidate', '${SUBJECT('Acme Dental', '2026-07-10')}', 'info', 'open', '{}'),
      ('sec_disclosure_candidate', '${SUBJECT('Oregon Widgets', '2026-06-02')}', 'info', 'open', '{}'),
      ('sec_disclosure_candidate', '${SUBJECT('Stryker', '2026-04-01')}', 'info', 'open', '{}'),
      ('source_upstream_down', 'ransomwhere down', 'warning', 'open', '{"feed_id":"ransomwhere"}'),
      ('source_upstream_down', 'other down', 'warning', 'open', '{"feed_id":"other"}');

    insert into feed_health values ('ransomwhere', 'fresh'), ('other', 'stale');
  `)
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('dry run', () => {
  it('counts without changing anything', async () => {
    // Load the migration's functions without its closing "run once" call, so
    // the dry run can be seen before anything is applied.
    const { migration } = await import('./pg.js')
    const sql = migration('165_review_queue_auto_close.sql').replace(
      /select \* from public\.auto_close_findings\(true\);/,
      ''
    )
    await db.exec(sql)

    const rows = await q('select * from auto_close_findings(false) order by rule')
    expect(rows).toEqual([
      { rule: 'feed_recovered', matched: 1, closed: 0, disclosures_reset: 0 },
      { rule: 'not_an_sec_filing', matched: 2, closed: 0, disclosures_reset: 3 },
    ])
    expect(await status(SUBJECT('Acme Dental', '2026-07-10'))).toBe('open')
    expect(await q(`select 1 from finding_auto_closures`)).toHaveLength(0)
  })
})

describe('apply', () => {
  beforeAll(async () => {
    await q('select * from auto_close_findings(true)')
  })

  it('closes findings that name an 8-K which is a state notice', async () => {
    expect(await status(SUBJECT('Acme Dental', '2026-07-10'))).toBe('auto_closed')
    expect(await status(SUBJECT('Oregon Widgets', '2026-06-02'))).toBe('auto_closed')
  })

  it('leaves a real SEC candidate for a person', async () => {
    expect(await status(SUBJECT('Stryker', '2026-04-01'))).toBe('open')
    const [row] = await q(`select match_status from victim_disclosures where source = 'sec-edgar'`)
    expect(row.match_status).toBe('candidate')
  })

  it('puts the swept notices back to unreviewed, and logs which', async () => {
    const rows = await q(
      `select match_status, count(*)::int n from victim_disclosures where source <> 'sec-edgar' group by 1`
    )
    expect(rows).toEqual([{ match_status: 'unreviewed', n: 4 }])
    const [log] = await q(
      `select jsonb_array_length(changed->'victim_disclosures_reset_to_unreviewed') n, reason
       from finding_auto_closures ac join data_quality_findings f on f.id = ac.finding_id
       where f.subject = $1`,
      [SUBJECT('Acme Dental', '2026-07-10')]
    )
    expect(log.n).toBe(2)
    expect(log.reason).toMatch(/ca-ag, wa-ag/)
  })

  it('closes a down-feed finding only when the feed is fresh', async () => {
    expect(await status('ransomwhere down')).toBe('auto_closed')
    expect(await status('other down')).toBe('open')
  })

  it('shows the reason on the review queue', async () => {
    const [row] = await q(
      `select auto_close_rule, auto_close_reason from review_queue where subject = 'ransomwhere down'`
    )
    expect(row.auto_close_rule).toBe('feed_recovered')
    expect(row.auto_close_reason).toMatch(/fresh/)
  })

  it('is idempotent', async () => {
    const rows = await q('select * from auto_close_findings(true)')
    expect(rows.every((r) => r.matched === 0)).toBe(true)
  })
})

describe('reopen', () => {
  it('needs a reason', async () => {
    await expect(q(`select reopen_auto_closed('feed_recovered', 'no')`)).rejects.toThrow(
      /reasoning/
    )
  })

  it('restores the finding and the notices exactly', async () => {
    const n = await q(
      `select reopen_auto_closed('not_an_sec_filing', 'wanted read after all') n`
    )
    expect(n[0].n).toBe(2)
    expect(await status(SUBJECT('Acme Dental', '2026-07-10'))).toBe('open')
    const rows = await q(
      `select match_status, count(*)::int n from victim_disclosures where source <> 'sec-edgar' group by 1 order by 1`
    )
    expect(rows).toEqual([
      { match_status: 'candidate', n: 3 },
      { match_status: 'unreviewed', n: 1 },
    ])
    const [log] = await q(
      `select count(*)::int n from finding_auto_closures where reopened_at is not null`
    )
    expect(log.n).toBe(2)
  })
})

describe('the scan', () => {
  it('no longer queues a state notice as an SEC filing', async () => {
    const out = await q(`select apply_victim_disclosures('[]'::jsonb) r`)
    expect(out[0].r.candidates_queued).toBe(0)
    expect(
      (await q(`select match_status from victim_disclosures where accession = 'ca:pending'`))[0]
        .match_status
    ).toBe('unreviewed')
  })

  it('still queues an unreviewed SEC filing', async () => {
    await q(
      `insert into victim_disclosures (accession, company_name, filed_date, form, source)
       values ('sec-new', 'Pending State Co', '2026-08-05', '8-K', 'sec-edgar')`
    )
    const out = await q(`select apply_victim_disclosures('[]'::jsonb) r`)
    expect(out[0].r.candidates_queued).toBe(1)
    expect(await status(SUBJECT('Pending State Co', '2026-08-05'))).toBe('open')
  })
})
