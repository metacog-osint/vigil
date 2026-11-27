// @vitest-environment node
/**
 * Migration 205: alert rules and notifications carry an attention level.
 * Quiet by default; five kinds of match are always extra; a backfilled row is
 * always quiet, even on a rule set to extra.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The columns 205 reads, as production has them after 159.
const SCHEMA = `
  create table user_alert_rules (
    id uuid primary key default gen_random_uuid(), user_id varchar not null,
    rule_name varchar, rule_type varchar not null, conditions jsonb default '{}',
    notify_email boolean default false, notify_in_app boolean default true,
    enabled boolean default true, last_triggered_at timestamptz, trigger_count int default 0,
    created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create table notifications (
    id uuid primary key default gen_random_uuid(), user_id varchar, notification_type varchar,
    title varchar, message text, severity varchar, link varchar, related_id varchar,
    related_type varchar, read_at timestamptz, created_at timestamptz default now(),
    expires_at timestamptz
  );
  create table alert_triggers (
    id uuid primary key default gen_random_uuid(), rule_id uuid, user_id varchar,
    trigger_data jsonb, notification_sent boolean, email_sent boolean,
    created_at timestamptz default now()
  );
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text);
  create table incidents (
    id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text,
    victim_sector text, claim_date date, discovered_date date,
    created_at timestamptz default now()
  );
  create table actor_takedowns (
    id uuid primary key default gen_random_uuid(), actor_id uuid, event_date date
  );
  create table vulnerabilities (
    cve_id text primary key, description text, product text, severity text,
    cvss_score numeric, kev_date date, ransomware_campaign_use boolean default false,
    epss_score numeric, epss_date date, created_at timestamptz default now()
  );
  create table kev_epss_p1 (
    cve_id text primary key, first_observed_at timestamptz default now(),
    epss_at_observation numeric, epss_date_at_observation date, seeded boolean default false
  );
  create function observe_kev_epss_p1() returns integer language sql as $$ select 0 $$;
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(), check_name text, subject text,
    status text default 'open', details jsonb, first_seen timestamptz default now()
  );
  create table contested_claims (
    id uuid primary key default gen_random_uuid(), claim_key text, question text, unit text
  );
  create table claim_values (
    id uuid primary key default gen_random_uuid(), claim_id uuid, value_numeric numeric,
    value_text text, created_at timestamptz default now()
  );
  -- A view in production; a table is enough for the columns the engine reads.
  create table claim_values_resolved (
    id uuid primary key, effective_tier smallint, publisher_name text,
    origin_publisher_name text, value_numeric numeric, value_text text
  );
  create function actor_key(n text) returns text language sql immutable as $$
    select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g')
  $$;
  create function company_key(n text) returns text language sql immutable as $$
    select regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]', '', 'g')
  $$;
`

const USER = 'u1'

describe('migration 205', () => {
  let db
  const one = async (sql, params) => (await db.query(sql, params)).rows[0]
  const rule = (type, conditions, attention = 'quiet') =>
    one(
      `insert into user_alert_rules (user_id, rule_name, rule_type, conditions, attention)
       values ($1, $2, $3, $4, $5) returning id`,
      [USER, type, type, JSON.stringify(conditions), attention]
    )
  const actor = async (name) =>
    (await one(`insert into threat_actors (name) values ($1) returning id`, [name])).id
  const run = async () => (await one(`select evaluate_alert_rules() as r`)).r
  const notes = async () =>
    (
      await db.query(
        `select notification_type as type, attention, title, related_id
           from notifications order by title`
      )
    ).rows

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA, migrations: ['205_alert_attention.sql'] })
  })
  afterAll(async () => db?.close())
  beforeEach(async () => {
    await db.exec(`
      truncate user_alert_rules, notifications, alert_triggers, threat_actors, incidents,
        actor_takedowns, vulnerabilities, kev_epss_p1, data_quality_findings,
        contested_claims, claim_values, claim_values_resolved;
    `)
  })

  it('defaults rules and notifications to quiet and refuses other values', async () => {
    const { id } = await one(
      `insert into user_alert_rules (user_id, rule_type) values ('x', 'vendor_cve') returning id`
    )
    expect(
      (await one(`select attention from user_alert_rules where id = $1`, [id])).attention
    ).toBe('quiet')
    await expect(
      db.query(`update user_alert_rules set attention = 'loud' where id = $1`, [id])
    ).rejects.toThrow(/attention_check/)
  })

  it('keeps a routine sector claim quiet, and marks it extra on a rule set to extra', async () => {
    const a = await actor('Akira')
    await db.query(
      `insert into incidents (actor_id, victim_name, victim_sector, discovered_date)
       values ($1, 'Clinic', 'healthcare', current_date)`,
      [a]
    )
    await rule('sector_incident', { sectors: ['healthcare'] })
    await run()
    expect((await notes()).map((n) => n.attention)).toEqual(['quiet'])

    await db.exec(`truncate notifications; update user_alert_rules set attention = 'extra'`)
    await run()
    expect((await notes()).map((n) => n.attention)).toEqual(['extra'])
  })

  it('keeps a backfilled claim quiet even on a rule set to extra', async () => {
    const a = await actor('Akira')
    await db.query(
      `insert into incidents (actor_id, victim_name, victim_sector, discovered_date)
       values ($1, 'Old clinic', 'healthcare', current_date - 400)`,
      [a]
    )
    await rule('sector_incident', { sectors: ['healthcare'] }, 'extra')
    const result = await run()
    expect((await notes()).map((n) => n.attention)).toEqual(['quiet'])
    expect(result.extra_created).toBe(0)
  })

  it("marks a group's first claim after a takedown extra, and not its second", async () => {
    const a = await actor('LockBit')
    await db.query(
      `insert into actor_takedowns (actor_id, event_date) values ($1, current_date - 60)`,
      [a]
    )
    await db.query(
      `insert into incidents (actor_id, victim_name, discovered_date, created_at)
       values ($1, 'Before', current_date - 90, now() - interval '89 days')`,
      [a]
    )
    await db.query(
      `insert into incidents (actor_id, victim_name, discovered_date) values ($1, 'First back', current_date)`,
      [a]
    )
    await rule('actor_activity', { actor_names: ['lockbit'] })
    await run()
    const [first] = await notes()
    expect(first.attention).toBe('extra')
    expect(first.title).toMatch(/first claim since a takedown/)

    await db.query(
      `insert into incidents (actor_id, victim_name, discovered_date, created_at)
       values ($1, 'Second back', current_date, now() + interval '1 second')`,
      [a]
    )
    await run()
    const all = await notes()
    expect(all).toHaveLength(2)
    expect(all.filter((n) => n.attention === 'extra')).toHaveLength(1)
  })

  it('marks only one claim of a single batch as the first since a takedown', async () => {
    const a = await actor('LockBit')
    await db.query(
      `insert into actor_takedowns (actor_id, event_date) values ($1, current_date - 60)`,
      [a]
    )
    await db.query(
      `insert into incidents (actor_id, victim_name, discovered_date)
       values ($1, 'Batch one', current_date), ($1, 'Batch two', current_date)`,
      [a]
    )
    await rule('actor_activity', { actor_names: ['lockbit'] })
    const result = await run()
    const all = await notes()
    expect(all).toHaveLength(2)
    expect(all.filter((n) => n.attention === 'extra')).toHaveLength(1)
    expect(all.filter((n) => /first claim since a takedown/.test(n.title))).toHaveLength(1)
    expect(result.extra_created).toBe(1)
  })

  it('marks a KEV addition for a named vendor extra, on vendor_cve, even for an old CVE row', async () => {
    await db.exec(`
      insert into vulnerabilities (cve_id, product, kev_date, created_at)
      values ('CVE-2024-0001', 'Ivanti Connect Secure', current_date, now() - interval '300 days'),
             ('CVE-2026-0002', 'Ivanti EPMM', null, now());
    `)
    await rule('vendor_cve', { vendors: ['Ivanti'] })
    await run()
    const byId = Object.fromEntries((await notes()).map((n) => [n.related_id, n]))
    expect(byId['CVE-2024-0001']).toMatchObject({ type: 'kev_added', attention: 'extra' })
    expect(byId['CVE-2026-0002']).toMatchObject({ type: 'vendor_alert', attention: 'quiet' })
  })

  it('keeps a KEV addition quiet on a kev_added rule that names no vendor', async () => {
    await db.exec(
      `insert into vulnerabilities (cve_id, product, kev_date) values ('CVE-2026-0003', 'X', current_date)`
    )
    await rule('kev_added', {})
    await run()
    expect(await notes()).toMatchObject([{ type: 'kev_added', attention: 'quiet' }])
  })

  it('keeps an old CVE stored now quiet on a rule set to extra', async () => {
    await db.exec(
      `insert into vulnerabilities (cve_id, product) values ('CVE-2015-0001', 'Cisco IOS')`
    )
    await rule('vendor_cve', { vendors: ['Cisco'] }, 'extra')
    await run()
    expect(await notes()).toMatchObject([{ type: 'vendor_alert', attention: 'quiet' }])
  })

  it('marks a KEV + EPSS P1 extra', async () => {
    await db.exec(`
      insert into vulnerabilities (cve_id, product, kev_date, ransomware_campaign_use)
        values ('CVE-2026-0004', 'Fortinet', current_date - 10, true);
      insert into kev_epss_p1 (cve_id, epss_at_observation, epss_date_at_observation)
        values ('CVE-2026-0004', 0.61, current_date);
    `)
    await rule('kev_epss_p1', {})
    await run()
    expect(await notes()).toMatchObject([{ type: 'kev_priority', attention: 'extra' }])
  })

  it('marks an 8-K match for a watched sector extra, beside the claim itself', async () => {
    const a = await actor('Qilin')
    await db.query(
      `insert into incidents (actor_id, victim_name, victim_sector, discovered_date, created_at)
       values ($1, 'Acme Health', 'healthcare', current_date - 5, now() - interval '5 days')`,
      [a]
    )
    await db.exec(`
      insert into data_quality_findings (check_name, subject, details) values
        ('sec_disclosure_candidate', 'Acme Health Inc. filed 8-K Item 1.05 on 2026-11-20',
         jsonb_build_object('filed', (current_date - 7)::text, 'claimed_victim', 'Acme Health',
                            'claimed_by', 'Qilin')),
        ('sec_disclosure_candidate', 'Acme Health Inc. filed 8-K Item 1.05 on 2026-11-21',
         '{"filed": "not a date", "claimed_victim": "Acme Health", "claimed_by": "Qilin"}');
      insert into data_quality_findings (check_name, subject, status, details) values
        ('sec_disclosure_candidate', 'Closed one', 'auto_closed',
         '{"filed": "2026-11-20", "claimed_victim": "Acme Health"}');
    `)
    await rule('sector_incident', { sectors: ['healthcare'] })
    await run()
    expect(await notes()).toMatchObject([
      {
        type: 'sec_disclosure',
        attention: 'extra',
        title: 'Acme Health Inc. filed 8-K Item 1.05 on 2026-11-20',
      },
    ])
  })

  it("ignores an 8-K match outside the rule's sectors", async () => {
    await db.exec(`
      insert into incidents (victim_name, victim_sector, discovered_date)
        values ('Acme Bank', 'finance', current_date - 5);
      insert into data_quality_findings (check_name, subject, details) values
        ('sec_disclosure_candidate', 'Acme Bank filed', '{"filed": "2026-11-20", "claimed_victim": "Acme Bank"}');
    `)
    await rule('sector_incident', { sectors: ['healthcare'] })
    await run()
    expect(await notes()).toEqual([])
  })

  it('marks a contested claim gaining its first Tier 1 origin extra, once', async () => {
    const { id: claim } = await one(
      `insert into contested_claims (claim_key, question, unit)
       values ('acme-records', 'How many records were taken?', 'records') returning id`
    )
    const value = async (tier, ago) => {
      const { id } = await one(
        `insert into claim_values (claim_id, value_numeric, created_at)
         values ($1, 1000, now() - $2::interval) returning id`,
        [claim, ago]
      )
      await db.query(
        `insert into claim_values_resolved (id, effective_tier, publisher_name, value_numeric)
         values ($1, $2, 'Regulator', 1000)`,
        [id, tier]
      )
    }
    await value(2, '3 days')
    await value(1, '10 minutes')
    await rule('contested_claim', { claim_keys: ['acme-records'] })
    await run()
    expect(await notes()).toMatchObject([{ type: 'contested_claim', attention: 'extra' }])

    // A second Tier 1 value for the same claim is not news.
    await db.exec(
      `truncate notifications; update claim_values set created_at = now() - interval '2 days'`
    )
    await value(1, '5 minutes')
    await run()
    expect(await notes()).toEqual([])
  })

  it('reports extra_created and records the attention on the trigger', async () => {
    await db.exec(`
      insert into vulnerabilities (cve_id, product, kev_date) values ('CVE-2026-0005', 'Citrix', current_date);
    `)
    await rule('kev_added', { vendors: ['Citrix'] })
    const result = await run()
    expect(result).toMatchObject({ notifications_created: 1, extra_created: 1 })
    const t = await one(`select trigger_data from alert_triggers`)
    expect(t.trigger_data).toMatchObject({ attention: 'quiet', extra: 1 })
  })
})
