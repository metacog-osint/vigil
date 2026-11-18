/**
 * CISA's SSVC exploitation judgments from Vulnrichment, every hour (176).
 *
 * WHAT IT DOES
 *
 *   1. Reads the commit it last read up to (cisa_vulnrichment_cursor).
 *   2. Asks GitHub which commits on develop came after it (compare API), oldest
 *      first, and which CVE records each changed, until FILE_BUDGET records.
 *   3. Fetches each changed record once, at the newest commit that touched it,
 *      from raw.githubusercontent.com (not counted against the API limit).
 *   4. Reads CISA's SSVC block (_shared/vulnrichment.ts). A CVE marked active
 *      or poc is stored; one already held is updated whatever its value, so a
 *      change back to none is recorded too.
 *   5. Moves the cursor to the last commit it read in full.
 *
 * WHY A TOKEN
 *
 * Raw files cannot list what changed, and GitHub allows 60 unauthenticated API
 * requests an hour per IP, shared with everyone on the same Edge egress. A
 * fine-grained token with read access to public repositories only, and no
 * other permission, gives 5,000. Secret: GITHUB_PUBLIC_READ_TOKEN.
 *
 * WHY AN EDGE FUNCTION
 *
 * A busy hour changes hundreds of records, each a fetch. The worker shares its
 * subrequests across every feed; one call from there, the rest here.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { cveFromPath, readSsvc, worthStoring, type SsvcRow } from '../_shared/vulnrichment.ts'

const REPO = 'cisagov/vulnrichment'
const BRANCH = 'develop'
const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const UA = 'Vigil-ThreatIntel/1.0'
// Records fetched per run. A run that stops at the budget leaves the cursor on
// the last commit it read in full, and the next run carries on from there.
const FILE_BUDGET = 1500
const CONCURRENCY = 8
const ID_CHUNK = 500

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function gh(path: string, token: string) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': UA,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    throw new Error(
      `GitHub ${path.split('?')[0]} HTTP ${response.status} (rate remaining ${remaining})`
    )
  }
  return await response.json()
}

async function raw(sha: string, path: string) {
  const response = await fetch(`${RAW}/${REPO}/${sha}/${path}`, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`raw ${path} HTTP ${response.status}`)
  return await response.json()
}

/** Runs fn over items, at most `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

Deno.serve(async () => {
  const started = Date.now()
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = Deno.env.get('GITHUB_PUBLIC_READ_TOKEN')
  if (!url || !key) {
    return json(
      { success: false, source: 'cisa-vulnrichment', error: 'missing SUPABASE_URL or key' },
      500
    )
  }
  if (!token) {
    return json(
      {
        success: false,
        source: 'cisa-vulnrichment',
        error: 'missing GITHUB_PUBLIC_READ_TOKEN secret',
      },
      500
    )
  }
  const supabase = createClient(url, key)

  try {
    // 1. Where the last run stopped.
    const { data: cursor, error: cursorError } = await supabase
      .from('cisa_vulnrichment_cursor')
      .select('commit_sha, committed_at')
      .eq('id', BRANCH)
      .maybeSingle()
    if (cursorError) throw new Error(`cursor read: ${cursorError.message}`)
    if (!cursor) throw new Error('no cursor row: load the backfill first (176)')

    // 2. The commits after it, oldest first, and the records each changed.
    const compare = await gh(
      `/repos/${REPO}/compare/${cursor.commit_sha}...${BRANCH}?per_page=100`,
      token
    )
    const commits: { sha: string; commit: { committer: { date: string } } }[] =
      compare?.commits ?? []
    if (commits.length === 0) {
      return json({
        success: true,
        source: 'cisa-vulnrichment',
        commits: 0,
        added: 0,
        updated: 0,
        ms: Date.now() - started,
      })
    }

    const latest = new Map<string, { sha: string; path: string }>() // cve -> newest commit touching it
    let readUpTo: { sha: string; date: string } | null = null
    let budgetStop = false
    for (const c of commits) {
      const paths: string[] = []
      for (let page = 1; page <= 10; page++) {
        const detail = await gh(`/repos/${REPO}/commits/${c.sha}?per_page=300&page=${page}`, token)
        const files: { filename: string; status: string }[] = detail?.files ?? []
        for (const f of files) if (f.status !== 'removed') paths.push(f.filename)
        if (files.length < 300) break
      }
      const cves = paths.map((p) => [cveFromPath(p), p] as const).filter(([id]) => id)
      const fresh = cves.filter(([id]) => !latest.has(id as string)).length
      if (readUpTo && latest.size + fresh > FILE_BUDGET) {
        budgetStop = true
        break
      }
      for (const [id, p] of cves) latest.set(id as string, { sha: c.sha, path: p })
      readUpTo = { sha: c.sha, date: c.commit.committer.date }
    }

    // 3 and 4. Fetch, read, and decide what to keep.
    const targets = [...latest.entries()]
    let unreadable = 0
    let fetchErrors = 0
    const rows = (
      await pool(targets, CONCURRENCY, async ([, t]) => {
        let record
        try {
          record = await raw(t.sha, t.path)
        } catch (_e) {
          fetchErrors++
          return null
        }
        const row = readSsvc(record)
        if (!row) unreadable++
        return row ? { ...row, source_commit: t.sha } : null
      })
    ).filter((r): r is SsvcRow & { source_commit: string } => r !== null)

    const held = new Set<string>()
    const ids = rows.map((r) => r.cve_id)
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await supabase
        .from('cisa_ssvc')
        .select('cve_id')
        .in('cve_id', ids.slice(i, i + ID_CHUNK))
      if (error) throw new Error(`cisa_ssvc read: ${error.message}`)
      for (const r of data ?? []) held.add(r.cve_id)
    }
    const write = rows
      .filter((r) => held.has(r.cve_id) || worthStoring(r))
      .map((r) => ({ ...r, fetched_at: new Date().toISOString() }))
    const added = write.filter((r) => !held.has(r.cve_id)).length

    for (let i = 0; i < write.length; i += ID_CHUNK) {
      const { error } = await supabase
        .from('cisa_ssvc')
        .upsert(write.slice(i, i + ID_CHUNK), { onConflict: 'cve_id' })
      if (error) throw new Error(`cisa_ssvc upsert: ${error.message}`)
    }

    // 5. Move the cursor only past what was read in full. A record that could
    // not be fetched keeps the cursor where it was, so the next run reads it
    // again; the rows written above are written again, harmlessly.
    if (fetchErrors > 0) {
      return json(
        {
          success: false,
          source: 'cisa-vulnrichment',
          error: `${fetchErrors} of ${targets.length} records could not be fetched; cursor left at ${cursor.commit_sha}`,
          added,
          updated: write.length - added,
          ms: Date.now() - started,
        },
        500
      )
    }
    if (readUpTo) {
      const { error } = await supabase
        .from('cisa_vulnrichment_cursor')
        .upsert(
          [
            {
              id: BRANCH,
              commit_sha: readUpTo.sha,
              committed_at: readUpTo.date,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'id' }
        )
      if (error) throw new Error(`cursor write: ${error.message}`)
    }

    return json({
      success: true,
      source: 'cisa-vulnrichment',
      commits: commits.length,
      stopped_at_budget: budgetStop,
      records_changed: targets.length,
      unreadable,
      active: write.filter((r) => r.exploitation === 'active').length,
      poc: write.filter((r) => r.exploitation === 'poc').length,
      // The scheduler logs `added` as records_added and `updated` as records_updated.
      added,
      updated: write.length - added,
      cursor: readUpTo?.sha ?? cursor.commit_sha,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: 'cisa-vulnrichment', error: (e as Error).message }, 500)
  }
})
