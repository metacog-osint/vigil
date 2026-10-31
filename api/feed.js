/**
 * GET /api/feed — Vigil's current picture in feed contract v2 (tic-feed/2), as GeoJSON.
 *
 * Public and read-only: it reads with the anonymous key under the public-read policies,
 * claims and group names only from the *_commercial views, and is cached for 15 minutes
 * at the edge so a busy reader cannot load the database. Built by api/_lib/doctrineFeed.js.
 */

import { buildFeed, countFromRange } from './_lib/doctrineFeed.js'

export const config = { runtime: 'edge' }

const DAY_MS = 86400000
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  })

/**
 * With `count`, PostgREST also counts every row the filters match, in the same statement as
 * the capped page, and reports it in Content-Range. The summary states that count, never the
 * number of rows returned (docs/SESSION_HANDOFF.md §2b). Measured as anon on 31 Oct 2026: under
 * 3 ms for all three windows, 370 ms over 60 days, against the 3 s anon statement timeout.
 * A page cut short by its limit comes back 206 Partial Content, which res.ok accepts.
 */
async function rest(base, key, path, { count = false } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  if (count) headers.Prefer = 'count=exact'
  const res = await fetch(`${base}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status}`)
  const rows = await res.json()
  return count ? { rows, count: countFromRange(res.headers.get('content-range')) } : rows
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' })

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !key) return json(503, { error: 'Feed not configured' })

  const now = new Date()
  const since2 = new Date(now - 2 * DAY_MS).toISOString().slice(0, 10)
  const since7 = new Date(now - 7 * DAY_MS).toISOString().slice(0, 10)
  try {
    const [escalating, claimsPage, kevPage, disclosuresPage] = await Promise.all([
      rest(
        base,
        key,
        'threat_actors?select=id,incidents_7d&trend_status=eq.ESCALATING&status=eq.active&order=incidents_7d.desc&limit=50'
      ),
      rest(
        base,
        key,
        `incidents_commercial?select=incident_id,actor_id,victim_name,discovered_date,victim_country,victim_country_withheld,victim_sector&discovered_date=gte.${since2}&order=discovered_date.desc&limit=300`,
        { count: true }
      ),
      rest(
        base,
        key,
        `vulnerabilities?select=cve_id,kev_date,epss_score,epss_date,cvss_score,ransomware_use,ransomware_campaign_use,vendor,product,description&kev_date=gte.${since7}&order=kev_date.desc&limit=100`,
        { count: true }
      ),
      rest(
        base,
        key,
        `victim_disclosures?select=id,company_name,source,form,filed_date,first_seen,persons_affected,persons_affected_scope,filing_url,match_status&first_seen=gte.${since7}T00:00:00Z&order=first_seen.desc&limit=200`,
        { count: true }
      ),
    ])
    const claims = claimsPage.rows
    const kev = kevPage.rows
    const disclosures = disclosuresPage.rows
    const counts = {
      claims: claimsPage.count,
      kev: kevPage.count,
      disclosures: disclosuresPage.count,
    }
    const ids = [
      ...new Set(
        [...escalating.map((a) => a.id), ...claims.map((c) => c.actor_id)].filter(Boolean)
      ),
    ]
    const listed = ids.length
      ? await rest(
          base,
          key,
          `threat_actors_commercial?select=actor_id,name&actor_id=in.(${ids.join(',')})`
        )
      : []
    const actorNames = Object.fromEntries(listed.map((r) => [r.actor_id, r.name]))
    // A group whose name only a restricted source supplied stays out of the feed.
    const actors = escalating
      .filter((a) => actorNames[a.id])
      .map((a) => ({ ...a, name: actorNames[a.id] }))
    const feed = buildFeed({ actors, claims, actorNames, kev, disclosures, counts }, now)
    return new Response(JSON.stringify(feed), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    // The cause goes to the server log only: a public response must not reveal internals.
    console.error('feed: build failed', err)
    return json(503, { error: 'Feed temporarily unavailable' })
  }
}
