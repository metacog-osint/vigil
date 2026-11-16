// @vitest-environment node
/**
 * Migration 172: review_reading_evidence puts the thing a reviewer is asked to
 * read beside the question. It shows what Vigil holds and says nothing it does
 * not: no sentence invented when the phrase is only in the title, no body when
 * the source sent none, no link when none is stored.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, migration } from './pg.js'

const SCHEMA = `
  create table data_quality_findings (
    id uuid primary key default gen_random_uuid(),
    check_name text, subject text, status text default 'open', details jsonb default '{}'
  );
  create table vendor_reports (id uuid default gen_random_uuid(), url text, title text, summary text, published date);
  create table threat_actors (id uuid primary key default gen_random_uuid(), name text);
  create table incidents (
    id uuid primary key default gen_random_uuid(), actor_id uuid, victim_name text,
    discovered_date date, source text, raw_data jsonb
  );
  create table contested_claims (id uuid primary key default gen_random_uuid(), question text, unit text);
  create table evidence_publishers (publisher_id text primary key, display_name text, tier text);
  create table claim_values (
    id uuid primary key default gen_random_uuid(), claim_id uuid, publisher_id text,
    value_numeric numeric, value_text text, measurement text, as_of date, window_note text,
    source_url text, citation text, verification text, verified_on date, entered_from text
  );
  create table regulatory_advisories (
    source text, advisory_id text, language text, kind text, title text, published date,
    url text, document_url text, indicators_read boolean
  );
`

describe('migration 172', () => {
  let db
  const ids = {}

  beforeAll(async () => {
    db = await freshDatabase({ schema: SCHEMA })
    await db.exec(`
      insert into vendor_reports (url, title, summary) values
        ('https://v/1', 'A report', 'First sentence. The operators are Chinese speaking, per the strings! Last one.'),
        ('https://v/2', 'Activity Traced to Iran', 'Nothing about it here.');
      insert into threat_actors (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'ShinyHunters'),
                                                  ('00000000-0000-0000-0000-0000000000a2', 'Conti');
      insert into incidents (actor_id, victim_name, discovered_date, source, raw_data) values
        ('00000000-0000-0000-0000-0000000000a1', 'Note to Cl0p', '2026-09-20', 'ransomlook',
         '{"description": "{{7*7}} not a victim"}'),
        ('00000000-0000-0000-0000-0000000000a2', 'Announcement', '2021-10-22', 'ransomwatch', '{}');
      insert into contested_claims (id, question, unit) values
        ('00000000-0000-0000-0000-0000000000c1', 'How much moved?', 'USD');
      insert into evidence_publishers values ('chainalysis', 'Chainalysis', '2');
      insert into claim_values (id, claim_id, publisher_id, value_numeric, citation, entered_from) values
        ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1',
         'chainalysis', 400, 'endnote [21]', 'Working reference');
      insert into regulatory_advisories (source, advisory_id, language, title, published, url, document_url) values
        ('fincen', 'FIN-2020-A003', 'es', 'Aviso', '2020-08-18', 'https://f/es', null),
        ('fincen', 'FIN-2020-A003', 'en', 'Advisory', '2020-07-07', 'https://f/en', 'https://f/en.pdf');
    `)
    const add = async (key, check, subject, details) => {
      const { rows } = await db.query(
        `insert into data_quality_findings (check_name, subject, details) values ($1, $2, $3) returning id`,
        [check, subject, details]
      )
      ids[key] = rows[0].id
    }
    await add('vendor', 'vendor_attribution_candidate', 'https://v/1', {
      url: 'https://v/1',
      phrase: 'Chinese speaking',
    })
    await add('vendorTitle', 'vendor_attribution_candidate', 'https://v/2', {
      url: 'https://v/2',
      phrase: 'Traced to',
    })
    await add('post', 'leak_site_notice_candidate', 'ShinyHunters / Note to Cl0p', {
      posted_on: '2026-09-20',
    })
    await add('noBody', 'leak_site_notice_candidate', 'Conti / Announcement', {
      posted_on: '2021-10-22',
    })
    await add('pattern', 'leak_site_notice_candidate', 'Posts phrased as questions', {})
    await add(
      'claim',
      'claim_value_unverified',
      'x_2025 / 00000000-0000-0000-0000-0000000000d1',
      {}
    )
    await add('advisory', 'advisory_indicators_unread', 'fincen / FIN-2020-A003', {})
    await add('other', 'victim_country_disagreement', 'Acme: US or GB', {})

    await db.exec(migration('172_review_reading_evidence.sql'))
  }, 60_000)
  afterAll(() => db?.close())

  async function evidenceFor(key) {
    const { rows } = await db.query(
      `select evidence from review_reading_evidence where finding_id = $1`,
      [ids[key]]
    )
    return rows[0]?.evidence
  }

  it('quotes only the sentences that hold the phrase', async () => {
    const e = await evidenceFor('vendor')
    expect(e.sentences).toEqual(['The operators are Chinese speaking, per the strings!'])
    expect(e.url).toBe('https://v/1')
  })

  it('invents no sentence when the phrase is only in the title', async () => {
    const e = await evidenceFor('vendorTitle')
    expect(e.sentences).toEqual([])
    expect(e.title).toBe('Activity Traced to Iran')
  })

  it('returns a post body as text when the source sent one, and none when it did not', async () => {
    expect((await evidenceFor('post')).body).toBe('{{7*7}} not a victim')
    const none = await evidenceFor('noBody')
    expect(none.body).toBeNull()
    expect(none.sources).toEqual(['ransomwatch'])
  })

  it('gives a group-level pattern finding nothing to show', async () => {
    expect(await evidenceFor('pattern')).toBeUndefined()
  })

  it('shows a claim value beside its citation, and no link when none is stored', async () => {
    const e = await evidenceFor('claim')
    expect(e).toMatchObject({
      question: 'How much moved?',
      unit: 'USD',
      publisher: 'Chainalysis',
      publisher_tier: '2',
      citation: 'endnote [21]',
      source_url: null,
    })
    expect(Number(e.value_numeric)).toBe(400)
  })

  it('reads the English edition of an advisory published in two languages', async () => {
    const e = await evidenceFor('advisory')
    expect(e.title).toBe('Advisory')
    expect(e.document_url).toBe('https://f/en.pdf')
    const { rows } = await db.query(
      `select count(*)::int as n from review_reading_evidence where finding_id = $1`,
      [ids.advisory]
    )
    expect(rows[0].n).toBe(1)
  })

  it('leaves other kinds out, and opens the view to signed-in reviewers only', async () => {
    expect(await evidenceFor('other')).toBeUndefined()
    const { rows } = await db.query(`
      select has_table_privilege('anon', 'review_reading_evidence', 'select') as anon,
             has_table_privilege('authenticated', 'review_reading_evidence', 'select') as auth
    `)
    expect(rows[0]).toEqual({ anon: false, auth: true })
  })
})
