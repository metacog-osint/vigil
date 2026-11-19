// @vitest-environment node
/**
 * Migration 178: sanctions_wallet_overlap() (151) runs as its caller. The public /financial-crime page
 * still gets its three counts with the anonymous key, because anon reads both tables through `true`
 * policies; and it can no longer read past row-level security.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase } from './pg.js'

const SCHEMA = `
  create table iocs (id bigserial primary key, type text not null, value text not null);
  create table sanctioned_addresses (address text primary key, currency text);
  alter table iocs enable row level security;
  alter table sanctioned_addresses enable row level security;
  grant select on iocs, sanctioned_addresses to anon, authenticated;
  create policy iocs_public_read on iocs for select to anon, authenticated using (true);
  create policy sanctioned_addresses_public_read on sanctioned_addresses
    for select to anon, authenticated using (true);
  insert into iocs (type, value) values
    ('crypto_wallet', 'bc1qExample1'), ('crypto_wallet', '0xABCdef00'), ('domain', 'example.test');
  insert into sanctioned_addresses (address, currency) values ('0xabcdef00', 'ETH'), ('bc1qother', 'XBT');
`

describe('migration 178', () => {
  let db

  beforeAll(async () => {
    db = await freshDatabase({
      schema: SCHEMA,
      migrations: ['151_sanctions_wallet_overlap.sql', '178_sanctions_wallet_overlap_invoker.sql'],
    })
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  it('is SECURITY INVOKER and still executable by anon and authenticated', async () => {
    const { rows } = await db.query(
      `select p.prosecdef as definer,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
         from pg_proc p where p.proname = 'sanctions_wallet_overlap'`
    )
    expect(rows).toEqual([{ definer: false, anon: true, authenticated: true }])
  })

  it('gives anon the same counts the page showed before, case-insensitively', async () => {
    await db.query('set role anon')
    try {
      const { rows } = await db.query('select public.sanctions_wallet_overlap() as r')
      const r = rows[0].r
      expect(r.wallets_held).toBe(2)
      expect(r.sanctioned_addresses).toBe(2)
      expect(r.wallets_on_sdn_list).toBe(1)
    } finally {
      await db.query('reset role')
    }
  })

  it('counts only what the caller may read once the policies narrow', async () => {
    await db.query(`drop policy iocs_public_read on iocs`)
    await db.query('set role anon')
    try {
      const { rows } = await db.query('select public.sanctions_wallet_overlap() as r')
      expect(rows[0].r.wallets_held).toBe(0)
      expect(rows[0].r.wallets_on_sdn_list).toBe(0)
    } finally {
      await db.query('reset role')
    }
  })
})
