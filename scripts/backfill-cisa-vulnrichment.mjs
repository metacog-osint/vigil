/**
 * One-time backfill of cisa_ssvc from a local clone of cisagov/vulnrichment (176).
 *
 *   git clone --depth 1 --branch develop https://github.com/cisagov/vulnrichment.git <clone>
 *   node scripts/backfill-cisa-vulnrichment.mjs <clone> [--env <path to .env>] [--dry-run]
 *
 * Reads every CVE record in the clone with the same parser the Edge Function
 * uses (supabase/functions/_shared/vulnrichment.ts; Node 24 strips the types),
 * keeps the CVEs CISA marks Exploitation active or poc, upserts them over REST
 * with the service role, and sets the job's cursor to the clone's commit so the
 * hourly cisa-vulnrichment job starts from there.
 *
 * Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the .env given
 * (default: the shared checkout's). Prints counts only, never a key.
 */
import { readFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { readSsvc, worthStoring } from '../supabase/functions/_shared/vulnrichment.ts'

const args = process.argv.slice(2)
const clone = args.find((a) => !a.startsWith('--'))
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env'
const dryRun = args.includes('--dry-run')
if (!clone) {
  console.error(
    'usage: node scripts/backfill-cisa-vulnrichment.mjs <clone> [--env <path>] [--dry-run]'
  )
  process.exit(2)
}

function readEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Every CVE record at the clone's HEAD, read from git's own objects with one
 * `git cat-file --batch` rather than by opening 223,000 files (which took
 * longer than 28 minutes on 18 Nov 2026).
 */
async function* records() {
  const listing = execFileSync('git', ['-C', clone, 'ls-tree', '-r', 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  const shas = []
  for (const line of listing.split('\n')) {
    const m = /^\d+ blob ([0-9a-f]{40})\t(.*)$/.exec(line)
    if (m && /(^|\/)CVE-\d{4}-\d{4,}\.json$/.test(m[2])) shas.push(m[1])
  }
  const cat = spawn('git', ['-C', clone, 'cat-file', '--batch'])
  cat.stdin.end(shas.join('\n') + '\n')
  let buf = Buffer.alloc(0)
  for await (const chunk of cat.stdout) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk
    for (;;) {
      const nl = buf.indexOf(10)
      if (nl < 0) break
      const size = Number(buf.subarray(0, nl).toString().split(' ')[2])
      if (buf.length < nl + 1 + size + 1) break
      yield buf.subarray(nl + 1, nl + 1 + size).toString('utf8')
      buf = buf.subarray(nl + 1 + size + 1)
    }
  }
}

const git = (...a) => execFileSync('git', ['-C', clone, ...a], { encoding: 'utf8' }).trim()
const commit = git('rev-parse', 'HEAD')
const committedAt = git('log', '-1', '--format=%cI')

const counts = { files: 0, unreadable: 0, none: 0, poc: 0, active: 0, active_not_kev: 0 }
const rows = []
for await (const text of records()) {
  counts.files++
  let row
  try {
    row = readSsvc(JSON.parse(text))
  } catch {
    row = null
  }
  if (!row) {
    counts.unreadable++
    continue
  }
  counts[row.exploitation]++
  if (row.exploitation === 'active' && !row.kev_date_added) counts.active_not_kev++
  if (worthStoring(row)) rows.push({ ...row, source_commit: commit })
}
console.log(JSON.stringify({ commit, committed_at: committedAt, ...counts, to_store: rows.length }))
if (dryRun) process.exit(0)

const env = readEnv(envPath)
const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !key) {
  console.error(`missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envPath}`)
  process.exit(1)
}
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
}

async function upsert(table, body, onConflict) {
  const r = await fetch(`${base}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${table} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
}

const CHUNK = 1000
let written = 0
for (let i = 0; i < rows.length; i += CHUNK) {
  await upsert('cisa_ssvc', rows.slice(i, i + CHUNK), 'cve_id')
  written += Math.min(CHUNK, rows.length - i)
}
await upsert(
  'cisa_vulnrichment_cursor',
  [
    {
      id: 'develop',
      commit_sha: commit,
      committed_at: committedAt,
      updated_at: new Date().toISOString(),
    },
  ],
  'id'
)
console.log(JSON.stringify({ written, cursor: commit }))
