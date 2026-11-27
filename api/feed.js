/**
 * GET /api/feed — Vigil's current picture in feed contract v2 (tic-feed/2), as GeoJSON.
 *
 * Public and read-only: it reads with the anonymous key under the public-read policies,
 * claims and group names only from the *_commercial views, and is cached for 15 minutes
 * at the edge so a busy reader cannot load the database. Built by api/_lib/doctrineFeed.js.
 */

import {
  buildFeed,
  countFromRange,
  healthBlock,
  HEALTH_FEEDS,
  windowStarts,
} from './_lib/doctrineFeed.js'
import { buildStixBundle, loadStixRows, parseDays, STIX_DAYS } from './_lib/stixFeed.js'

export const config = { runtime: 'edge' }

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
 * 3 ms for each of the four counts, and 370 ms for the three windows over 60 days, against the
 * 3 s anon statement timeout.
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
  const params = new URL(request.url).searchParams
  if (params.get('format') === 'stix') {
    const days = parseDays(params.get('days'))
    if (days === null) {
      return json(400, { error: `days must be one of ${STIX_DAYS.join(', ')}` })
    }
    try {
      const rows = await loadStixRows((path, opts) => rest(base, key, path, opts), days, now)
      const bundle = await buildStixBundle(rows, now)
      return new Response(JSON.stringify(bundle), {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': 'application/stix+json;version=2.1',
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        },
      })
    } catch (err) {
      console.error('feed: STIX build failed', err)
      return json(503, { error: 'Feed temporarily unavailable' })
    }
  }

  // The summary names each window by these same dates.
  const since = windowStarts(now)
  try {
    const [
      escalatingPage,
      claimsPage,
      kevPage,
      adpPage,
      icsPage,
      disclosuresPage,
      earlierPage,
      latePage,
      healthRows,
    ] = await Promise.all([
      rest(
        base,
        key,
        // VG-IND-1 (migration 179): unusual against the group's own 8 weeks, not 077's trend_status.
        'threat_actors?select=id,surge_claims_7d,surge_days_7d,surge_baseline_mean,surge_p,surge_new_group,surge_window_end,surge_flagged_at&surge=is.true&status=eq.active&order=surge_claims_7d.desc&limit=50',
        { count: true }
      ),
      rest(
        base,
        key,
        `incidents_commercial?select=incident_id,actor_id,victim_name,discovered_date,victim_country,victim_country_withheld,victim_sector&discovered_date=gte.${since.claims}&order=discovered_date.desc&limit=300`,
        { count: true }
      ),
      rest(
        base,
        key,
        `vulnerabilities?select=cve_id,kev_date,epss_score,epss_date,cvss_score,ransomware_use,ransomware_campaign_use,vendor,product,description&kev_date=gte.${since.kev}&order=kev_date.desc&limit=100`,
        { count: true }
      ),
      // CISA's ADP ratings of exploitation active (cisa_ssvc, 176; public read 177), by when CISA
      // assessed them. A re-assessment that keeps "active" lists the CVE again. Its failure never
      // fails the feed: the items are left out and the summary says the count is unavailable.
      rest(
        base,
        key,
        `cisa_ssvc?select=cve_id,assessed_at,automatable,technical_impact&exploitation=eq.active&assessed_at=gte.${since.adp}T00:00:00Z&order=assessed_at.desc&limit=100`,
        { count: true }
      ).catch((err) => {
        console.error('feed: CISA ADP read failed', err)
        return { rows: [], count: null }
      }),
      // CISA's ICS advisories, by publication date. Their failure never fails the feed.
      rest(
        base,
        key,
        `ics_advisories?select=advisory_id,title,published_date,source_url,cvss_score,cve_ids&published_date=gte.${since.ics}&order=published_date.desc,advisory_id.desc&limit=100`,
        { count: true }
      ).catch((err) => {
        console.error('feed: CISA ICS read failed', err)
        return { rows: [], count: null }
      }),
      rest(
        base,
        key,
        // HHS OCR (192) stays out until about a week of clean daily runs, as 191's sources did, and
        // so its backfill of 8,092 reports first seen on one day is never served as new.
        // By filing date, not first_seen: a registry's first read brings years of old notices in
        // one day, and the 19 Nov 2026 backfill made 37 new notices read as 8,730.
        `victim_disclosures?select=id,company_name,source,form,filed_date,first_seen,persons_affected,persons_affected_scope,filing_url,match_status&filed_date=gte.${since.disclosures}&source=neq.hhs-ocr&order=filed_date.desc,first_seen.desc&limit=200`,
        { count: true }
      ),
      // Notices first seen in the window but filed before it: a backfill, or a registry posting
      // late. Counted only, so the summary can say they are not new. Its failure only drops that
      // clause.
      rest(
        base,
        key,
        `victim_disclosures?select=id&first_seen=gte.${since.disclosures}T00:00:00Z&filed_date=lt.${since.disclosures}&source=neq.hhs-ocr&limit=1`,
        { count: true }
      ).catch((err) => {
        console.error('feed: earlier-filed disclosure count failed', err)
        return { rows: [], count: null }
      }),
      // Of those, the ones filed up to LATE_NOTICE_DAYS before the window are listed: a registry that
      // posts a notice weeks after filing (Washington and Oregon often do). Without this a notice filed
      // more than seven days before Vigil first saw it never became an item. Its failure only drops
      // those items.
      rest(
        base,
        key,
        `victim_disclosures?select=id,company_name,source,form,filed_date,first_seen,persons_affected,persons_affected_scope,filing_url,match_status&first_seen=gte.${since.disclosures}T00:00:00Z&and=(filed_date.gte.${since.disclosuresLate},filed_date.lt.${since.disclosures})&source=neq.hhs-ocr&order=first_seen.desc,filed_date.desc&limit=100`,
        { count: true }
      ).catch((err) => {
        console.error('feed: late-posted disclosure read failed', err)
        return { rows: [], count: null }
      }),
      // The health block (migration 163). Its failure never fails the feed: without it the feed is
      // what it was before 163, and COP counts every lane as read. 29 ms warm, measured 15 Nov 2026.
      rest(
        base,
        key,
        `feed_health?select=feed_id,state,last_status,last_success_at,last_attempt_at,stall_after_minutes,last_new_at,stalled,new_counted_since,min_rows_per_run,last_rows,below_floor&feed_id=in.(${HEALTH_FEEDS.join(',')})`
      ).catch((err) => {
        console.error('feed: health read failed', err)
        return null
      }),
    ])
    const escalating = escalatingPage.rows
    const claims = claimsPage.rows
    const kev = kevPage.rows
    const disclosures = disclosuresPage.rows
    const ics = icsPage.rows
    // Escalating groups are counted before the filter below, so a group the feed cannot name
    // still counts: the summary then says how many of them the feed names.
    const counts = {
      actors: escalatingPage.count,
      claims: claimsPage.count,
      kev: kevPage.count,
      adp: adpPage.count,
      ics: icsPage.count,
      disclosures: disclosuresPage.count,
      disclosuresFiledEarlier: earlierPage.count,
      disclosuresLate: latePage.count,
    }
    const lateDisclosures = latePage.rows
    const ids = [
      ...new Set(
        [...escalating.map((a) => a.id), ...claims.map((c) => c.actor_id)].filter(Boolean)
      ),
    ]
    const escalatingIds = [...new Set(escalating.map((a) => a.id).filter(Boolean))]
    const [listed, origins] = await Promise.all([
      ids.length
        ? rest(
            base,
            key,
            `threat_actors_commercial?select=actor_id,name&actor_id=in.(${ids.join(',')})`
          )
        : [],
      escalatingIds.length
        ? rest(
            base,
            key,
            `actor_origins_commercial?select=actor_id,origin_country,origin_source&actor_id=in.(${escalatingIds.join(',')})`
          )
        : [],
    ])
    // KEV status and the product, for the ADP rows. A CVE Vigil does not hold is not in KEV: the
    // cisa-kev job writes every entry in CISA's catalog.
    const adpIds = adpPage.rows.map((r) => r.cve_id).filter(Boolean)
    // Without KEV status no item is published: a failed lookup must not read as "not in KEV".
    const adpVulns = adpIds.length
      ? await rest(
          base,
          key,
          `vulnerabilities?select=cve_id,is_kev,kev_date,vendor,product,description&cve_id=in.(${adpIds.join(',')})`
        ).catch((err) => {
          console.error('feed: KEV status for CISA ADP rows failed', err)
          return null
        })
      : []
    if (adpVulns === null) counts.adp = null
    const vulnById = Object.fromEntries((adpVulns || []).map((v) => [v.cve_id, v]))
    const adp = (adpVulns === null ? [] : adpPage.rows).map((r) => {
      const v = vulnById[r.cve_id]
      return {
        ...r,
        in_kev: v?.is_kev === true,
        kev_date: v?.kev_date || null,
        vendor: v?.vendor || null,
        product: v?.product || null,
        description: v?.description || null,
      }
    })
    const actorNames = Object.fromEntries(listed.map((r) => [r.actor_id, r.name]))
    const actorOrigins = Object.fromEntries(
      origins.map((r) => [
        r.actor_id,
        { origin_country: r.origin_country || null, origin_source: r.origin_source || null },
      ])
    )
    // A group whose name only a restricted source supplied stays out of the feed.
    const actors = escalating
      .filter((a) => actorNames[a.id])
      .map((a) => ({
        ...a,
        name: actorNames[a.id],
        ...(actorOrigins[a.id] || {}),
      }))
    const health = healthBlock(healthRows)
    const feed = buildFeed(
      { actors, claims, actorNames, kev, adp, ics, disclosures, lateDisclosures, counts, health },
      now
    )
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
