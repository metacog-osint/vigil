#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Re-tag RansomLook claims' victim_sector with the whole-word rule (migration 201).
 *
 *   node --env-file=.env scripts/retag-victim-sectors.mjs [--days N] [--list] [--apply]
 *
 * Reads every RansomLook incident (or those discovered in the last N days), runs the old substring
 * rule and the new whole-word rule from workers/src/lib/victimSector.js on each name, and proposes a
 * change only where the stored tag is the one the old rule gives for that name and the new rule
 * gives another. A tag from anywhere else is never touched.
 *
 * Dry run by default: prints the counts (and with --list, each change) and writes nothing. A dry run
 * needs only VITE_SUPABASE_URL and the anon key. --apply sends the plan in batches to
 * apply_victim_sector_retag (201), which keeps each replaced tag in victim_sector_history and skips a
 * row whose tag changed since it was read; it needs SUPABASE_SERVICE_ROLE_KEY.
 */
import { pathToFileURL } from 'node:url'
import {
  inferSector,
  inferSectorBySubstring,
  SECTOR_RULE,
} from '../workers/src/lib/victimSector.js'

const PAGE = 1000
const BATCH = 500

/**
 * The changes for these rows. Each row is { id, victim_name, victim_sector }.
 * Returns { changes: [{ id, name, from, to }], unchanged, notFromOldRule }.
 */
export function planRetag(rows) {
  const changes = []
  let unchanged = 0
  let notFromOldRule = 0
  for (const r of rows) {
    const stored = r.victim_sector ?? null
    const before = inferSectorBySubstring(r.victim_name)
    const after = inferSector(r.victim_name)
    if (stored !== before) {
      notFromOldRule += 1
    } else if (after === stored) {
      unchanged += 1
    } else {
      changes.push({ id: r.id, name: r.victim_name, from: stored, to: after })
    }
  }
  return { changes, unchanged, notFromOldRule }
}

/** Counts by "from -> to", by sector before, and per sector the share that rested on a substring. */
export function summarise(rows, plan) {
  const byMove = {}
  for (const c of plan.changes) {
    const k = `${c.from ?? 'none'} -> ${c.to ?? 'none'}`
    byMove[k] = (byMove[k] || 0) + 1
  }
  const tagged = {}
  for (const r of rows) {
    if (r.victim_sector) tagged[r.victim_sector] = (tagged[r.victim_sector] || 0) + 1
  }
  const bySector = {}
  for (const [sector, n] of Object.entries(tagged)) {
    const moved = plan.changes.filter((c) => c.from === sector).length
    bySector[sector] = { tagged: n, retagged: moved }
  }
  return {
    rows: rows.length,
    tagged: Object.values(tagged).reduce((a, b) => a + b, 0),
    retagged: plan.changes.length,
    to_none: plan.changes.filter((c) => c.to === null).length,
    unchanged: plan.unchanged,
    not_from_old_rule: plan.notFromOldRule,
    by_move: Object.fromEntries(Object.entries(byMove).sort((a, b) => b[1] - a[1])),
    by_sector: bySector,
  }
}

async function readRows(base, key, days) {
  const rows = []
  const since = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : null
  let last = null
  for (;;) {
    const filters = [
      'select=id,victim_name,victim_sector',
      'source=eq.ransomlook',
      since ? `discovered_date=gte.${since}` : null,
      last ? `id=gt.${last}` : null,
      'order=id',
      `limit=${PAGE}`,
    ].filter(Boolean)
    const res = await fetch(`${base}/rest/v1/incidents?${filters.join('&')}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`incidents read: HTTP ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE) break
    last = page[page.length - 1].id
  }
  return { rows, since }
}

async function apply(base, key, changes) {
  let changed = 0
  let skipped = 0
  for (let i = 0; i < changes.length; i += BATCH) {
    const p_changes = changes.slice(i, i + BATCH).map(({ id, from, to }) => ({ id, from, to }))
    const res = await fetch(`${base}/rest/v1/rpc/apply_victim_sector_retag`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_changes }),
    })
    if (!res.ok)
      throw new Error(`apply_victim_sector_retag: HTTP ${res.status} ${await res.text()}`)
    const out = await res.json()
    changed += out.changed
    skipped += out.skipped
  }
  return { changed, skipped }
}

async function main(argv) {
  const has = (flag) => argv.includes(flag)
  const daysAt = argv.indexOf('--days')
  const days = daysAt >= 0 ? Number(argv[daysAt + 1]) : null
  if (daysAt >= 0 && !(days > 0)) throw new Error('--days takes a positive number')
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  // A dry run reads with the anon key where there is one: it writes nothing, so it needs no more.
  // Anon does not see placeholder names (incidents_public_read), which never carry a sector word.
  const key = has('--apply')
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) {
    throw new Error(
      has('--apply')
        ? 'set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
        : 'set SUPABASE_URL (or VITE_SUPABASE_URL) and a key'
    )
  }

  const { rows, since } = await readRows(base, key, days)
  const plan = planRetag(rows)
  const summary = {
    rule: SECTOR_RULE,
    scope: since ? `RansomLook claims discovered since ${since}` : 'all RansomLook claims',
    ...summarise(rows, plan),
  }
  console.log(JSON.stringify(summary, null, 2))
  if (has('--list')) {
    for (const c of plan.changes) console.log(`${c.from ?? 'none'} -> ${c.to ?? 'none'}\t${c.name}`)
  }
  if (!has('--apply')) {
    console.log('Dry run: nothing written. --apply writes it.')
    return
  }
  const result = await apply(base, key, plan.changes)
  console.log(JSON.stringify({ applied: result }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
