/**
 * GET /api/summary — one sentence about Vigil's latest complete day, for
 * The Intelligence Company's home page. Public, no key, CORS open.
 *
 * Reads with the anonymous key under the public-read policies, as /api/feed
 * does: claims from incidents_commercial, group names from
 * threat_actors_commercial, ingestion runs from sync_log. Never the service
 * role, which would count rows the public policies keep out (placeholders that
 * are not victims). Cached for an hour at the edge, so the hub's visitors do
 * not reach the database. Built by api/_lib/publicSummary.js, which says what
 * is counted and why.
 *
 * Any failure is a 503 with no detail; the hub ignores it and keeps its own line.
 */

import { buildSummary, latestConfirmedDay, runsSince, tallyGroups } from './_lib/publicSummary.js'

export const config = { runtime: 'edge' }

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  })

const unavailable = () =>
  json(503, { error: 'Summary temporarily unavailable' }, { 'Cache-Control': 'no-store' })

async function rest(base, key, path, { count = false } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  if (count) headers.Prefer = 'count=exact'
  const res = await fetch(`${base}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status}`)
  const rows = await res.json()
  if (!count) return rows
  // "0-42/43", or "*/0" for none. Anything else is a count the database did not give.
  const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '')
  return { rows, count: m ? Number(m[1]) : null }
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' })

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !key) return unavailable()

  const now = new Date()
  try {
    const runs = await rest(
      base,
      key,
      `sync_log?select=completed_at&source=eq.ransomlook&status=eq.success&completed_at=gte.${runsSince(now)}&order=completed_at.asc&limit=1000`
    )
    const pick = latestConfirmedDay(
      runs.map((r) => r.completed_at),
      now
    )
    if (!pick) {
      console.error('summary: no day with confirmed RansomLook ingestion')
      return unavailable()
    }

    const { rows, count } = await rest(
      base,
      key,
      `incidents_commercial?select=actor_id&discovered_date=eq.${pick.day}&limit=1000`,
      { count: true }
    )
    // Names only for the group(s) the sentence would name, and only if the tally is whole.
    const leaders = rows.length === count ? tallyGroups(rows).leaders : []
    const listed = leaders.length
      ? await rest(
          base,
          key,
          `threat_actors_commercial?select=actor_id,name&actor_id=in.(${leaders.join(',')})`
        )
      : []
    const names = Object.fromEntries(listed.map((r) => [r.actor_id, r.name]))

    const summary = buildSummary({ ...pick, claims: count, rows, names }, now)
    if (!summary) {
      console.error(`summary: nothing to state for ${pick.day} (count ${count})`)
      return unavailable()
    }
    return json(200, summary, { 'Cache-Control': CACHE })
  } catch (err) {
    // The cause goes to the server log only: a public response must not reveal internals.
    console.error('summary: build failed', err)
    return unavailable()
  }
}
