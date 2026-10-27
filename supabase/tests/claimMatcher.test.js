// @vitest-environment node
/**
 * The regression suite of real cases, agreed on 20 September 2026.
 *
 * Every case here is a claim that is in Vigil's incidents table, or a
 * deliberate variation of one. A change to the matcher that breaks a case
 * fails the build. When the matcher misses something in future, the miss is
 * added here before the fix.
 *
 * `match` means a watcher is told. `possible` means a person is asked and
 * nobody is told yet. `null` means silence. Getting `possible` wrong in either
 * direction is a failure: a near-miss that alerts is as bad as a variant that
 * is missed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

// The columns 161 reads, as production has them.
const SCHEMA = `
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text not null);
  create table incidents (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id),
    victim_name text,
    victim_website text,
    discovered_date date,
    source text,
    data_quality text default 'ok'
  );
  create table leak_site_notices (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references threat_actors (id),
    title text not null,
    posted_on date,
    kind text,
    source text
  );
  create table vendors (
    id uuid primary key default gen_random_uuid(),
    user_id varchar not null,
    team_id uuid,
    name varchar not null,
    domain varchar,
    website varchar
  );
`

const JACK_HENRY = {
  name: 'Jack Henry & Associates, Inc.',
  domain: 'jackhenry.com',
  aliases: ['Symitar', 'ProfitStars', 'Banno'],
}
const SVFCU = { name: 'Susquehanna Valley Federal Credit Union', domain: 'svfcu.org', aliases: [] }
const FISERV = { name: 'Fiserv, Inc.', domain: 'fiserv.com', aliases: ['First Data'] }
const SECUREWORKS = { name: 'Secureworks', domain: 'secureworks.com', aliases: [] }
const PRODAFT = { name: 'PRODAFT', domain: 'prodaft.com', aliases: [] }

let db

beforeAll(async () => {
  db = await freshDatabase({ schema: SCHEMA, migrations: ['161_claim_matcher.sql'] })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

async function match(victim, watch, website = null) {
  const { rows } = await db.query(
    'select match_kind, confidence, matched_on from org_match($1, $2, $3, $4, $5)',
    [victim, website, watch.name, watch.domain, watch.aliases]
  )
  return rows[0] ?? null
}

describe('org_key: names that are one organisation meet', () => {
  it.each([
    ['Jack Henry & Associates, Inc.', 'jack henry'],
    ['Jack Henry & Associates', 'jack henry'],
    ['Fiserv, Inc.', 'fiserv'],
    ['FISERV.COM', 'fiserv'],
    ['svfcu.org', 'svfcu'],
    ['https://www.svfcu.org/about', 'svfcu'],
    ['SVFCU', 'svfcu'],
    ['Susquehanna Valley Federal Credit Union', 'susquehanna valley fcu'],
    ['Susquehanna Valley FCU', 'susquehanna valley fcu'],
    ['example.co.uk', 'example'],
    ['The Example Holdings Group LLC', 'example'],
  ])('%s -> %s', async (input, key) => {
    const { rows } = await db.query('select org_key($1) as k', [input])
    expect(rows[0].k).toBe(key)
  })

  it('a sentence ending in a full stop is not a domain', async () => {
    const { rows } = await db.query('select org_domain_label($1) as d', [
      'How Distron corporation threaten national security. First Data leakage.',
    ])
    expect(rows[0].d).toBeNull()
  })
})

describe('svfcu.org: LockBit, 31 Aug 2026, listed only by domain', () => {
  it.each([
    ['svfcu.org', 'domain'],
    ['www.svfcu.org', 'domain'],
    ['https://svfcu.org/', 'domain'],
    ['SVFCU', 'domain'],
    ['Susquehanna Valley Federal Credit Union', 'name'],
    ['Susquehanna Valley FCU', 'name'],
  ])('%s alerts the credit union (%s)', async (victim, kind) => {
    expect(await match(victim, SVFCU)).toMatchObject({ match_kind: kind, confidence: 'match' })
  })

  it('a misspelling is put to a person, not alerted', async () => {
    expect(await match('Susquehana Valley FCU', SVFCU)).toMatchObject({
      match_kind: 'similar',
      confidence: 'possible',
    })
  })

  it('Susquehanna Glass (Akira, 19 Dec 2025) is a different organisation', async () => {
    expect(await match('Susquehanna Glass', SVFCU)).toBeNull()
  })
})

describe('Jack Henry: ShinyHunters, 29 Aug 2026', () => {
  it.each(['Jack Henry & Associates', 'Jack Henry', 'jackhenry.com'])(
    '%s alerts Jack Henry watchers',
    async (victim) => {
      expect(await match(victim, JACK_HENRY)).toMatchObject({ confidence: 'match' })
    }
  )

  it.each(['Symitar', 'ProfitStars', 'Banno'])(
    'a claim naming the product %s alerts Jack Henry watchers',
    async (victim) => {
      expect(await match(victim, JACK_HENRY)).toMatchObject({
        match_kind: 'alias',
        confidence: 'match',
        matched_on: victim,
      })
    }
  )

  it('a product name inside a longer claim is put to a person', async () => {
    expect(await match('Symitar Systems Group', JACK_HENRY)).toMatchObject({
      match_kind: 'contains',
      confidence: 'possible',
    })
  })

  it('Henry Schein is not Jack Henry', async () => {
    expect(await match('Henry Schein', JACK_HENRY)).toBeNull()
  })
})

describe('Fiserv: Everest 3 May 2026 and Clop 12 Aug 2026, two spellings', () => {
  it.each(['Fiserv', 'FISERV.COM', 'First Data'])('%s alerts Fiserv watchers', async (victim) => {
    expect(await match(victim, FISERV)).toMatchObject({ confidence: 'match' })
  })

  it('"First Data leakage" (leaknet, 8 Jan 2026) is a question, never an alert', async () => {
    const result = await match(
      'How Distron corporation threaten national security. First Data leakage.',
      FISERV
    )
    expect(result).toMatchObject({ match_kind: 'contains', confidence: 'possible' })
  })
})

describe('the claims as stored, through match_vendor_claims', () => {
  let ids

  beforeAll(async () => {
    const actor = async (name) =>
      (await db.query('insert into threat_actors (name) values ($1) returning id', [name])).rows[0]
        .id
    const lockbit = await actor('LockBit')
    const akira = await actor('Akira')
    const shiny = await actor('ShinyHunters')
    const everest = await actor('Everest')
    const clop = await actor('Clop')
    const leaknet = await actor('leaknet')

    const claim = (actorId, victim, date, quality = 'ok') =>
      db.query(
        `insert into incidents (actor_id, victim_name, discovered_date, source, data_quality)
         values ($1, $2, $3, 'ransomlook', $4)`,
        [actorId, victim, date, quality]
      )
    await claim(akira, 'Susquehanna Glass', '2025-12-19')
    await claim(
      leaknet,
      'How Distron corporation threaten national security. First Data leakage.',
      '2026-01-08'
    )
    await claim(everest, 'Fiserv', '2026-05-03')
    await claim(clop, 'FISERV.COM', '2026-08-12')
    await claim(shiny, 'Jack Henry & Associates', '2026-08-29')
    await claim(lockbit, 'svfcu.org', '2026-08-31')
    // A row that is not a claim, under a watched name.
    await claim(lockbit, 'Secureworks', '2024-02-20', 'placeholder')

    // Operation Cronos, 20 Feb 2024: banners on LockBit's seized site, titled
    // with real company names. 095 moved them out of incidents.
    for (const title of ['Secureworks', 'Prodaft', 'US Indictments', 'Sanctions']) {
      await db.query(
        `insert into leak_site_notices (actor_id, title, posted_on, kind, source)
         values ($1, $2, '2024-02-20', 'law_enforcement_seizure', 'ransomwatch')`,
        [lockbit, title]
      )
    }

    const vendor = async (w) =>
      (
        await db.query(
          `insert into vendors (user_id, name, domain, aliases) values ('test', $1, $2, $3) returning id`,
          [w.name, w.domain, w.aliases]
        )
      ).rows[0].id
    ids = {
      svfcu: await vendor(SVFCU),
      jackHenry: await vendor(JACK_HENRY),
      fiserv: await vendor(FISERV),
      secureworks: await vendor(SECUREWORKS),
      prodaft: await vendor(PRODAFT),
    }
  })

  const claimsFor = async (vendorId) =>
    (
      await db.query('select victim_name, actor_name, confidence from match_vendor_claims($1)', [
        vendorId,
      ])
    ).rows

  it('the credit union gets svfcu.org, and not Susquehanna Glass', async () => {
    expect(await claimsFor(ids.svfcu)).toEqual([
      { victim_name: 'svfcu.org', actor_name: 'LockBit', confidence: 'match' },
    ])
  })

  it('Jack Henry watchers get the ShinyHunters claim', async () => {
    expect(await claimsFor(ids.jackHenry)).toEqual([
      { victim_name: 'Jack Henry & Associates', actor_name: 'ShinyHunters', confidence: 'match' },
    ])
  })

  it('Fiserv watchers get both spellings as alerts, newest first, and the leaknet post as a question', async () => {
    expect(await claimsFor(ids.fiserv)).toEqual([
      { victim_name: 'FISERV.COM', actor_name: 'Clop', confidence: 'match' },
      { victim_name: 'Fiserv', actor_name: 'Everest', confidence: 'match' },
      {
        victim_name: 'How Distron corporation threaten national security. First Data leakage.',
        actor_name: 'leaknet',
        confidence: 'possible',
      },
    ])
  })

  it('a seizure banner titled with a company name is not a claim against it', async () => {
    expect(await claimsFor(ids.secureworks)).toEqual([])
    expect(await claimsFor(ids.prodaft)).toEqual([])
  })
})

describe('agreed on 20 September, not yet covered', () => {
  it.todo('Citrix Bleed (CVE-2023-4966): the KEV addition and the patch deadline both alert')
  it.todo('an undecided alias pair is shown as undecided, not merged')
  it.todo('a feed that went stale during a weekly run reports monitoring degraded, not all clear')
})
