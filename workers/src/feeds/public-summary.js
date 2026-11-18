/**
 * The hub's daily line ("Latest from Vigil"), built here each hour and stored in
 * public_summary (175) for GET /api/summary to serve.
 *
 * It reads with the anonymous key (env.SUPABASE_ANON_KEY, a worker secret),
 * never the service role: the public-read policies decide what counts, as they
 * did when /api/summary built the line itself. Without that key the job fails
 * and says why; it does not fall back to the service role.
 *
 * Three reads and one write. A build with nothing true to state leaves the last
 * stored row alone, so its built_at ages and readers can see that it has.
 */

import { readSummary } from '../lib/publicSummary.js'

export async function buildPublicSummary(db, env, now = new Date()) {
  const base = env?.SUPABASE_URL
  const key = env?.SUPABASE_ANON_KEY
  if (!base || !key) {
    return {
      success: false,
      source: 'public-summary',
      error:
        'missing SUPABASE_URL or SUPABASE_ANON_KEY: the summary is read as the public reads it, never with the service role',
    }
  }

  try {
    const { summary, reason } = await readSummary({ base, key, now })
    if (!summary) return { success: true, stored: false, reason }

    const { error } = await db
      .from('public_summary')
      .upsert([{ id: 'latest', built_at: summary.built_at, day: summary.day, summary }], {
        onConflict: 'id',
      })
    if (error) throw new Error(`public_summary upsert: ${error.message}`)
    return { success: true, stored: true, day: summary.day, claims: summary.claims }
  } catch (error) {
    console.error('public summary build error:', error.message)
    return { success: false, source: 'public-summary', error: error.message }
  }
}
