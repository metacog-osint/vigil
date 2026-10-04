#!/usr/bin/env node
/**
 * Fail when a feed marked `critical` is not running.
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
 */

const BROKEN_STATES = new Set(['stale', 'never'])

export function classify(feeds) {
  const broken = feeds.filter(
    (f) => f.last_status === 'error' || BROKEN_STATES.has(f.state)
  )
  return { broken, ok: feeds.filter((f) => !broken.includes(f)) }
}

export function hoursSince(minutes) {
  return minutes === null || minutes === undefined ? null : Math.floor(minutes / 60)
}

function describe(f) {
  const h = hoursSince(f.minutes_since_success)
  const age = h === null ? 'never succeeded' : `last success ${h}h ago`
  const status = f.last_status ?? 'never ran'
  const err = f.last_error ? `\n  - \`${String(f.last_error).slice(0, 200)}\`` : ''
  return `- **${f.feed_id}** — state \`${f.state}\`, last status \`${status}\`, ${age}${err}`
}

function table(feeds) {
  const rows = feeds
    .map((f) => {
      const h = hoursSince(f.minutes_since_success)
      return `| ${f.feed_id} | ${f.state} | ${f.last_status ?? 'never ran'} | ${h ?? 'never'} |`
    })
    .join('\n')
  return `| Feed | State | Last status | Hours since success |\n| --- | --- | --- | --- |\n${rows}`
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
    'select=feed_id,critical,state,last_status,last_error,minutes_since_success' +
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

  const { broken } = classify(feeds)

  const summary = [
    '## Critical feed health',
    '',
    broken.length
      ? ['**Broken:**', '', ...broken.map(describe)].join('\n')
      : `All ${feeds.length} critical feeds are running.`,
    '',
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
