/**
 * Vigil Threat Intelligence - Cloudflare Worker
 *
 * Handles scheduled data ingestion via Cron Triggers.
 * Replaces GitHub Actions for $0 operating cost.
 *
 * Every trigger runs the same scheduler (lib/scheduler.js) over the job registry
 * (feeds/registry.js). Which feeds run is decided by how overdue they are and how
 * much of the invocation's subrequest budget is left, not by which cron they were
 * listed under. See the registry for why.
 */

import { JOBS, JOBS_BY_ID } from './feeds/registry.js'
import { runDueJobs, runJob, createTimeBudget } from './lib/scheduler.js'
import { createSupabaseClient, createSubrequestBudget } from './lib/supabase.js'

// Workers Free refuses the 51st subrequest of an invocation. The reserve covers
// this run's own bookkeeping - reading feed_health, a sync_log row per job, the
// summary row - plus the fetch() calls feeds make directly, which the client
// cannot see and so cannot count.
const SUBREQUEST_LIMIT = 50
const SUBREQUEST_RESERVE = 18

export default {
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    const trigger = event.cron
    const startTime = Date.now()

    // Two clients on purpose. Feeds get the budgeted one and are cut off before
    // the platform cuts them off; recording what they did goes through the
    // unbudgeted one, because that write must never be the one that is refused.
    const budget = createSubrequestBudget({
      limit: SUBREQUEST_LIMIT,
      reserve: SUBREQUEST_RESERVE
    })
    const feedDb = createSupabaseClient(env, { budget })
    const logDb = createSupabaseClient(env)

    // The other ceiling. A Cron Trigger gets 15 minutes of wall clock and is cut
    // off without an error to catch, so the scheduler stops admitting jobs while
    // there is still room to record the run.
    const clock = createTimeBudget()

    console.log(`[${new Date().toISOString()}] Cron triggered: ${trigger}`)

    try {
      const summary = await runDueJobs({
        jobs: JOBS,
        feedDb,
        logDb: logDb.from('sync_log'),
        healthDb: logDb.from('feed_health'),
        env,
        budget,
        clock,
        trigger
      })

      const duration = Date.now() - startTime
      console.log(`Ran ${summary.ran.length} job(s) in ${duration}ms; ` +
        `${summary.deferred.length} deferred` +
        (summary.stoppedEarly ? ` (stopped early: ${summary.stoppedEarly})` : ''))

      // A run-level row, so "did the trigger fire at all" stays answerable even
      // when no job was due. The per-job rows are the record of the work itself.
      await logDb.from('sync_log').insert({
        source: 'worker-run',
        status: 'success',
        completed_at: new Date().toISOString(),
        metadata: {
          trigger,
          duration_ms: duration,
          subrequests_used: summary.subrequestsUsed,
          stopped_early: summary.stoppedEarly,
          ran: summary.ran,
          deferred: summary.deferred
        }
      })
    } catch (error) {
      console.error('Scheduler error:', error)

      await logDb.from('sync_log').insert({
        source: 'worker-run',
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: error.message,
        metadata: { trigger, duration_ms: Date.now() - startTime }
      })
    }
  },

  // HTTP handler (for manual triggers and health checks)
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Same limits as a cron invocation, so a manual trigger behaves and records
    // itself exactly as the scheduled one does.
    const budget = createSubrequestBudget({
      limit: SUBREQUEST_LIMIT,
      reserve: SUBREQUEST_RESERVE
    })
    const feedDb = createSupabaseClient(env, { budget })
    const logDb = createSupabaseClient(env)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    try {
      // Health check
      if (url.pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      }

      // Everything below triggers ingestion with the service-role key, so it
      // requires the ADMIN_TOKEN secret (set with: npx wrangler secret put ADMIN_TOKEN)
      const authHeader = request.headers.get('Authorization') || ''
      if (!env.ADMIN_TOKEN || authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      // List available endpoints
      if (url.pathname === '/') {
        return jsonResponse({
          name: 'Vigil Ingestion Worker',
          endpoints: {
            health: '/health',
            ingest: {
              due: '/ingest/due  (runs whatever the scheduler says is overdue)',
              feed: '/ingest/<feed-id>',
              feeds: JOBS.map(job => job.id)
            }
          }
        })
      }

      // Run whatever is overdue, exactly as a cron trigger would.
      if (url.pathname === '/ingest/due') {
        const summary = await runDueJobs({
          jobs: JOBS,
          feedDb,
          logDb: logDb.from('sync_log'),
          healthDb: logDb.from('feed_health'),
          env,
          budget,
          clock: createTimeBudget(),
          trigger: 'http:/ingest/due'
        })
        return jsonResponse(summary)
      }

      // A single job by its registry id. It is run through the scheduler too, so
      // a manual run lands in sync_log and counts towards the feed's freshness.
      const feedId = url.pathname.startsWith('/ingest/')
        ? url.pathname.slice('/ingest/'.length)
        : null
      const job = feedId ? JOBS_BY_ID[feedId] : null

      if (job) {
        const outcome = await runJob(job, {
          feedDb,
          logDb: logDb.from('sync_log'),
          env,
          budget,
          trigger: `http:${url.pathname}`
        })
        return jsonResponse(outcome, outcome.status === 'success' ? 200 : 502)
      }

      if (feedId) {
        return jsonResponse(
          { error: `Unknown feed '${feedId}'`, feeds: JOBS.map(j => j.id) },
          404
        )
      }

      return jsonResponse({ error: 'Not found' }, 404)

    } catch (error) {
      console.error('Request error:', error)
      return jsonResponse({ error: error.message }, 500)
    }
  }
}
