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
 * An empty result is a legitimate answer here, not a failure being disguised:
 * Vigil renders absence honestly (an em dash, not a zero), so a page fed empty
 * arrays still renders the structure these tests check.
 */

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

    return route.fulfill({ status: 200, headers: restHeaders(0), body: '[]' })
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
