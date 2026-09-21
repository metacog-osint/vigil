/**
 * Keep the end-to-end suite off the production database.
 *
 * The app under test runs locally in CI, but VITE_SUPABASE_URL points at the
 * live project — so every test's setup loaded the landing page, which queries
 * that database over the network before demo mode is even entered.
 *
 * That made the suite's result depend on what else was touching Supabase at the
 * time. On 20 September it cost three merge cycles in one evening: chromium
 * failed `settings.spec.js:46` on one PR, firefox failed the same spec plus
 * `vulnerabilities.spec.js:22` on another, and both passed on a re-run with no
 * code changed. A suite that fails for reasons unrelated to the diff teaches
 * people to re-run it, which is how a real failure gets waved through.
 *
 * So the network boundary is stubbed. Demo mode supplies the fixtures the tests
 * actually assert against; this only has to make sure nothing reaches the real
 * project and that the app gets well-formed answers rather than hangs.
 *
 * Most tables answer with an empty list, which Vigil renders honestly - an em
 * dash rather than a zero. The handful of tables the list pages actually draw
 * get a couple of synthetic rows instead, so the suite tests a rendered table
 * rather than whichever browser renders an empty state most generously.
 */

/**
 * A few rows per table, so pages render content rather than an empty state.
 *
 * Returning [] for everything made the suite test empty states exclusively,
 * which is both less useful and fragile: `incidents.spec.js` asserts that the
 * page shows either statistics or a table, and with no rows it showed neither.
 * That passed on chromium and firefox - where the selectors happened to match
 * something - and failed on webkit. A test that depends on which browser
 * renders an empty state most generously is not testing anything.
 *
 * These are shaped from the real column lists, not invented. They are
 * deliberately few and obviously synthetic: the point is that a table renders,
 * not that the numbers mean anything.
 */
const ROWS = {
  incidents: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      actor_id: '00000000-0000-4000-8000-0000000000a1',
      victim_name: 'Example Manufacturing Ltd',
      victim_sector: 'manufacturing',
      victim_country: 'DE',
      discovered_date: '2026-09-18',
      incident_date: '2026-09-17',
      status: 'claimed',
      data_leaked: true,
      source: 'e2e-fixture',
      threat_actor: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Fixture Group' },
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      actor_id: '00000000-0000-4000-8000-0000000000a1',
      victim_name: 'Example Health Systems',
      victim_sector: 'healthcare',
      victim_country: 'US',
      discovered_date: '2026-09-16',
      incident_date: '2026-09-15',
      status: 'claimed',
      data_leaked: false,
      source: 'e2e-fixture',
      threat_actor: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Fixture Group' },
    },
  ],
  threat_actors: [
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      name: 'Fixture Group',
      aliases: ['FixtureGang'],
      actor_type: 'Ransomware',
      status: 'active',
      trend_status: 'ESCALATING',
      incidents_7d: 12,
      incidents_prev_7d: 5,
      incident_velocity: 1.7,
      target_sectors: ['manufacturing', 'healthcare'],
      origin_country: 'RU',
      origin_confidence: 'medium',
      first_seen: '2024-01-01',
      last_seen: '2026-09-18',
      source: 'e2e-fixture',
    },
  ],
  vulnerabilities: [
    {
      cve_id: 'CVE-2026-00001',
      description: 'A fixture vulnerability used by the end-to-end suite.',
      cvss_score: 9.1,
      severity: 'critical',
      is_kev: true,
      kev_date: '2026-09-10',
      source: 'e2e-fixture',
    },
  ],
}

/** The table a PostgREST url is addressing, or null for an rpc. */
function tableOf(url) {
  const match = url.match(/\/rest\/v1\/([a-zA-Z0-9_]+)/)
  return match ? match[1] : null
}

/** PostgREST returns the row count in a header; supabase-js reads it from there. */
function restHeaders(rowCount = 0) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'content-range': `0-${Math.max(rowCount - 1, 0)}/${rowCount}`,
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-range',
  }
}

/**
 * Intercept everything bound for Supabase.
 *
 * Call before the first navigation. Routes are matched most-specific first, so
 * a test that needs particular rows can add its own page.route() afterwards and
 * it will take precedence.
 */
export async function stubSupabase(page) {
  // Auth: no session. Demo mode does not sign anyone in, and a test that wants
  // a signed-in user should say so explicitly rather than inherit one.
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: null, user: null }),
    })
  )

  // Stored procedures: an empty result, shaped as a list.
  await page.route('**/rest/v1/rpc/**', (route) =>
    route.fulfill({ status: 200, headers: restHeaders(0), body: '[]' })
  )

  // Table reads and writes.
  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method()

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: restHeaders(0), body: '' })
    }

    // A write in a test must not reach the real project. Answer as PostgREST
    // does for a successful insert that returns nothing.
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      return route.fulfill({ status: 201, headers: restHeaders(0), body: '[]' })
    }

    const rows = ROWS[tableOf(route.request().url())] ?? []
    return route.fulfill({
      status: 200,
      headers: restHeaders(rows.length),
      body: JSON.stringify(rows),
    })
  })

  // Realtime: let the socket fail closed rather than hang holding the page open.
  await page.route('**/realtime/v1/**', (route) => route.abort())

  // Edge functions.
  await page.route('**/functions/v1/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stubbed: true }),
    })
  )
}
