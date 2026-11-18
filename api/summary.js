/**
 * GET /api/summary — one sentence about Vigil's latest complete day, for
 * The Intelligence Company's home page. Public, no key, CORS open.
 *
 * Serves the summary the worker's public-summary job built and stored in
 * public_summary (175), read with the anonymous key. It is built hourly from
 * the same public reads this endpoint used to make on every request
 * (api/_lib/publicSummary.js says what is counted and why). So `built_at` is
 * when the worker last built it, not when this request came in: if the worker
 * stops, built_at stops with it, and the hub and COP can see that.
 *
 * A stored summary whose day is older than any day the builder could pick
 * (LOOKBACK_DAYS) is not served as the latest. Any failure is a 503 with no
 * detail; the hub ignores it and keeps its own line.
 */

import { isServable } from './_lib/publicSummary.js'

export const config = { runtime: 'edge' }

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
// The row changes at most hourly. A short edge cache keeps built_at close to the truth.
const CACHE = 'public, s-maxage=900, stale-while-revalidate=3600'

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  })

const unavailable = () =>
  json(503, { error: 'Summary temporarily unavailable' }, { 'Cache-Control': 'no-store' })

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' })

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !key) return unavailable()

  try {
    const res = await fetch(`${base}/rest/v1/public_summary?select=summary&id=eq.latest`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`public_summary: HTTP ${res.status}`)
    const rows = await res.json()
    const summary = Array.isArray(rows) ? rows[0]?.summary : null
    if (!summary) {
      console.error('summary: no stored summary')
      return unavailable()
    }
    if (!isServable(summary)) {
      console.error(`summary: stored day ${summary.day} is too old to call the latest`)
      return unavailable()
    }
    return json(200, summary, { 'Cache-Control': CACHE })
  } catch (err) {
    // The cause goes to the server log only: a public response must not reveal internals.
    console.error('summary: read failed', err)
    return unavailable()
  }
}
