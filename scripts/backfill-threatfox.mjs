/* eslint-disable no-console */
/**
 * Backfill ThreatFox indicators that the hourly worker read but failed to save.
 *
 *   node scripts/backfill-threatfox.mjs fetch <out.json> [--ids 2039118-2039822,...]
 *   node scripts/backfill-threatfox.mjs sql <in.json> <out prefix> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * fetch: reads ThreatFox's last 7 days (get_iocs, days 7: the API's maximum,
 * counted on first_seen) with ABUSECH_API_KEY from .env, plus, with --ids, each
 * listed ID one at a time (query "ioc"), one request a second. --ids reaches
 * indicators older than 7 days; ThreatFox keeps six months. Writes the raw
 * entries to <out.json>. Reads no Supabase key.
 *
 * sql: turns <out.json> into SQL to run as the service role (Supabase SQL
 * editor or MCP), the way backfill-vendor-exploited.mjs does:
 *   <prefix>-check-1.sql ...  read-only: how many entries Vigil lacks, by day,
 *                             and how many it holds under another source
 *   <prefix>-1.sql ...        inserts, each returning how many rows it added
 * Every file stays under 1.5 MB (the MCP limit is 2 MB).
 *   <prefix>-undo.sql         removes exactly the rows these inserts added
 * The inserts add only indicators Vigil does not hold (on conflict (type, value)
 * do nothing), so a run never changes an existing row, whatever its source, and
 * running a file twice adds nothing the second time. Rows are shaped as the
 * worker shapes them (workers/src/feeds/threatfox.js), with first_seen_at and
 * last_seen_at set to ThreatFox's own dates rather than the run's, so the
 * backfill does not read as a burst of new indicators today. metadata.backfill
 * holds the run's date, for the undo file.
 *
 * Why the rows were missing: from 17 to 26 Nov 2026 a 250-row upsert now and
 * then ran past the 8 s statement timeout PostgREST allows, and the batch was
 * dropped (sync_log records_failed). Most dropped rows were saved by a later
 * hourly run, since each run rereads the last day; rows whose every rereading
 * failed or came back cut off were never saved. The SQL route has no 8 s limit.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { latestPerKey } from '../workers/src/feeds/threatfox.js'

const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/'
const MAX_DAYS = 7
const CHUNK_BYTES = 1_500_000

// Same mapping as workers/src/feeds/threatfox.js.
const TYPE_MAP = {
  'ip:port': 'ip',
  domain: 'domain',
  url: 'url',
  md5_hash: 'hash_md5',
  sha256_hash: 'hash_sha256',
  sha1_hash: 'hash_sha1',
}
export const mapIocType = (t) => TYPE_MAP[t] || 'unknown'
export const mapConfidence = (level) => (level >= 75 ? 'high' : level >= 50 ? 'medium' : 'low')

/** ThreatFox writes dates as "2026-11-22 04:35:04 UTC". */
export function toIso(value) {
  if (!value) return null
  const t = Date.parse(String(value).replace(' UTC', 'Z').replace(' ', 'T'))
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** One Vigil row, as the worker builds it, dated by ThreatFox. */
export function toRecord(ioc, backfillDate) {
  const firstSeen = toIso(ioc.first_seen)
  const lastSeen = toIso(ioc.last_seen)
  return {
    value: ioc.ioc,
    type: mapIocType(ioc.ioc_type),
    source: 'threatfox',
    malware_family: ioc.malware_printable || ioc.malware || null,
    confidence: mapConfidence(ioc.confidence_level),
    first_seen: firstSeen,
    last_seen: lastSeen,
    source_url: `https://threatfox.abuse.ch/ioc/${ioc.id}/`,
    tags: ioc.tags || [],
    metadata: {
      threatfox_id: ioc.id,
      threat_type: ioc.threat_type,
      reporter: ioc.reporter,
      reference: ioc.reference,
      backfill: backfillDate,
    },
    first_seen_at: firstSeen,
    last_seen_at: lastSeen || firstSeen,
  }
}

/** "2039118-2039822,2040071" -> [2039118, ..., 2039822, 2040071] */
export function parseIds(spec) {
  const ids = []
  for (const part of String(spec || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) throw new Error(`not an ID or range: ${part}`)
    const lo = Number(m[1])
    const hi = Number(m[2] || m[1])
    if (hi < lo || hi - lo > 50_000) throw new Error(`range out of order or too long: ${part}`)
    for (let id = lo; id <= hi; id += 1) ids.push(id)
  }
  return ids
}

/** One POST, tried three times on network errors, 5xx, 429 and cut-off replies. */
export async function post(body, apiKey, { fetchImpl = fetch, waitMs = 3000 } = {}) {
  let last
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, waitMs * (attempt - 1)))
    let response
    try {
      response = await fetchImpl(THREATFOX_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Auth-Key': apiKey,
          'User-Agent': 'Vigil-ThreatIntel/1.0',
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      last = `could not reach ThreatFox (${error.message})`
      continue
    }
    if (!response.ok) {
      last = `ThreatFox answered HTTP ${response.status}`
      if (response.status >= 500 || response.status === 429) continue
      throw new Error(last)
    }
    try {
      return JSON.parse(await response.text())
    } catch (error) {
      last = `cut-off or unreadable reply (${error.message})`
    }
  }
  throw new Error(`${last} (3 tries)`)
}

/** The entries one "ioc" lookup returned, or [] for an ID ThreatFox no longer lists. */
export function entriesFromLookup(reply) {
  if (!reply || typeof reply !== 'object') return []
  if (Array.isArray(reply.data)) return reply.data
  if (reply.data && typeof reply.data === 'object') return [reply.data]
  if (reply.query_status && reply.query_status !== 'ok') return []
  return reply.ioc && reply.ioc_type ? [reply] : []
}

export async function fetchAll(apiKey, ids, opts = {}) {
  const { pauseMs = 1000, log = console.log } = opts
  const recent = await post({ query: 'get_iocs', days: MAX_DAYS }, apiKey, opts)
  if (recent.query_status !== 'ok') throw new Error(`get_iocs: ${recent.query_status}`)
  const byId = new Map((recent.data || []).map((e) => [e.id, e]))
  log(`get_iocs (last ${MAX_DAYS} days): ${byId.size} entries`)

  let found = 0
  let gone = 0
  const wanted = ids.filter((id) => !byId.has(id))
  for (const [i, id] of wanted.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs))
    const entries = entriesFromLookup(await post({ query: 'ioc', id }, apiKey, opts))
    if (entries.length === 0) gone += 1
    for (const e of entries) {
      byId.set(e.id, e)
      found += 1
    }
    if ((i + 1) % 100 === 0) log(`  looked up ${i + 1}/${wanted.length}`)
  }
  if (wanted.length) log(`ID lookups: ${found} found, ${gone} no longer listed by ThreatFox`)
  return [...byId.values()]
}

const lit = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`

const COLS =
  'value text, type text, source text, malware_family text, confidence text, ' +
  'first_seen timestamptz, last_seen timestamptz, source_url text, tags text[], ' +
  'metadata jsonb, first_seen_at timestamptz, last_seen_at timestamptz'
const NAMES = COLS.replace(/ [a-z[\]]+(,|$)/g, '$1')

export function insertSql(records) {
  return (
    `set statement_timeout = '120s';\n` +
    `with added as (\n` +
    `  insert into public.iocs (${NAMES})\n` +
    `  select ${NAMES} from jsonb_to_recordset(${lit(records)}) as x(${COLS})\n` +
    `  on conflict (type, value) do nothing\n` +
    `  returning 1\n` +
    `)\nselect count(*) as added from added;\n`
  )
}

export function checkSql(records) {
  const keys = records.map((r) => ({ type: r.type, value: r.value, day: (r.first_seen || '').slice(0, 10) }))
  return (
    `-- Read-only. Run before the numbered files.\n` +
    `with k as (select * from jsonb_to_recordset(${lit(keys)}) as x(type text, value text, day text))\n` +
    `select k.day,\n` +
    `       count(*) as listed,\n` +
    `       count(*) filter (where i.id is null) as missing,\n` +
    `       count(*) filter (where i.id is not null and i.source is distinct from 'threatfox') as held_under_other_source\n` +
    `from k left join public.iocs i on i.type = k.type and i.value = k.value\n` +
    `group by rollup (k.day) order by k.day nulls last;\n`
  )
}

export function undoSql(backfillDate) {
  return (
    `-- Removes only the rows this backfill added (metadata.backfill = '${backfillDate}').\n` +
    `-- Run as the service role. Their ioc_sightings rows go with them (on delete cascade).\n` +
    `delete from public.iocs where source = 'threatfox' and metadata->>'backfill' = '${backfillDate}';\n`
  )
}

/** Split items into statements built by build(), each under maxBytes. */
export function chunked(items, build, maxBytes = CHUNK_BYTES) {
  const files = []
  let chunk = []
  for (const item of items) {
    chunk.push(item)
    if (chunk.length > 1 && Buffer.byteLength(build(chunk)) > maxBytes) {
      chunk.pop()
      files.push(build(chunk))
      chunk = [item]
    }
  }
  if (chunk.length) files.push(build(chunk))
  return files
}

/** Raw entries -> one record per (type, value), optionally limited to first_seen days. */
export function buildRecords(entries, { from, to, backfillDate }) {
  return latestPerKey(entries)
    .map((e) => toRecord(e, backfillDate))
    .filter((r) => r.value && (!from || (r.first_seen || '') >= from) && (!to || (r.first_seen || '').slice(0, 10) <= to))
    .sort((a, b) => a.metadata.threatfox_id - b.metadata.threatfox_id)
}

function flag(args, name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

async function main(argv) {
  const [cmd, ...args] = argv
  if (cmd === 'fetch' && args[0]) {
    const { abusechApiKey } = await import('./env.mjs')
    if (!abusechApiKey) throw new Error('ABUSECH_API_KEY is not set (.env)')
    const entries = await fetchAll(abusechApiKey, parseIds(flag(args, '--ids')))
    writeFileSync(args[0], JSON.stringify({ fetched_at: new Date().toISOString(), entries }))
    console.log(`wrote ${entries.length} entries to ${args[0]}`)
    return
  }
  if (cmd === 'sql' && args[0] && args[1] && !args[1].startsWith('--')) {
    const { fetched_at, entries } = JSON.parse(readFileSync(args[0], 'utf8'))
    const backfillDate = (fetched_at || new Date().toISOString()).slice(0, 10)
    const records = buildRecords(entries, { from: flag(args, '--from'), to: flag(args, '--to'), backfillDate })
    const prefix = args[1]
    const checks = chunked(records, checkSql)
    checks.forEach((sql, i) => writeFileSync(`${prefix}-check-${i + 1}.sql`, sql))
    const files = chunked(records, insertSql)
    files.forEach((sql, i) => writeFileSync(`${prefix}-${i + 1}.sql`, sql))
    writeFileSync(`${prefix}-undo.sql`, undoSql(backfillDate))
    console.log(
      `${records.length} indicators -> ${checks.length} check file(s), ${files.length} insert file(s), ${prefix}-undo.sql`
    )
    return
  }
  console.error(
    'usage:\n  node scripts/backfill-threatfox.mjs fetch <out.json> [--ids 2039118-2039822,...]\n' +
      '  node scripts/backfill-threatfox.mjs sql <in.json> <out prefix> [--from YYYY-MM-DD] [--to YYYY-MM-DD]'
  )
  process.exit(2)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill-threatfox.mjs')) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
