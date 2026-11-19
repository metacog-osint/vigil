import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { toIncident } from '../ransomlook.js'
import { JOBS_BY_ID } from '../registry.js'

describe('V11: RansomLook keeps the whole post', () => {
  it('stores the full description and every field the post carried', () => {
    const long = 'x'.repeat(5000)
    const post = {
      post_title: 'Victim Ltd',
      group_name: 'lockbit',
      link: 'http://x.onion/1',
      description: long,
      screen: 's.png',
      discovered: '2026-11-17 10:00:00.1',
      magic_new_field: { a: 1 },
    }
    const rec = toIncident(post, { lockbit: 'actor-1' })
    expect(rec.raw_data.description).toBe(long)
    expect(rec.raw_data.magic_new_field).toEqual({ a: 1 })
    expect(rec.raw_data.group_name).toBe('lockbit')
    expect(rec.raw_data.post_title).toBe('Victim Ltd')
    expect(rec.victim_name).toBe('Victim Ltd')
    expect(rec.discovered_date).toBe('2026-11-17')
  })
})

describe('V6: the worker snapshots actor trends daily', () => {
  it('has a daily job that calls snapshot_actor_trends with the worker db', async () => {
    const job = JOBS_BY_ID['actor-trend-snapshot']
    expect(job.intervalMinutes).toBe(24 * 60)
    const calls = []
    const db = { rpc: async (name, params) => (calls.push([name, params]), { data: 12, error: null }) }
    const out = await job.run(db, {})
    expect(calls).toEqual([['snapshot_actor_trends', {}]])
    expect(out).toEqual({ success: true, result: 12 })
  })
})

describe('V2: the legacy Tor script no longer deletes exits that leave the list', () => {
  it('has no delete call on iocs', () => {
    const src = readFileSync(path.join(process.cwd(), 'scripts', 'ingest-tor-exits.mjs'), 'utf8')
    expect(src).not.toMatch(/\.delete\(\)/)
    expect(src).toMatch(/no_longer_listed/)
  })
  it('the worker feed never deletes either', () => {
    const src = readFileSync(path.join(process.cwd(), 'workers', 'src', 'feeds', 'tor-exits.js'), 'utf8')
    expect(src).not.toMatch(/\.delete\(/)
  })
})
