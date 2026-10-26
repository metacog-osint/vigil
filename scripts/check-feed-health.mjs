/**
 * Fail when a feed marked `critical` is not running.
 *
 * Run as `node scripts/check-feed-health.mjs`. There is no #! line: the file
 * is not executable, and on a Windows checkout a #! line ending in CRLF made
 * vitest fail to parse this file at all.
 *
 * Nothing watched this. ofac-sdn - the feed whose silence matters most, because
 * it is the sanctions list - broke on 20 September 2026 and was still broken on
 * 3 October. Thirteen days, found by a person looking rather than by anything
 * saying so. ioc-geo failed 42 times in the seven days to 4 October the same way.
 *
 * WHY THIS DOES NOT JUST CALL ingestion_is_healthy()
 *
 * That function trips only on `state in ('stale','never')`. A critical feed that
 * errors on every attempt stays `late` until it ages past its interval, so it
 * reads as healthy the whole time - ofac-sdn returned true for eleven of its
 * thirteen broken days. `last_status` is never consulted. This checks it.
 *
 * `late` is deliberately not a failure. The hourly feeds sit at `late` routinely
 * between runs, and a check that cries wolf gets muted - ten retired workflows
 * were disabled on 3 October for exactly that reason.
 *
 * A failed read is also a failure, which covers a second gap: during the
 * 24 September outage every query hung for an hour while the static site kept
 * serving, and nothing noticed. The API gateway answering is not the same thing
 * as the database answering.
 *
 * The anon key is enough - feed_health is readable by `anon`, and that key
 * already ships in the browser bundle. Nothing privileged is used here.
 *
 * `fresh` describes the check, not the data. ransomwhere confirms weekly that a
 * Zenodo deposit published in 2024 has not changed, which is a working feed
 * serving old data. The table says so in its own column (migration 153), so a
 * green run is never read as current ransom-payment figures.
 *
 * ONE ERROR FROM AN HOURLY FEED IS NOT YET A FAILURE
 *
 * ransomlook reads a site behind Cloudflare that times out now and then: 21
 * of its runs failed between 24 and 26 October, twenty with HTTP 524 and one
 * 502, each followed by a success the next hour. Failing on any single error
 * meant an email whenever the twice-daily check landed just after one, about a
 * problem that had already gone away.
 *
 * So a feed that runs hourly or faster must fail twice in a row, counting only
 * runs that actually ran (success or error). One error is listed in the summary
 * and does not fail the job. Anything slower still fails on the first error:
 * ofac-sdn runs daily, and waiting for a second error there means a day
 * without the sanctions list. stale and never still fail regardless.
 *
 * If the recent runs cannot be read, the error counts. The rule exists to
 * spare a blip, not to excuse a feed whose history nobody could check.
 */

const BROKEN_STATES = new Set(['stale', 'never'])

/** At or below this cadence, a single error is not yet a failure. */
export const ONE_ERROR_ALLOWED_AT_MINUTES = 60

export function allowsOneError(f) {
  return (
    typeof f.expected_interval_minutes === 'number' &&
    f.expected_interval_minutes <= ONE_ERROR_ALLOWED_AT_MINUTES
  )
}

/** How many of the newest runs, newest first, are errors in a row. */
export function errorsInARow(statuses) {
  let n = 0
  for (const status of statuses ?? []) {
    if (status !== 'error') break
    n += 1
  }
  return n
}

/**
 * `recent` maps feed_id to that feed's newest run statuses, newest first. It
 * is only needed for hourly feeds whose last status is an error.
 */
export function classify(feeds, recent = {}) {
  const broken = []
  const blips = []

  for (const f of feeds) {
    if (BROKEN_STATES.has(f.state)) {
      broken.push(f)
    } else if (f.last_status !== 'error') {
      continue
    } else if (!allowsOneError(f)) {
      broken.push(f)
    } else {
      const statuses = recent[f.feed_id]
      const unreadable = !Array.isArray(statuses) || statuses.length < 2
      const streak = errorsInARow(statuses)
      if (unreadable || streak >= 2) broken.push(f)
      else if (streak === 1) blips.push(f)
      // streak 0: a run succeeded between the two reads, so it has recovered.
    }
  }

  return {
    broken,
    blips,
    ok: feeds.filter((f) => !broken.includes(f) && !blips.includes(f)),
  }
}

export function hoursSince(minutes) {
  return minutes === null || minutes === undefined ? null : Math.floor(minutes / 60)
}

/**
 * How old the data is, for a source that is a snapshot rather than a stream.
 * null for a live feed: it has no vintage to state, and printing "live" would
 * be a claim this view cannot back.
 */
export function dataAge(f) {
  if (!f.snapshot_version && !f.snapshot_published) return null
  const version = f.snapshot_version ? `snapshot ${f.snapshot_version}` : 'snapshot'
  return f.snapshot_published ? `${version}, published ${f.snapshot_published}` : version
}

function describe(f) {
  const h = hoursSince(f.minutes_since_success)
  const age = h === null ? 'never succeeded' : `last success ${h}h ago`
  const status = f.last_status ?? 'never ran'
  const vintage = dataAge(f) ? ` (data: ${dataAge(f)})` : ''
  const err = f.last_error ? `\n  - \`${String(f.last_error).slice(0, 200)}\`` : ''
  return `- **${f.feed_id}** — state \`${f.state}\`, last status \`${status}\`, ${age}${vintage}${err}`
}

export function table(feeds) {
  const rows = feeds
    .map((f) => {
      const h = hoursSince(f.minutes_since_success)
      const data = dataAge(f) ?? '—'
      return `| ${f.feed_id} | ${f.state} | ${f.last_status ?? 'never ran'} | ${h ?? 'never'} | ${data} |`
    })
    .join('\n')
  return (
    '| Feed | State | Last status | Hours since success | Data |\n' +
    '| --- | --- | --- | --- | --- |\n' +
    rows
  )
}

/**
 * The newest two runs that actually ran, per feed, from sync_log (readable by
 * anon, like feed_health). A feed whose runs cannot be read is left out, and
 * classify() then counts its error rather than excusing it.
 */
async function readRecentRuns(url, key, feedIds) {
  const recent = {}
  for (const id of feedIds) {
    const query =
      `select=status&source=eq.${encodeURIComponent(id)}` +
      '&status=in.(success,error)&order=completed_at.desc&limit=2'
    try {
      const response = await fetch(`${url}/rest/v1/sync_log?${query}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) recent[id] = (await response.json()).map((r) => r.status)
    } catch {
      // Left out on purpose; see above.
    }
  }
  return recent
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('::error::SUPABASE_URL or SUPABASE_ANON_KEY is not set.')
    console.error('Both are public values; the anon key already ships in the browser bundle.')
    process.exit(1)
  }

  const query =
    'select=feed_id,critical,state,last_status,last_error,minutes_since_success,' +
    'expected_interval_minutes,snapshot_version,snapshot_published' +
    '&critical=is.true&order=feed_id'

  let feeds
  try {
    const response = await fetch(`${url}/rest/v1/feed_health?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(`::error::Could not read feed_health (HTTP ${response.status}).`)
      console.error(body.slice(0, 500))
      process.exit(1)
    }
    feeds = await response.json()
  } catch (e) {
    // A hung database lands here. The gateway answering is not the database
    // answering, which is what made the 24 September outage invisible.
    console.error(`::error::Could not reach the database: ${e.message}`)
    process.exit(1)
  }

  if (!Array.isArray(feeds) || feeds.length === 0) {
    console.error('::error::feed_health returned no critical feeds at all.')
    console.error("Either every 'critical' flag has been cleared or the view is empty.")
    process.exit(1)
  }

  const recent = await readRecentRuns(
    url,
    key,
    feeds.filter((f) => f.last_status === 'error' && allowsOneError(f)).map((f) => f.feed_id)
  )
  const { broken, blips } = classify(feeds, recent)

  const summary = [
    '## Critical feed health',
    '',
    broken.length
      ? ['**Broken:**', '', ...broken.map(describe)].join('\n')
      : `All ${feeds.length} critical feeds are running.`,
    '',
    ...(blips.length
      ? [
          '**One error, not failing yet.** Hourly feeds fail on the second error in a row:',
          '',
          ...blips.map(describe),
          '',
        ]
      : []),
    '<details><summary>All critical feeds</summary>',
    '',
    table(feeds),
    '',
    '</details>',
  ].join('\n')

  console.log(summary)

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }

  if (broken.length) {
    console.error(`::error::${broken.length} critical feed(s) not running. See the job summary.`)
    process.exit(1)
  }
}

// Only run when invoked directly, so the helpers above stay testable.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
