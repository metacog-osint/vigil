// @vitest-environment node
/**
 * threat_actors_commercial (migrations 160 and 162): which actors anything
 * resold may name, and how it answers a lookup.
 *
 * The rule: an actor appears when a sellable source lists it, or when a
 * sellable source reports a claim by it. An actor only a NonCommercial source
 * names is left out, because its name is that source's work.
 *
 * The plan test exists because of a real failure. /api/feed asks for a list of
 * actors by id as anon, which Supabase stops at 3 seconds. 160 tested "listed
 * by its claims" against the set of every actor with a sellable claim, built
 * from all 41,053 claims whenever one requested actor lacked a sellable source
 * of its own: 2,767 ms for the feed's 33 ids, and a 503 on 31 October 2026.
 * 162 checks only the actors asked for.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The columns 160 and 162 read, as production has them.
const SCHEMA = `
  create table source_licences (
    source_id text primary key,
    display_name text not null,
    licence text not null,
    licence_url text,
    commercial_use boolean not null default false,
    attribution_required boolean not null default true,
    checked_on date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  insert into source_licences (source_id, display_name, licence, commercial_use) values
    ('misp-galaxy', 'MISP Galaxy', 'unchecked', true),
    ('mitre-attack', 'MITRE ATT&CK', 'unchecked', true),
    ('ransomware.live', 'Ransomware.live', 'personal use', false),
    ('etda', 'ETDA', 'CC BY-NC-SA 4.0', false);

  create table threat_actors (id uuid primary key default gen_random_uuid(), name text not null, source text);
  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id),
    victim_name text, incident_date date, discovered_date date, claim_date date,
    victim_country text, victim_country_source text, victim_sector text,
    victim_website text, status text, source_url text, source text
  );
  create index idx_incidents_actor on incidents (actor_id);
  create table actor_techniques (actor_id uuid, technique_id text, confidence text,
    first_seen date, last_seen date, source text);
  create table actor_tools (actor_id uuid, tool_name text, category text,
    first_seen date, last_seen date, source text);
  create table actor_sites (actor_id uuid, fqdn text, enabled boolean, available boolean,
    first_seen date, last_seen date, source text);
`

let db
const id = {}

beforeAll(async () => {
  db = await freshDatabase({
    schema: SCHEMA,
    migrations: ['160_commercial_views.sql', '162_actors_commercial_lookup.sql'],
  })

  const actor = async (key, name, source) => {
    id[key] = (
      await db.query('insert into threat_actors (name, source) values ($1, $2) returning id', [
        name,
        source,
      ])
    ).rows[0].id
  }
  // Spelt with an underscore, as 2,037 production rows are: 160 normalises it.
  await actor('listed', 'Listed by MISP', 'misp_galaxy')
  await actor('claimedClean', 'Named by Malpedia, claimed on RansomLook', 'malpedia')
  await actor('claimedNc', 'Named by Malpedia, claimed only on ransomware.live', 'malpedia')
  await actor('shared', 'Created by ransomware.live, shared claim', 'ransomware.live')
  await actor('nothing', 'OTX only, no claims', 'alienvault_otx')

  const claim = (key, source) =>
    db.query('insert into incidents (actor_id, victim_name, source) values ($1, $2, $3)', [
      id[key],
      `victim of ${key}`,
      source,
    ])
  await claim('claimedClean', 'ransomlook')
  await claim('claimedNc', 'ransomware.live')
  await claim('shared', 'ransomwatch, ransomware.live')
  // Production has 41,053 claims. With only a handful, building the whole set
  // is cheapest and Postgres rightly picks it, so the plan test below would
  // say nothing about the table the feed actually reads.
  await db.query(
    `insert into incidents (actor_id, victim_name, source)
     select $1, 'filler ' || g, 'ransomlook' from generate_series(1, 2000) g`,
    [id.listed]
  )
  await db.query('analyze')
}, 60_000)

afterAll(async () => {
  await db?.close()
})

const listed = async (ids) =>
  Object.fromEntries(
    (
      await db.query(
        'select actor_id, listed_by from threat_actors_commercial where actor_id = any ($1::uuid[])',
        [ids]
      )
    ).rows.map((r) => [r.actor_id, r.listed_by])
  )

describe('threat_actors_commercial: who may be named', () => {
  it('lists an actor a sellable source names, however the source id is spelt', async () => {
    expect(await listed([id.listed])).toEqual({ [id.listed]: 'source' })
  })

  it('lists an actor a NonCommercial source names when a sellable source reports its claims', async () => {
    expect(await listed([id.claimedClean])).toEqual({ [id.claimedClean]: 'claims' })
  })

  it('counts a claim two sources reported when one of them may be sold', async () => {
    expect(await listed([id.shared])).toEqual({ [id.shared]: 'claims' })
  })

  it('leaves out an actor only NonCommercial sources name or claim for', async () => {
    expect(await listed([id.claimedNc, id.nothing])).toEqual({})
  })

  it('answers a lookup with only the ids asked for', async () => {
    expect(await listed([id.listed, id.claimedClean, id.nothing])).toEqual({
      [id.listed]: 'source',
      [id.claimedClean]: 'claims',
    })
  })
})

describe('threat_actors_commercial: how it answers a lookup by id', () => {
  it("checks claims per requested actor, never the set of every actor's claims", async () => {
    const ids = [id.listed, id.claimedClean, id.claimedNc]
    const plan = (
      await db.query(
        'explain (costs off) select actor_id, name from threat_actors_commercial where actor_id = any ($1::uuid[])',
        [ids]
      )
    ).rows
      .map((r) => r['QUERY PLAN'])
      .join('\n')

    // 160's shape: "ANY (id = (hashed SubPlan n).col1)" - the whole set, built once.
    expect(plan).not.toMatch(/id = \(hashed SubPlan/)
    // 162's shape: a correlated check, run only for the actors in the lookup.
    expect(plan).toMatch(/EXISTS\(SubPlan/)
  })
})
